/**
 * Stored design (an order line) + Master Spec → Manufacturing Spec.
 *
 * Pure data, run on the server from the stored order — never from the
 * browser. Customer choices are read from the order exactly as stored;
 * garment data only from the master spec; configurator geometry only as
 * what it is (a reference model), never as a physical measurement.
 */
import { ALL_COLOURS, BUTTON_FINISHES, FITS, MATERIALS, SIZES, THREADS, ZIPPER_ENABLED } from "@/features/configurator/model/catalog";
import {
  EMBROIDERY_ZONES_BY_ID,
  REFERENCE_HPS_Y,
  REFERENCE_SP_Y,
  clampInZone,
  fitInZone,
  isFixedZone,
  LEGACY_ZONES,
  normalisedZone,
  placementData,
  stitchGridSize,
} from "@/features/configurator/model/embroideryGeometry";
import type { EmbroideryElement, JacketConfig } from "@/features/configurator/model/types";
import type { Order } from "@/features/cart/types";
import { masterBenchmark, masterBom, masterConstruction, masterGrading, masterPoms, masterTargets, zoneField, type MasterSpec } from "./master";
import { known, open, roundTo, type Field } from "./provenance";
import { SPEC_SCHEMA, SPEC_VERSION, type ArtworkItem, type ArtworkType, type ColourEntry, type ManufacturingSpec, type SizeId, type ThreadRef, type ZoneSpec } from "./types";

export const STYLE_ID = "JK-VARSITY-01";
const CONFIG = "JACKETEK configurator (stored order)";
const ZONE_REF_NOTE = "Position and box on the configurator's 3D reference model; `normalised` = the same zone relative to the garment (HPS, waistband, shoulder point, cuff seam), which the technical drawing places on its flat. Not a physical dimension.";

/**
 * Library categories whose type matters to the factory, by the source's
 * production code (library.json `productionName`). English labels are
 * translations of the Arabic titles; other categories print their own title.
 */
const LIBRARY_TYPES: Record<string, { type: ArtworkType; en: string }> = {
  F: { type: "FRONT_LETTERS", en: "Front Letters" },
  BC: { type: "NUMBER_YEAR", en: "Numbers" },
  AQ: { type: "READY_MADE", en: "Back designs" },
  AB: { type: "READY_MADE", en: "Class patches" },
};

export type BuildInput = {
  order: Order;
  lineIndex: number;
  master: MasterSpec;
  masterFile: { file: string; sha256: string | null };
  designId: string;
  revision: string;
  createdAt: string;
  /** Earlier revisions of this design's RFQ (kept, never rewritten). */
  history?: ManufacturingSpec["revisionHistory"];
  /** Files written for each embroidery element (relative to the tech pack folder). */
  files?: Record<string, { artwork: string | null; original: string | null; pixelSize?: { width: number; height: number } | null }>;
};

const named = (id: string | null | undefined) => (id ? ALL_COLOURS.find((c) => c.id === id) : undefined);
const threadOf = (id: string | null | undefined) => (id ? THREADS.find((t) => t.id === id) : undefined);

function threadRef(role: string, id: string | null | undefined, how: "chosen" | "asDesigned", designColour?: string): ThreadRef {
  const t = threadOf(id);
  if (t)
    return {
      role,
      threadId: known(t.id, how === "chosen" ? "CUSTOMER_SELECTED" : "SYSTEM_DERIVED", how === "chosen" ? CONFIG : "Design's own colour (library colour layers)"),
      name: t.name,
      hex: t.hex,
      asDesigned: how === "asDesigned",
    };
  return {
    role,
    threadId: open<string>(id ? "UNKNOWN" : "TBD_SUPPLIER_PROPOSAL", null, id ? `Unknown thread id "${id}"` : `Match the design colour${designColour ? ` ${designColour}` : ""}: supplier / digitizer to propose the thread`),
    name: null,
    hex: designColour ?? null,
    asDesigned: true,
  };
}

