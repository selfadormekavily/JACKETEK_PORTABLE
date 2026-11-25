/**
 * Website Order → Production Sheet, for the 4-page tech pack generator
 * (production-drawing/build/populate.mjs).
 *
 * Builds one structured sheet per order line without changing the Order:
 * every value comes from the order (or, where stated, from how the product
 * is built in the configurator); nothing is invented. What the website
 * doesn't store is left null — the PDF prints "TO BE CONFIRMED" — and is
 * listed in `gaps`. Data the order SHOULD have but doesn't (or can't be
 * read) is listed in `missing`: no PDF must be made then.
 *
 * Pure data: no DOM, React or filesystem — it runs on the server.
 */
import {
  ALL_COLOURS,
  BUTTON_FINISHES,
  FITS,
  MATERIALS,
  THREADS,
} from "@/features/configurator/model/catalog";
import {
  EMBROIDERY_ZONES_BY_ID,
  clampInZone,
  hasFreePlacement,
  LEGACY_ZONES,
  placementData,
  REFERENCE_HPS_Y,
  REFERENCE_SP_Y,
  stitchGridSize,
} from "@/features/configurator/model/embroideryGeometry";
import type { PlacementId, ZoneSide, ZoneTransform } from "@/features/configurator/model/types";
import type { ColourSection, MapWindow, verifyAgainstDst } from "@/features/embroidery/stitchMap";
import { getEmbroideryFont } from "@/features/embroidery/fonts/fontLibrary";
import type { DigitizedMetadata } from "@/features/embroidery/types";
import type { Order } from "@/features/cart/types";

/** The sizes on the official size chart (production-drawing/data/official_size_chart.json). */
const CHART_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
/** Website size → size-chart size. The configurator offers "XXL" = chart "2XL". */
const SIZE_TO_CHART: Record<string, string> = { XXL: "2XL" };

/**
 * A stored zone id → its file key, name and garment side: one of the ten
 * fixed zones (model/embroideryGeometry.ts), or a zone of an order placed
 * before them. Null for an unknown id.
 */
function zoneOf(id: string): { key: string; name: string; side: ZoneSide } | null {
  const zone = EMBROIDERY_ZONES_BY_ID[id as PlacementId];
  if (zone) return { key: zone.productionKey, name: zone.name, side: zone.side };
  const legacy = LEGACY_ZONES[id];
  return legacy ? { key: legacy.productionKey, name: legacy.name, side: legacy.side } : null;
}

const isSleeve = (side: ZoneSide) => side === "leftSleeve" || side === "rightSleeve";

/** The artwork's placement inside its fixed box, as the configurator computed it (clampInZone: the same rule). */
function inZoneOf(box: readonly [number, number], aspect: number, t: Partial<ZoneTransform> | undefined) {
  const c = clampInZone(box, aspect, t);
  return { sizeShare: c.scale, offsetCm: [round1(c.x * box[0] * 100), round1(c.y * box[1] * 100)] as [number, number] };
}

/** A stored size agrees with a computed one (or none was stored). */
const sameSize = (stored: { widthCm: number; heightCm: number } | undefined, computed: { widthCm: number; heightCm: number }) =>
  !stored || (Math.abs(stored.widthCm - computed.widthCm) <= 0.2 && Math.abs(stored.heightCm - computed.heightCm) <= 0.2);

/** File extension of an uploaded original, by type (prepareUpload accepts these). */
const ORIGINAL_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

export type ProductionArtwork = {
  /** File name for the artwork, delivered alongside the PDF. */
  fileName: string;
  /**
   * Exactly as stored in the order (a data URL): the processed transparent
   * PNG (…_ARTWORK.png) and, when the order kept it, the customer's
   * original upload (…_ORIGINAL.<ext>); a ready-made library design's own
   * file (…_ORIGINAL.<ext>); or text drawn in its font (…_TEXT.png).
   */
  dataUrl: string;
};

export type SheetColour = { name: string; hex: string };

/** One row of the material / colour specification. null = not stored by the website. */
export type SheetMaterialRow = {
  part: string;
  pieces: string;
  material: string | null;
  colours: (SheetColour & { role?: string })[] | null;
  note?: string;
};

/** One customer-uploaded image, ready for page 4. */
export type SheetImage = {
  n: number;
  /** The order's embroidery element this image is. */
  elementId: string;
  /** Auto-digitized embroidery (added by scripts/production-pdf.mjs; absent until digitized). */
  digitized?: SheetDigitized;
  /** The stored zone id (one of the ten fixed zones, or an older order's zone). */
  zone: string;
  zoneName: string;
  side: ZoneSide;
  /** The customer's file, unchanged (null on orders placed before originals were kept). */
  original: { file: string; customerFileName: string; mimeType: string; widthPx: number | null; heightPx: number | null } | null;
  /**
   * The artwork the jacket showed: the processed transparent PNG of an
   * upload, or the file itself for a library design (`asUploaded`).
   */
  processed: { file: string; widthPx: number | null; heightPx: number | null };
  /** The artwork is the file itself, unchanged (a library design or drawn text; no processed PNG exists). */
  asUploaded: boolean;
  /** A ready-made library design (null for a customer upload). */
  library: { id: string; designId: string; libraryId: string; libraryTitle: string; productionName: string | null; originalFileName: string | null } | null;
  /** A Front Letters design: its template and the customer's two letters (the artwork is rebuilt from them). */
  frontLetters: { templateId: string; libraryId: string; style: string; letter1: string; letter2: string } | null;
  /** A colourway design with changed colours: per slot, the thread chosen (null = the design's own colour). */
  /**
   * A design whose colour layers were changed: per layer (fill, outline…), its
   * thread — chosen, or the design's own (`asDesigned`); null = the design's
   * own, unnamed colour (`defaultColor`). Each layer is stitched in its thread.
   */
  colourway?: { designId: string; slots: { id: string; label: string; defaultColor: string; thread: SheetColour | null; asDesigned?: boolean }[] } | null;
  /** Text embroidery: the customer's text and font (the artwork is that text drawn in that font). */
  text?: {
    content: string;
    fontId: string;
    fontName: string;
    /** The font's CSS family (the sheet sets the text in it). */
    fontFamily: string;
    fallbackFontIds: string[];
    fallbackFontFamilies: string[];
    direction: "ltr" | "rtl";
    alignment: "center";
    fitScale: number;
  } | null;
  /** Final size on the garment (cm), as the configurator showed it. `sizeSource` "order" = the stored physicalSize; "aspect" = older order, recalculated. */
  widthCm: number;
  heightCm: number;
  sizeSource: "order" | "aspect";
  /** Degrees, counter-clockwise as seen facing the zone. */
  rotation: number;
  scale: number;
  /** Configurator offset from the zone centre (cm, x right / y up facing the zone). */
  offsetCm: [number, number];
  /** Artwork centre on the reference jacket (cm; x + = wearer's left, y up from y = 0). */
  reference: { side: ZoneSide; xCm: number; yCm: number };
  /**
   * Readable placement, on the reference jacket. Body zones: from the
   * centre front / back and below the HPS. Sleeve zones: centred on the
   * sleeve's outer side (fromCentreCm 0) and below the shoulder point.
   */
  fromCentreCm: number;
  towards: "wearer's left" | "wearer's right" | "centre";
  belowHpsCm: number;
  /** Sleeve zones: the artwork centre below the shoulder point (cm); null on body zones. */
  belowSpCm: number | null;
  /** The fixed zone's box (cm), null on orders placed before the fixed zones. */
  zoneBoxCm: [number, number] | null;
  /**
   * Fixed zones: where the customer placed the artwork INSIDE the box (the
   * box itself is fixed): its size as a share of the largest that fits
   * (1 = fitted), and its centre's offset from the box centre (cm, facing
   * the zone: x right, y up). Null on orders placed before the fixed zones.
   */
  zonePlacement: { sizeShare: number; offsetCm: [number, number] } | null;
  /** Single thread, or null = the design's own colours. */
  thread: SheetColour | null;
};

/** The digitized design's files and summary, for page 4. */
export type SheetDigitized = {
  designId: string;
  status: string;
  dstFile: string;
  previewFile: string;
  metadataFile: string;
  metadata: DigitizedMetadata;
  /** Page 5+: vector stitch map drawn from the stored stitch data (absent if none is stored). */
  stitchMap?: {
    mapFile: string;
    detailFile: string;
    mapMm: [number, number];
    detailMm: [number, number];
    /** Cell size of the main map (the detail uses 0.5 mm). */
    cellMm: number;
    /** One SVG per thread colour. */
    separations: { file: string; mm: [number, number] }[];
    window: MapWindow;
    verification: ReturnType<typeof verifyAgainstDst>;
    sections: ColourSection[];
  };
};