/** The artwork's width / height, by the same rule the configurator used to size it. */
function aspectOf(e: EmbroideryElement): number {
  if (e.kind === "text") {
    if (e.textArtwork) return e.textArtwork.widthPx / e.textArtwork.heightPx;
    return e.textStyle?.aspect ?? 1;
  }
  const img = e.image!;
  if (!img.asUploaded && img.processed) {
    const [w, h] = stitchGridSize(img.processed.widthPx, img.processed.heightPx);
    return w / h;
  }
  return img.aspect || 1;
}

function artworkTypeOf(e: EmbroideryElement): { type: ArtworkType; code: string | null; en: string | null } {
  if (e.kind === "text") return { type: "TEXT", code: null, en: null };
  const img = e.image!;
  if (img.frontLetters) return { type: "FRONT_LETTERS", code: img.library?.productionName ?? null, en: "Front Letters" };
  if (!img.library) return { type: "UPLOAD", code: null, en: null };
  const code = img.library.productionName ?? null;
  const known = code ? LIBRARY_TYPES[code] : undefined;
  return { type: known?.type ?? "READY_MADE", code, en: known?.en ?? null };
}

export function buildManufacturingSpec(input: BuildInput): ManufacturingSpec {
  const { order, lineIndex, master } = input;
  const line = order.items?.[lineIndex];
  const config: Partial<JacketConfig> = line?.customization ?? {};
  const sizes = SIZES as readonly SizeId[];
  const base = master.baseSize as SizeId;

  // ---- Garment (customer choices) ----
  const sizeId = line?.size ?? config.size ?? null;
  const size = sizeId && sizes.includes(sizeId as SizeId) ? known(sizeId, "CUSTOMER_SELECTED", CONFIG) : open<string>("UNKNOWN", null, sizeId ? `Size "${sizeId}" is not offered` : "No size stored");
  const fitOpt = FITS.find((f) => f.id === config.fit);
  // One standard baggy fit is offered today. Only its name: the website's
  // description mentions a dropped shoulder, which is an open decision (K1),
  // not a confirmed construction.
  const fit = fitOpt
    ? known(fitOpt.name, "CUSTOMER_SELECTED", CONFIG, null, { note: `Configurator fit id "${fitOpt.id}". Shoulder construction is open (conflict K1).` })
    : open<string>("UNKNOWN", null, "No fit stored");
  const mat = (zone: "body" | "sleeves") => {
    const m = MATERIALS.find((x) => x.id === config.materials?.[zone]);
    return m ? known(m.name, "CUSTOMER_SELECTED", CONFIG, null, { note: `Configurator material id "${m.id}"` }) : open<string>("UNKNOWN", null, "No material stored");
  };
  const bodyMaterial = mat("body");
  const sleeveMaterial = mat("sleeves");
  const finish = BUTTON_FINISHES.find((b) => b.id === config.buttons);
  const snapFinish = finish ? known(`${finish.name} finish`, "CUSTOMER_SELECTED", CONFIG) : open<string>("UNKNOWN", null, "No snap finish stored");
  const zipper = ZIPPER_ENABLED || config.zipper
    ? config.zipper
      ? known("Hidden zipper under the snap placket", "CUSTOMER_SELECTED", CONFIG)
      : known("Not fitted", "CUSTOMER_SELECTED", CONFIG)
    : known("Not fitted", "SYSTEM_DERIVED", "The configurator does not offer a zipper");

  const colour = (zone: "body" | "sleeves" | "trim") => named(config.colours?.[zone]);
  const body = colour("body"), sleeves = colour("sleeves"), trim = colour("trim");
  const colourField = (c: ReturnType<typeof named>, what: string) => (c ? known(c.id, "CUSTOMER_SELECTED", CONFIG) : open<string>("UNKNOWN", null, `No ${what} colour stored`));

  // ---- Embroidery zones (master: physical; configurator: drawing reference) ----
  const usedZones = new Set((config.embroidery ?? []).map((e) => e.placement));
  const zones: ZoneSpec[] = master.embroideryZones.zones
    .filter((z) => isFixedZone(z.zoneId))
    .map((mz) => {
      const z = EMBROIDERY_ZONES_BY_ID[mz.zoneId as keyof typeof EMBROIDERY_ZONES_BY_ID];
      const sleeve = z.side === "leftSleeve" || z.side === "rightSleeve";
      const below = (sleeve ? REFERENCE_SP_Y : REFERENCE_HPS_Y) - z.point[1];
      const W = zoneField(mz.lockFields.maxWidthCm, "Zone width");
      const H = zoneField(mz.lockFields.maxHeightCm, "Zone height");
      return {
        zoneId: z.id,
        zoneName: z.name,
        productionKey: z.productionKey,
        garmentPanel: mz.panel,
        side: z.side,
        allowedContent: z.accepts.design && z.accepts.text ? "DESIGN_OR_TEXT" : z.accepts.text ? "TEXT_ONLY" : "DESIGN_ONLY",
        physicalAnchorPrimary: mz.primaryAnchor,
        physicalAnchorSecondary: mz.secondaryAnchor,
        zoneWidthCm: W,
        zoneHeightCm: H,
        anchorOffsetXCm: zoneField(mz.lockFields.xReferenceCm, "Zone centre from the secondary anchor"),
        anchorOffsetYCm: zoneField(mz.lockFields.yReferenceCm, "Zone centre from the primary anchor"),
        gradedBySize: open<boolean>("TBD_PATTERN_MAKER", null, "Whether zone position / size grades by size is undecided"),
        configuratorReference: {
          status: "SYSTEM_DERIVED",
          note: ZONE_REF_NOTE,
          boxCm: [roundTo(z.box[0] * 100, 1), roundTo(z.box[1] * 100, 1)],
          centreFromCentreLineCm: roundTo(Math.abs(z.point[0]) * 100, 1),
          centreBelowAnchorCm: roundTo(below * 100, 1),
          anchor: sleeve ? "SP" : "HPS",
          normalised: normalisedZone(z),
        },
        used: usedZones.has(z.id),
        status: "TBD_PATTERN_MAKER",
        approved: false,
      };
    });
  const zoneById = new Map(zones.map((z) => [z.zoneId, z]));

  // ---- Artwork ----
  const perZone = new Map<string, number>();
  const artwork: ArtworkItem[] = [];
  for (const e of config.embroidery ?? []) {
    if (e.kind === "text" && !e.text?.trim()) continue;
    if (e.kind === "image" && !e.image?.src) continue;
    const fixed = isFixedZone(e.placement) ? EMBROIDERY_ZONES_BY_ID[e.placement] : null;
    const legacy = !fixed ? LEGACY_ZONES[e.placement] : null;
    const zoneName = fixed?.name ?? legacy?.name ?? e.placement;
    const key = fixed?.productionKey ?? legacy?.productionKey ?? "UNKNOWN_ZONE";
    const k = (perZone.get(key) ?? 0) + 1;
    perZone.set(key, k);
    const kind = artworkTypeOf(e);
    const aspect = aspectOf(e);
    const zs = zoneById.get(e.placement);

    // Normalised placement inside the fixed zone (shares of the configurator's box).
    const t = fixed ? clampInZone(fixed.box, aspect, e.inZone) : { scale: e.scale ?? 1, x: 0, y: 0 };
    // The size the configurator's 3D preview showed: a visual estimate on the reference model,
    // NOT a production measurement — kept in the spec for traceability, not printed in the RFQ.
    let shown: Field<[number, number]>;
    try {
      const ps = e.physicalSize ?? (fixed || legacy ? placementData(e, aspect).physicalSize : null);
      shown = ps
        ? known<[number, number]>([roundTo(ps.widthCm, 1), roundTo(ps.heightCm, 1)], "SYSTEM_DERIVED", "Configurator visual estimate (3D reference model) — not a production measurement; not printed in the RFQ", "cm", { precision: 1 })
        : open<[number, number]>("UNKNOWN", "cm", "Size not recorded");
    } catch {
      shown = open<[number, number]>("UNKNOWN", "cm", "Size could not be derived");
    }

    // Physical size / offset only when the zone's physical dimensions exist.
    const W = zs?.zoneWidthCm.value ?? null, H = zs?.zoneHeightCm.value ?? null;
    const physical = W !== null && H !== null && zs !== undefined;
    const PENDING = "PENDING MASTER ZONE DIMENSIONS";
    let finishedW: Field<number>, finishedH: Field<number>, offX: Field<number>, offY: Field<number>;
    if (physical) {
      const [w0, h0] = fitInZone([W, H], aspect);
      const src = "Calculated: master zone dimensions × customer's normalised placement";
      finishedW = known(roundTo(w0 * t.scale, 1), "SYSTEM_DERIVED", src, "cm", { precision: 1 });
      finishedH = known(roundTo(h0 * t.scale, 1), "SYSTEM_DERIVED", src, "cm", { precision: 1 });
      offX = known(roundTo(t.x * W, 1), "SYSTEM_DERIVED", src, "cm", { precision: 1 });
      offY = known(roundTo(t.y * H, 1), "SYSTEM_DERIVED", src, "cm", { precision: 1 });
    } else {
      finishedW = open("TBD_PATTERN_MAKER", "cm", PENDING);
      finishedH = open("TBD_PATTERN_MAKER", "cm", PENDING);
      offX = open("TBD_PATTERN_MAKER", "cm", PENDING);
      offY = open("TBD_PATTERN_MAKER", "cm", PENDING);
    }

    // Colours.
    const threads: ThreadRef[] = [];
    let colourMode: ArtworkItem["colourMode"] = "ORIGINAL";
    if (e.kind === "text") {
      colourMode = "CUSTOM";
      threads.push(threadRef("Fill (text)", e.thread, "chosen"));
    } else if (e.image?.colourway) {
      colourMode = "CUSTOM";
      for (const s of e.image.colourway.slots) {
        const chosen = e.image.colourway.colours[s.id];
        threads.push(chosen ? threadRef(s.label, chosen, "chosen") : threadRef(s.label, s.defaultThread ?? null, "asDesigned", s.defaultColor));
      }
    } else if (e.thread) {
      colourMode = "CUSTOM";
      threads.push(threadRef("Single thread", e.thread, "chosen"));
    }

    const img = e.image;
    const files = input.files?.[e.id];
    const text = e.kind === "text" ? e.text.replace(/\r\n?/g, "\n") : null;
    const lines = text !== null ? text.split("\n") : [];
    artwork.push({
      artworkId: `ART-${String(artwork.length + 1).padStart(2, "0")}-${key}${k > 1 ? `-${k}` : ""}`,
      elementId: e.id,
      artworkType: kind.type,
      zoneId: e.placement,
      zoneName,
      source: {
        kind: e.kind === "text" ? "text" : img?.frontLetters ? "front-letters" : img?.library ? "library" : "upload",
        libraryId: img?.library?.libraryId ?? img?.frontLetters?.libraryId ?? null,
        libraryCode: kind.code,
        libraryTitle: img?.library?.libraryTitle ?? null,
        libraryTitleEn: kind.en,
        designId: img?.library?.designId ?? img?.frontLetters?.templateId ?? null,
        originalFileName: img?.original?.fileName ?? img?.library?.originalFileName ?? null,
      },
      files: { artwork: files?.artwork ?? null, original: files?.original ?? null },
      pixelSize: files?.pixelSize ?? (e.kind === "text" && e.textArtwork ? { width: e.textArtwork.widthPx, height: e.textArtwork.heightPx } : img?.processed ? { width: img.processed.widthPx, height: img.processed.heightPx } : null),
      aspect: roundTo(aspect, 4),
      colourMode,
      threads,
      text:
        text !== null && e.textStyle
          ? {
              content: text,
              lines,
              lineCount: lines.length,
              characterCount: text.replace(/\n/g, "").length,
              font: e.textStyle.fontName,
              fontId: e.textStyle.fontId,
              fallbackFonts: e.textStyle.fallbackFontIds,
              direction: e.textStyle.direction,
              alignment: e.textStyle.alignment,
            }
          : text !== null
            ? { content: text, lines, lineCount: lines.length, characterCount: text.replace(/\n/g, "").length, font: "Not recorded (text saved before the font library)", fontId: "", fallbackFonts: [], direction: "ltr", alignment: "center" }
            : null,
      frontLetters: img?.frontLetters ? { letter1: img.frontLetters.letter1, letter2: img.frontLetters.letter2, style: img.frontLetters.style, templateId: img.frontLetters.templateId } : null,
      placement: {
        status: physical ? "PHYSICAL_FROM_MASTER_ZONE" : "PENDING_MASTER_ZONE_DIMENSIONS",
        label: physical ? "Physical placement from master zone dimensions (not yet sample-approved)" : "PROVISIONAL PLACEMENT — PHYSICAL ANCHORS TO BE CONFIRMED ON SAMPLE",
        normalizedScale: t.scale,
        normalizedOffsetX: t.x,
        normalizedOffsetY: t.y,
        anchorReference: zs ? `${zs.physicalAnchorPrimary} / ${zs.physicalAnchorSecondary}` : legacy ? "Older free placement (pre fixed zones)" : "Unknown zone",
        finishedWidthCm: finishedW,
        finishedHeightCm: finishedH,
        physicalOffsetXCm: offX,
        physicalOffsetYCm: offY,
        configuratorSizeCm: shown,
        rotationDeg: fixed ? known(0, "SYSTEM_DERIVED", "Fixed zones do not rotate artwork", "deg") : known(Math.round(e.rotation ?? 0), "CUSTOMER_SELECTED", CONFIG, "deg"),
      },
      productionTechnique: open<string>("TBD_SUPPLIER_PROPOSAL", null, "Configurator preview: satin embroidery. Supplier to propose the technique (direct embroidery, chenille, patch) and backing."),
      approved: false,
    });
  }

  // ---- Colourway ----
  const pending = open<string>("TBD_SUPPLIER_PROPOSAL", null, "Pantone / supplier colour code after supplier confirmation");
  const entry = (role: string, c: ReturnType<typeof named>, material: string | null, field?: Field<string>): ColourEntry => ({
    role,
    colourId: field ?? colourField(c, role.toLowerCase()),
    name: c?.name ?? null,
    hex: c?.hex ?? null,
    material,
    physicalReference: pending,
  });
  const colourway: ColourEntry[] = [
    entry("Body", body, bodyMaterial.value),
    entry("Sleeves", sleeves, sleeveMaterial.value),
    entry("Rib — collar, cuffs, waistband (base)", trim, "Rib knit"),
    entry("Rib stripes", sleeves, "Rib knit", sleeves ? known(sleeves.id, "SYSTEM_DERIVED", "As shown in the configurator's 3D preview (stripes follow the sleeve colour); not a separate customer option. Stripe count / width: pattern maker") : undefined),
    {
      role: "Snaps",
      colourId: finish ? known(finish.id, "CUSTOMER_SELECTED", CONFIG) : open("UNKNOWN", null),
      name: finish ? `${finish.name} finish` : null,
      hex: finish?.hex ?? null,
      material: "Metal snap (specification TBD)",
      physicalReference: pending,
    },
  ];
  const seen = new Set<string>();
  for (const a of artwork)
    for (const t of a.threads) {
      if (!t.threadId.value || seen.has(t.threadId.value)) continue;
      seen.add(t.threadId.value);
      colourway.push({ role: "Embroidery thread", colourId: t.threadId, name: t.name, hex: t.hex, material: "Embroidery thread (type TBD)", physicalReference: open("TBD_SUPPLIER_PROPOSAL", null, "Thread brand / code after supplier confirmation") });
    }

  // ---- BOM: master skeleton + this order's choices ----
  const bom = masterBom(master).map((b) => {
    const item = { ...b, notes: [...b.notes] };
    if (b.id === "BOM01") Object.assign(item, { material: bodyMaterial, colour: colourField(body, "body") });
    if (b.id === "BOM02") Object.assign(item, { material: sleeveMaterial, colour: colourField(sleeves, "sleeve") });
    if (["BOM06", "BOM07", "BOM08"].includes(b.id)) Object.assign(item, { material: known("Rib knit", "SYSTEM_DERIVED", "Configurator: collar, cuffs and waistband are rib knit"), colour: colourField(trim, "trim") });
    if (b.id === "BOM09") item.colour = sleeves ? known(sleeves.id, "SYSTEM_DERIVED", "Configurator 3D preview: stripes follow the sleeve colour") : open("UNKNOWN", null);
    if (b.id === "BOM10") item.colour = finish ? known(finish.id, "CUSTOMER_SELECTED", CONFIG, null, { note: `${finish.name} finish` }) : open("UNKNOWN", null);
    if (b.id === "BOM11") Object.assign(item, { material: zipper, colour: known("—", "SYSTEM_DERIVED", "Not fitted") });
    if (b.id === "BOM16") item.colour = seen.size ? known([...seen].join(", "), "CUSTOMER_SELECTED", CONFIG, null, { note: "Thread ids; see the colourway page" }) : open("TBD_SUPPLIER_PROPOSAL", null, "Artwork in original colours: thread matching by supplier");
    return item;
  });
  const labels = bom.filter((b) => b.category === "Labels" || b.category === "Packaging");
  const materials = bom.filter((b) => b.category !== "Labels" && b.category !== "Packaging");

  const sizeList = sizes.filter((s) => (master.sizes as string[]).includes(s));
  return {
    meta: {
      schema: SPEC_SCHEMA,
      specVersion: SPEC_VERSION,
      documentType: "RFQ_TECH_PACK",
      documentStatus: "NOT_FOR_BULK_PRODUCTION",
      statusBanner: "RFQ — NOT FOR BULK PRODUCTION",
      styleId: STYLE_ID,
      designId: input.designId,
      orderId: order.id ?? null,
      orderLine: line ? lineIndex + 1 : null,
      revision: input.revision,
      createdAt: input.createdAt,
      language: "en",
      masterSpec: { file: input.masterFile.file, title: master.title, revision: master.revision ?? "", sha256: input.masterFile.sha256, productionApproved: master.productionApproved },
      generator: "JACKETEK RFQ Tech Pack generator",
    },
    style: {
      name: "JACKETEK Senior / Varsity Jacket",
      productType: "Senior / Varsity / Letterman Jacket",
      category: "Outerwear — jacket",
      fit: fit,
      silhouette: {
        primaryReference: known("Golden Bear Classic Fit Varsity Jacket (base size M)", "VERIFIED_SOURCE", "Master Spec v0.1 decision"),
        secondaryVisualReference: known("JACKETEK preferred varsity / senior jacket — M only, visual benchmark", "SECONDARY_VISUAL_REFERENCE", "Master Spec v0.1 §3A", null, { note: "Not verified; grading not used" }),
        techPackStructureReference: "S.i. Graphics Varsity Letterman Jacket Tech Pack (document structure only)",
      },
      sampleStatus: "No physical sample approved. Measurements are reference / provisional.",
      requestedSampleSize: size,
      quantityOnOrder: line && Number.isInteger(line.quantity) ? known(line.quantity, "CUSTOMER_SELECTED", CONFIG, "pcs") : open("UNKNOWN", "pcs"),
    },
    documentStatus: {
      code: "NOT_FOR_BULK_PRODUCTION",
      banner: "RFQ — NOT FOR BULK PRODUCTION",
      productionApproved: false,
      statement: "Request for quotation. Measurements are reference or provisional and require physical sample approval. Not a production tech pack.",
    },
    garment: {
      size,
      fit,
      bodyMaterial,
      sleeveMaterial,
      shoulderConstruction: open("UNKNOWN", null, "Set-in (Golden Bear reference) vs dropped shoulder (current website wording) is undecided — conflict K1"),
      closure: {
        type: known("Snap front", "SYSTEM_DERIVED", "Configurator design (snap placket)"),
        snapFinish,
        snapCount: open("TBD_PATTERN_MAKER", "count", "The design preview shows a snap front; count and spacing to be set by the pattern maker (F03–F07)"),
        zipper,
      },
    },
    measurements: {
      unit: "cm",
      baseSize: base,
      sizes: sizeList,
      poms: masterPoms(master, sizeList),
      provisionalTargets: masterTargets(master),
      secondaryBenchmark: masterBenchmark(master),
      methodAmbiguities: master.methodAmbiguities.map((a) => ({ id: a.id, pomId: a.pom, title: a.title, detail: a.detail })),
    },
    grading: {
      kind: "REFERENCE_PROVISIONAL",
      label: "REFERENCE / PROVISIONAL GRADING — NOT PRODUCTION APPROVED",
      productionApproved: false,
      note: "Golden Bear Classic Fit published increments for four POMs only. JACKETEK production grading is set after sample approval.",
      rules: masterGrading(master),
    },
    materials,
    colourway,
    construction: masterConstruction(master),
    trims: ["BOM06", "BOM07", "BOM08", "BOM09", "BOM10", "BOM11", "BOM22", "BOM23"],
    labels,
    embroideryZones: zones,
    artwork,
    quotationRequirements: {
      currency: open("TBD_SUPPLIER_PROPOSAL", null, "Supplier to state the quotation currency"),
      priceBreaks: [50, 100, 250, 500],
      requested: [
        ["Q01", "Minimum order quantity (MOQ)"],
        ["Q02", "Sample cost (size M, this design)"],
        ["Q03", "Sample lead time"],
        ["Q04", "Bulk lead time (after sample approval)"],
        ["Q05", "Unit price at 50 pcs"],
        ["Q06", "Unit price at 100 pcs"],
        ["Q07", "Unit price at 250 pcs"],
        ["Q08", "Unit price at 500 pcs"],
        ["Q09", "Setup charges"],
        ["Q10", "Embroidery digitizing charge (per design)"],
        ["Q11", "Patch / chenille setup charge, if proposed"],
        ["Q12", "Packaging (per unit)"],
        ["Q13", "Shipping term (Incoterm) and port / city"],
        ["Q14", "Payment terms"],
        ["Q15", "Tooling / setup, if applicable"],
        ["Q16", "Proposed materials, construction and tolerances (see TBD items)"],
      ].map(([id, item]) => ({ id, item, value: open<string>("TBD_SUPPLIER_PROPOSAL", null, "Supplier to provide") })),
      notes: ["Quote the garment exactly as specified; list any substitution separately.", "Quantities are configurable; the four price breaks are JACKETEK's request, not a commitment."],
    },
    conflicts: master.conflicts.map((c) => ({ id: c.id, topic: c.topic, detail: c.detail })),
    revisionHistory: [...(input.history ?? []), { revision: input.revision, date: input.createdAt.slice(0, 10), specVersion: SPEC_VERSION, summary: input.history?.length ? "Regenerated from the stored design" : "First RFQ issue" }],
    validation: null,
  };
}