export type ProductionSheet = {
  productionId: string;
  orderId: string;
  line: { index: number; count: number };
  date: string;
  customer: { name: string; phone: string | null };
  delivery: { city: string; area: string; address: string; notes: string } | null;
  size: { ordered: string; chart: string };
  fit: { name: string; description: string };
  quantity: number;
  /** For the colour map. */
  colours: { body: SheetColour; sleeves: SheetColour; trim: SheetColour; snaps: SheetColour };
  zipper: boolean;
  materials: SheetMaterialRow[];
  images: SheetImage[];
  /** Text embroidery (listed only; not specified on this sheet yet). */
  texts: { zoneName: string; text: string; thread: SheetColour | null }[];
};

export type ProductionOrderResult = {
  /** The production sheet (null when `missing` is not empty). */
  sheet: ProductionSheet | null;
  /** The order ID printed on the sheet (and used in the file name). */
  productionId: string;
  /** Order data that should be present but isn't: do NOT generate. */
  missing: string[];
  /** What the website doesn't store (printed TO BE CONFIRMED). */
  gaps: string[];
  /** Uploaded embroidery images, written next to the PDF. */
  artwork: ProductionArtwork[];
};

const named = (o: { name: string; hex: string }): SheetColour => ({ name: o.name, hex: o.hex });
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Builds the production sheet for one line of an order. An order with
 * several jackets gets one sheet per line ("<ORDER_ID>-<n>").
 */
export function orderToProductionOrder(order: Order, lineIndex = 0): ProductionOrderResult {
  const missing: string[] = [];
  const gaps: string[] = [];
  const artwork: ProductionArtwork[] = [];
  const line = order.items?.[lineIndex];
  const count = order.items?.length ?? 0;
  const productionId = order.id ? (count > 1 ? `${order.id}-${lineIndex + 1}` : order.id) : "";
  const fail = () => ({ sheet: null, productionId, missing: [...new Set(missing)], gaps, artwork: [] });

  // ---- Order ----
  if (!order.id) missing.push("ORDER_ID");
  const customerName = order.customer?.fullName?.trim();
  if (!customerName) missing.push("CUSTOMER_NAME");
  const date = order.createdAt && !Number.isNaN(Date.parse(order.createdAt)) ? order.createdAt.slice(0, 10) : "";
  if (!date) missing.push("ORDER_DATE");
  if (!line) {
    missing.push("ORDER_LINE");
    return fail();
  }
  const config = line.customization;
  const chart = line.size ? (SIZE_TO_CHART[line.size] ?? line.size) : "";
  if (!(CHART_SIZES as readonly string[]).includes(chart)) missing.push("SIZE");
  if (!(Number.isInteger(line.quantity) && line.quantity > 0)) missing.push("QUANTITY");
  if (!config) {
    missing.push("CUSTOMIZATION");
    return fail();
  }

  // ---- Materials and colours ----
  const colour = (zone: "body" | "sleeves" | "trim", token: string) => {
    const c = ALL_COLOURS.find((x) => x.id === config.colours?.[zone]);
    if (!c) missing.push(token);
    return c;
  };
  const material = (zone: "body" | "sleeves", token: string) => {
    const m = MATERIALS.find((x) => x.id === config.materials?.[zone]);
    if (!m) missing.push(token);
    return m;
  };
  const body = colour("body", "BODY_COLOR");
  const sleeves = colour("sleeves", "SLEEVE_COLOR");
  const trim = colour("trim", "TRIM_COLOR");
  const bodyMaterial = material("body", "BODY_MATERIAL");
  const sleeveMaterial = material("sleeves", "SLEEVE_MATERIAL");
  const finish = BUTTON_FINISHES.find((b) => b.id === config.buttons);
  if (!finish) missing.push("SNAP_COLOR");
  if (typeof config.zipper !== "boolean") missing.push("ZIPPER");
  const fit = FITS.find((f) => f.id === config.fit);
  if (!fit) missing.push("FIT");
  if (missing.length || !body || !sleeves || !trim || !bodyMaterial || !sleeveMaterial || !finish || !fit) return fail();

  // Collar, cuffs and waistband are the configurator's "trim" zone: rib
  // knit in the trim colour, with stripes in the sleeve colour (as built
  // on the 3D jacket — materials "Trim" and "Stripe"). Pocket welts are
  // cut from the sleeve material on the 3D jacket.
  const rib = [{ ...named(trim), role: "Base" }, { ...named(sleeves), role: "Stripes" }];
  const materials: SheetMaterialRow[] = [
    { part: "Body", pieces: "Front left, front right, back", material: bodyMaterial.name, colours: [named(body)] },
    { part: "Sleeves", pieces: "Left, right", material: sleeveMaterial.name, colours: [named(sleeves)] },
    { part: "Collar", pieces: "1", material: "Rib knit", colours: rib },
    { part: "Cuffs", pieces: "2", material: "Rib knit", colours: rib },
    { part: "Waistband", pieces: "1", material: "Rib knit", colours: rib },
    { part: "Pocket welts", pieces: "2", material: sleeveMaterial.name, colours: [named(sleeves)] },
    { part: "Snaps", pieces: "7", material: null, colours: [named(finish)], note: `${finish.name} finish` },
    { part: "Front tabs", pieces: "2", material: null, colours: null },
    config.zipper
      ? { part: "Zipper", pieces: "1", material: null, colours: null, note: "Hidden under the snap placket" }
      : { part: "Zipper", pieces: "—", material: "Not fitted", colours: [], note: "No zipper on this order" },
    { part: "Lining", pieces: "—", material: null, colours: null },
  ];
  gaps.push("SNAP_MATERIAL", "FRONT_TAB_MATERIAL", "FRONT_TAB_COLOR", "LINING");
  if (config.zipper) gaps.push("ZIPPER_MATERIAL", "ZIPPER_COLOR");

  // ---- Embroidery ----
  const elements = config.embroidery ?? [];
  const images: SheetImage[] = [];
  const texts: ProductionSheet["texts"] = [];
  const threadOf = (id: string | null) => {
    if (id === null) return null;
    const t = THREADS.find((x) => x.id === id);
    if (!t) missing.push("EMBROIDERY_THREAD_COLOR");
    return t ? named(t) : null;
  };
  const perZone = new Map<string, number>();
  for (const e of elements) {
    const zone = zoneOf(e.placement);
    if (!zone) {
      missing.push("EMBROIDERY_PLACEMENT");
      continue;
    }
    if (e.kind === "text") {
      if (!e.text?.trim()) continue;
      // Text in a library font: a full artwork card (drawn from the order's
      // text + font by the server: e.textArtwork). Older free text: listed.
      if (e.textStyle && e.textArtwork) {
        const k = (perZone.get(e.placement) ?? 0) + 1;
        perZone.set(e.placement, k);
        const file = `FIDELIO_${productionId}_${zone.key}${k > 1 ? `_${k}` : ""}_TEXT.png`;
        artwork.push({ fileName: file, dataUrl: e.textArtwork.src });
        // Sized from the artwork actually drawn (fitted into the zone like the
        // jacket showed it); the order's recorded size when they agree.
        const derived = placementData(e, e.textArtwork.widthPx / e.textArtwork.heightPx);
        const agrees =
          !!e.physicalSize &&
          Math.abs(e.physicalSize.widthCm - derived.physicalSize.widthCm) <= 0.2 &&
          Math.abs(e.physicalSize.heightCm - derived.physicalSize.heightCm) <= 0.2;
        if (e.physicalSize && !agrees) gaps.push(`${zone.key}_TEXT_SIZE (recorded ${e.physicalSize.widthCm} × ${e.physicalSize.heightCm} cm, drawn ${derived.physicalSize.widthCm} × ${derived.physicalSize.heightCm} cm — drawn size used)`);
        const size = agrees ? e.physicalSize! : derived.physicalSize;
        const reference = e.referencePosition ?? derived.referencePosition;
        const sleeve = isSleeve(reference.side);
        const fixed = EMBROIDERY_ZONES_BY_ID[e.placement];
        images.push({
          n: images.length + 1,
          elementId: e.id,
          zone: e.placement,
          zoneName: zone.name,
          side: zone.side,
          original: { file, customerFileName: `Text “${e.text.trim()}” in ${e.textStyle.fontName}`, mimeType: "image/png", widthPx: e.textArtwork.widthPx, heightPx: e.textArtwork.heightPx },
          processed: { file, widthPx: e.textArtwork.widthPx, heightPx: e.textArtwork.heightPx },
          asUploaded: true,
          library: null,
          frontLetters: null,
          text: {
            content: e.text.trim(),
            fontId: e.textStyle.fontId,
            fontName: e.textStyle.fontName,
            fontFamily: getEmbroideryFont(e.textStyle.fontId).family,
            fallbackFontIds: e.textStyle.fallbackFontIds,
            fallbackFontFamilies: e.textStyle.fallbackFontIds.map((id) => getEmbroideryFont(id).family),
            direction: e.textStyle.direction,
            alignment: e.textStyle.alignment,
            fitScale: e.textStyle.fitScale,
          },
          widthCm: size.widthCm,
          heightCm: size.heightCm,
          sizeSource: agrees ? "order" : "aspect",
          rotation: 0,
          scale: 1,
          offsetCm: [0, 0],
          reference,
          fromCentreCm: sleeve ? 0 : round1(Math.abs(reference.xCm)),
          towards: sleeve || Math.abs(reference.xCm) < 0.05 ? "centre" : reference.xCm > 0 ? "wearer's left" : "wearer's right",
          belowHpsCm: round1(REFERENCE_HPS_Y * 100 - reference.yCm),
          belowSpCm: sleeve ? round1(REFERENCE_SP_Y * 100 - reference.yCm) : null,
          zoneBoxCm: fixed ? [round1(fixed.box[0] * 100), round1(fixed.box[1] * 100)] : null,
          zonePlacement: fixed ? inZoneOf(fixed.box, e.textArtwork.widthPx / e.textArtwork.heightPx, e.inZone) : null,
          thread: threadOf(e.thread),
        });
        continue;
      }
      if (e.textStyle) gaps.push(`${zone.key}_TEXT_ARTWORK (text “${e.text.trim()}” in ${e.textStyle.fontName} — not drawn)`);
      texts.push({ zoneName: zone.name, text: e.text.trim(), thread: threadOf(e.thread) });
      continue;
    }
    if (!e.image?.src) continue;
    const inZone = elements.filter((x) => x.kind === "image" && x.image && x.placement === e.placement).length;
    const k = (perZone.get(e.placement) ?? 0) + 1;
    perZone.set(e.placement, k);
    const base = `FIDELIO_${productionId}_${zone.key}${inZone > 1 ? `_${k}` : ""}`;
    // Library designs: the artwork IS the design's file — exported once,
    // unchanged, in its own format. Uploads: the processed PNG they were
    // shown with, plus the customer's file when it was kept.
    const asUploaded = e.image.asUploaded === true;
    const original = e.image.original ?? null;
    const originalSrc = asUploaded ? e.image.src : original?.src ?? null;
    let originalFile: string | null = null;
    if (original && originalSrc) {
      originalFile = `${base}_ORIGINAL.${ORIGINAL_EXTENSIONS[original.mimeType] ?? "bin"}`;
      artwork.push({ fileName: originalFile, dataUrl: originalSrc });
    } else gaps.push(`${base}_ORIGINAL (order placed before originals were kept)`);
    const processedFile = asUploaded && originalFile ? originalFile : `${base}_ARTWORK.png`;
    if (!asUploaded) artwork.push({ fileName: processedFile, dataUrl: e.image.src });

    // Size and position: as saved with the order, or (older orders)
    // recalculated with the configurator's own formula.
    const processed = asUploaded ? undefined : e.image.processed;
    const aspect = processed ? (([w, h]) => w / h)(stitchGridSize(processed.widthPx, processed.heightPx)) : e.image.aspect;
    // Orders placed before the fixed zones kept a free position (no placement inside a box).
    const legacyFree = hasFreePlacement(e) && !!LEGACY_ZONES[e.placement];
    const derived = placementData(e, aspect);
    const size = e.physicalSize ?? derived.physicalSize;
    // xCm is on the jacket itself (+ = wearer's left), front or back.
    const reference = e.referencePosition ?? derived.referencePosition;
    const sleeve = isSleeve(reference.side);
    const fixed = EMBROIDERY_ZONES_BY_ID[e.placement];
    images.push({
      n: images.length + 1,
      elementId: e.id,
      zone: e.placement,
      zoneName: zone.name,
      side: zone.side,
      original: originalFile && original
        ? { file: originalFile, customerFileName: original.fileName, mimeType: original.mimeType, widthPx: original.widthPx, heightPx: original.heightPx }
        : null,
      processed: asUploaded
        ? { file: processedFile, widthPx: original?.widthPx ?? null, heightPx: original?.heightPx ?? null }
        : { file: processedFile, widthPx: processed?.widthPx ?? null, heightPx: processed?.heightPx ?? null },
      asUploaded,
      library: e.image.library
        ? {
            id: e.image.library.id,
            designId: e.image.library.designId,
            libraryId: e.image.library.libraryId,
            libraryTitle: e.image.library.libraryTitle,
            productionName: e.image.library.productionName,
            originalFileName: e.image.library.originalFileName,
          }
        : null,
      frontLetters: e.image.frontLetters
        ? {
            templateId: e.image.frontLetters.templateId,
            libraryId: e.image.frontLetters.libraryId,
            style: e.image.frontLetters.style,
            letter1: e.image.frontLetters.letter1,
            letter2: e.image.frontLetters.letter2,
          }
        : null,
      colourway: e.image.colourway
        ? {
            designId: e.image.colourway.designId,
            slots: e.image.colourway.slots.map((s) => {
              const t = e.image!.colourway!.colours[s.id];
              // A layer left as designed: its own thread, when the design names it.
              const own = t ? null : s.defaultThread ?? null;
              return { id: s.id, label: s.label, defaultColor: s.defaultColor, thread: t ? threadOf(t) : own ? threadOf(own) : null, asDesigned: !t };
            }),
          }
        : null,
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      sizeSource: e.physicalSize ? "order" : "aspect",
      rotation: Math.round(e.rotation ?? 0),
      scale: e.scale ?? 1,
      offsetCm: [round1((e.offset?.[0] ?? 0) * 100), round1((e.offset?.[1] ?? 0) * 100)],
      reference,
      fromCentreCm: sleeve ? 0 : round1(Math.abs(reference.xCm)),
      towards: sleeve || Math.abs(reference.xCm) < 0.05 ? "centre" : reference.xCm > 0 ? "wearer's left" : "wearer's right",
      belowHpsCm: round1(REFERENCE_HPS_Y * 100 - reference.yCm),
      belowSpCm: sleeve ? round1(REFERENCE_SP_Y * 100 - reference.yCm) : null,
      zoneBoxCm: fixed ? [round1(fixed.box[0] * 100), round1(fixed.box[1] * 100)] : null,
      // (An order whose stored size isn't the placement's was sized by older rules: no placement in a box to report.)
      zonePlacement: fixed && !legacyFree && sameSize(e.physicalSize, derived.physicalSize) ? inZoneOf(fixed.box, aspect, e.inZone) : null,
      thread: threadOf(e.thread),
    });
  }
  if (missing.length) return fail();

  const delivery = order.delivery
    ? { city: order.delivery.city ?? "", area: order.delivery.area ?? "", address: order.delivery.address ?? "", notes: order.delivery.notes ?? "" }
    : null;
  return {
    sheet: {
      productionId,
      orderId: order.id,
      line: { index: lineIndex, count },
      date,
      customer: { name: customerName!, phone: order.customer?.phone?.trim() || null },
      delivery,
      size: { ordered: line.size!, chart },
      fit: { name: fit.name, description: fit.description },
      quantity: line.quantity,
      colours: { body: named(body), sleeves: named(sleeves), trim: named(trim), snaps: named(finish) },
      zipper: config.zipper,
      materials,
      images,
      texts,
    },
    productionId,
    missing: [],
    gaps,
    artwork,
  };
}

/** FIDELIO_<ORDER_ID>_PRODUCTION_DRAWING.pdf */
export const productionPdfName = (productionId: string) =>
  `FIDELIO_${productionId.replace(/[^A-Za-z0-9_-]/g, "_")}_PRODUCTION_DRAWING.pdf`;
