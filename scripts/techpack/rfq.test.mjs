// RFQ Tech Pack / Manufacturing Spec tests (node:test; no extra dependency).
//   node --test scripts/techpack/          (the PDF tests need Chrome or Edge)
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { encodePng } from "../../server/png.mjs";
import { loadShared } from "../../server/tsModule.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MASTER = JSON.parse(readFileSync(join(ROOT, "garment-spec/jacketek-master-spec-v0.1.json"), "utf8"));
const LEGACY_ORDER = JSON.parse(readFileSync(join(ROOT, "scripts/fixtures/TEST-FIDELIO-001.order.json"), "utf8"));
const clone = (x) => structuredClone(x);

let S; // the shared TypeScript (build / validate), compiled for Node
before(async () => {
  S = await loadShared();
});

/** A small real PNG as a data URL. */
function png(w = 48, h = 32, rgb = [180, 20, 40]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return `data:image/png;base64,${encodePng({ width: w, height: h, data }).toString("base64")}`;
}

const LIB = (code, title, libraryId) => ({
  id: `ojisan:${code}-1`, designId: `${code}-design-1`, libraryId, libraryTitle: title, productionName: code,
  originalFileName: "1.PNG", asset: `assets/${code}/1.png`, thumbnail: "", source: { provider: "test", placements: [] },
});

/** A current-model order (synthetic data in the configurator's stored shape). */
function modernOrder() {
  return {
    id: "JK-TEST-RFQ1",
    createdAt: "2026-10-08T10:00:00.000Z",
    status: "pending",
    customer: { fullName: "Test", phone: "+9647700000000" },
    delivery: { city: "T", area: "T", address: "T", notes: "" },
    payment: { method: "cod", status: "due-on-delivery" },
    pricing: { currency: "IQD", subtotal: null, delivery: null, total: null },
    items: [
      {
        productId: "graduation-jacket", productName: "Graduation Jacket", size: "M", quantity: 1, unitPrice: null, lineTotal: null,
        customization: {
          colours: { body: "fabric-navy", sleeves: "leather-white", trim: "fabric-red" },
          materials: { body: "felt", sleeves: "leather" },
          buttons: "gold",
          zipper: false,
          size: "M",
          fit: "relaxed",
          embroidery: [
            {
              id: "e-fl", kind: "image", text: "", placement: "leftChest", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null,
              inZone: { scale: 0.7, x: 0.1, y: -0.05 },
              image: {
                src: png(70, 40), aspect: 1.75, asUploaded: true,
                library: LIB("F", "الحروف الامامية", "23ff73fd-b78f-4718-9109-2b8f73076954"),
                frontLetters: { type: "front-letters", templateId: "tmpl-1", libraryId: "23ff73fd-b78f-4718-9109-2b8f73076954", letter1: "J", letter2: "K", style: "Felt patch", templateVersion: 1 },
                colourway: {
                  type: "colourway", designId: "tmpl-1", colourwayVersion: 1, colours: { fill: "navy", outline: "gold" },
                  slots: [
                    { id: "fill", label: "Fill", defaultColor: "#ffffff", defaultThread: "white" },
                    { id: "outline", label: "Outline", defaultColor: "#000000" },
                    { id: "inner", label: "Inner line", defaultColor: "#888888", defaultThread: "gray" },
                  ],
                },
              },
            },
            { id: "e-back", kind: "image", text: "", placement: "mainBack", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null, image: { src: png(60, 60, [10, 10, 10]), aspect: 1, asUploaded: true, library: LIB("AQ", "مكتبة تصميمات الظهر", "f13e1e7d-e9c8-4cb4-8a44-c3f02958207f") } },
            { id: "e-num", kind: "image", text: "", placement: "rightSleeveUpper", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null, image: { src: png(30, 40, [0, 90, 0]), aspect: 0.75, asUploaded: true, library: LIB("BC", "الارقام", "3fb7e276-5f5c-46eb-94fc-99abc03465e2") } },
            { id: "e-up", kind: "image", text: "", placement: "rightChest", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null, inZone: { scale: 0.5, x: -0.2, y: 0.1 }, image: { src: png(64, 64, [200, 200, 0]), aspect: 1, processed: { widthPx: 64, heightPx: 64 }, original: { src: png(64, 64, [200, 200, 0]), fileName: "logo.png", mimeType: "image/png", widthPx: 64, heightPx: 64 } } },
            {
              id: "e-text", kind: "text", text: "CLASS OF\r\n2027", placement: "backQuote", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: "red", image: null,
              textStyle: { fontId: "montserrat", fontName: "Montserrat", fallbackFontIds: [], alignment: "center", direction: "ltr", aspect: 3.1, fitScale: 0.8 },
            },
          ],
        },
      },
    ],
  };
}

const build = (order, master = MASTER, extra = {}) =>
  S.buildManufacturingSpec({ order, lineIndex: 0, master, masterFile: { file: "garment-spec/jacketek-master-spec-v0.1.json", sha256: null }, designId: "D-000000000000", revision: "RFQ-01", createdAt: "2026-10-08T12:00:00.000Z", ...extra });
const allFiles = (spec) => Object.fromEntries(spec.artwork.map((a) => [a.elementId, { artwork: `artwork/${a.artworkId}.png`, original: null }]));
const validate = (spec, opts = {}) => S.validateManufacturingSpec(spec, { masterPomIds: MASTER.poms.map((p) => p.id), ...opts });
const codes = (v, sev = "errors") => v[sev].map((i) => i.code);
const withFiles = (order) => {
  const first = build(order);
  return build(order, MASTER, { files: allFiles(first) });
};

describe("schema / provenance", () => {
  test("a valid order builds a valid spec (no errors)", () => {
    const v = validate(withFiles(modernOrder()));
    assert.deepEqual(codes(v), []);
    assert.ok(v.warnings.length > 0, "an RFQ always has open items");
  });
  test("missing required data is an error (size, material)", () => {
    const o = modernOrder();
    o.items[0].size = null;
    o.items[0].customization.size = null;
    delete o.items[0].customization.materials.body;
    const v = validate(withFiles(o));
    assert.ok(codes(v).includes("MISSING_SIZE"));
    assert.ok(codes(v).includes("MISSING_MATERIAL"));
  });
  test("an unknown POM is an error", () => {
    const spec = withFiles(modernOrder());
    spec.measurements.poms.push({ ...spec.measurements.poms[1], id: "Z99" });
    assert.ok(codes(validate(spec)).includes("UNKNOWN_POM"));
  });
  test("provisional / reference measurements keep their provenance; unknowns stay null", () => {
    const spec = build(modernOrder());
    const b01 = spec.measurements.poms.find((p) => p.id === "B01");
    assert.equal(b01.values.M.value, MASTER.referenceValues.values.B01.M.cm);
    assert.equal(b01.values.M.status, "VERIFIED_SOURCE");
    assert.equal(b01.values.L.status, "DERIVED_FROM_VERIFIED_SOURCE");
    assert.equal(b01.values.M.approved, false);
    assert.equal(b01.values.M.sourceValue.value, 49);
    const b02 = spec.measurements.poms.find((p) => p.id === "B02");
    for (const f of Object.values(b02.values)) {
      assert.equal(f.value, null);
      assert.equal(f.status, "TO_MEASURE_ON_SAMPLE");
    }
    // No sleeve target is invented.
    assert.ok(!spec.measurements.provisionalTargets.some((t) => /sleeve/i.test(t.measurement)));
    const chest = spec.measurements.provisionalTargets.find((t) => t.relatedPom === "B01");
    assert.deepEqual(chest.field.range, MASTER.provisionalTargetRangeM.chestHalfFlatCm);
    assert.equal(chest.field.value, null);
  });
  test("an approved measurement can't appear in an RFQ (and can't be set automatically)", () => {
    const spec = withFiles(modernOrder());
    const b01 = spec.measurements.poms.find((p) => p.id === "B01");
    b01.values.M = { ...b01.values.M, status: "APPROVED_PRODUCTION", approved: true };
    assert.ok(codes(validate(spec)).includes("PRODUCTION_APPROVAL"));
    spec.documentStatus.productionApproved = true;
    assert.ok(validate(spec).errors.some((e) => e.path === "documentStatus"));
  });
  test("a number under an open status, or a value without a source, is an error", () => {
    const spec = withFiles(modernOrder());
    spec.measurements.poms.find((p) => p.id === "B02").values.M.value = 30;
    spec.garment.closure.snapCount.value = 7;
    const v = validate(spec);
    assert.ok(v.errors.filter((e) => e.code === "VALUE_WITHOUT_SOURCE").length >= 2);
  });
});

describe("configurator mapping", () => {
  const spec = () => build(modernOrder());
  test("garment colours, materials, size, snaps", () => {
    const s = spec();
    assert.equal(s.garment.size.value, "M");
    assert.equal(s.garment.size.status, "CUSTOMER_SELECTED");
    assert.equal(s.garment.bodyMaterial.value, "Cotton Fabric"); // customer-facing name, internal id kept in the note
    assert.match(s.garment.bodyMaterial.note, /"felt"/);
    assert.equal(s.garment.sleeveMaterial.value, "Leather");
    assert.equal(s.colourway.find((c) => c.role === "Body").colourId.value, "fabric-navy");
    assert.equal(s.colourway.find((c) => c.role === "Body").name, "Navy Blue");
    assert.equal(s.colourway.find((c) => c.role === "Rib — collar, cuffs, waistband (base)").colourId.value, "fabric-red");
    assert.equal(s.garment.closure.snapFinish.value, "Gold finish");
    assert.equal(s.garment.closure.snapCount.value, null);
    assert.ok(s.colourway.every((c) => c.physicalReference.value === null), "no Pantone is invented");
    assert.ok(!/dropped/i.test(s.style.fit.value), "fit name only: shoulder construction is open");
  });
  test("text keeps its exact line breaks, font and colour", () => {
    const t = spec().artwork.find((a) => a.artworkType === "TEXT");
    assert.equal(t.text.content, "CLASS OF\n2027");
    assert.deepEqual(t.text.lines, ["CLASS OF", "2027"]);
    assert.equal(t.text.lineCount, 2);
    assert.equal(t.text.characterCount, 12);
    assert.equal(t.text.font, "Montserrat");
    assert.equal(t.threads[0].threadId.value, "red");
    assert.equal(t.zoneId, "backQuote");
  });
  test("uploads, ready-made, numbers and Front Letters keep their type and source", () => {
    const s = spec();
    const by = (z) => s.artwork.find((a) => a.zoneId === z);
    assert.equal(by("rightChest").artworkType, "UPLOAD");
    assert.equal(by("rightChest").source.originalFileName, "logo.png");
    assert.equal(by("mainBack").artworkType, "READY_MADE");
    assert.equal(by("mainBack").source.libraryTitleEn, "Back designs");
    assert.equal(by("rightSleeveUpper").artworkType, "NUMBER_YEAR");
    const fl = by("leftChest");
    assert.equal(fl.artworkType, "FRONT_LETTERS");
    assert.deepEqual([fl.frontLetters.letter1, fl.frontLetters.letter2], ["J", "K"]);
  });
  test("Fill / Outline: chosen, as designed, and unknown design colours are kept apart; Original stays a mode", () => {
    const s = spec();
    const fl = s.artwork.find((a) => a.zoneId === "leftChest");
    assert.equal(fl.colourMode, "CUSTOM");
    const slot = (r) => fl.threads.find((t) => t.role === r);
    assert.equal(slot("Fill").threadId.value, "navy");
    assert.equal(slot("Fill").threadId.status, "CUSTOMER_SELECTED");
    assert.equal(slot("Outline").threadId.value, "gold");
    assert.equal(slot("Inner line").threadId.value, "gray");
    assert.equal(slot("Inner line").threadId.status, "SYSTEM_DERIVED");
    assert.equal(slot("Inner line").asDesigned, true);
    const back = s.artwork.find((a) => a.zoneId === "mainBack");
    assert.equal(back.colourMode, "ORIGINAL");
    // A slot with no thread of its own: TBD (design colour kept), never a guessed thread.
    const o = modernOrder();
    delete o.items[0].customization.embroidery[0].image.colourway.colours.outline;
    const out = build(o).artwork[0].threads.find((t) => t.role === "Outline");
    assert.equal(out.threadId.value, null);
    assert.equal(out.threadId.status, "TBD_SUPPLIER_PROPOSAL");
    assert.equal(out.hex, "#000000");
  });
  test("scale and offsets stay normalised (shares of the zone), never pixels", () => {
    const s = spec();
    const fl = s.artwork.find((a) => a.zoneId === "leftChest").placement;
    assert.equal(fl.normalizedScale, 0.7);
    assert.equal(fl.normalizedOffsetX, 0.1);
    assert.equal(fl.normalizedOffsetY, -0.05);
    const up = s.artwork.find((a) => a.zoneId === "rightChest").placement;
    assert.equal(up.normalizedScale, 0.5);
    assert.equal(up.normalizedOffsetX, -0.2);
  });
});

describe("zone mapping", () => {
  test("a valid zone without approved dimensions: physical placement pending, no cm invented", () => {
    const a = build(modernOrder()).artwork.find((x) => x.zoneId === "leftChest");
    assert.equal(a.placement.status, "PENDING_MASTER_ZONE_DIMENSIONS");
    for (const k of ["finishedWidthCm", "finishedHeightCm", "physicalOffsetXCm", "physicalOffsetYCm"]) {
      assert.equal(a.placement[k].value, null);
      assert.equal(a.placement[k].note, "PENDING MASTER ZONE DIMENSIONS");
    }
    assert.equal(a.placement.configuratorSizeCm.status, "SYSTEM_DERIVED");
  });
  test("every zone carries its normalised placement and allowed content; the approved back ratios; no zone cm", () => {
    const zones = build(modernOrder()).embroideryZones;
    assert.equal(zones.length, 10);
    for (const z of zones) {
      const n = z.configuratorReference.normalised;
      assert.ok(n && (n.kind === "body" || n.kind === "sleeve"), `${z.zoneId} normalised`);
      assert.equal(n.kind === "sleeve", z.side === "leftSleeve" || z.side === "rightSleeve");
      assert.equal(z.zoneWidthCm.value, null);
      assert.equal(z.zoneHeightCm.value, null);
      assert.equal(z.approved, false);
    }
    const by = Object.fromEntries(zones.map((z) => [z.zoneId, z]));
    assert.deepEqual(by.mainBack.configuratorReference.normalised, { kind: "body", u: 0, v: 0.43, w: 0.8183, h: 0.52, aspect: 1.0278 });
    assert.equal(by.backQuote.configuratorReference.normalised.v, 0.8125);
    assert.equal(by.backQuote.allowedContent, "TEXT_ONLY");
    assert.equal(by.leftChest.allowedContent, "DESIGN_OR_TEXT");
    assert.equal(by.leftChest.configuratorReference.normalised.u, -by.rightChest.configuratorReference.normalised.u);
  });
  test("every drawn zone box keeps the website box's proportions (all 10 zones)", async () => {
    const { zoneOnFlat, zoneOnSleeve } = await import("../../server/rfq/flats.mjs");
    for (const z of build(modernOrder()).embroideryZones) {
      const n = z.configuratorReference.normalised;
      const [bw, bh] = z.configuratorReference.boxCm;
      assert.ok(Math.abs(n.aspect - bw / bh) < 0.002, `${z.zoneId}: aspect ${n.aspect} = website box ${bw} × ${bh}`);
      const box = z.side === "leftSleeve" || z.side === "rightSleeve" ? zoneOnSleeve(z) : zoneOnFlat(z, z.side);
      assert.ok(Math.abs(box.w / box.h - n.aspect) < 1e-9, `${z.zoneId}: drawn W:H ${box.w / box.h} ≠ ${n.aspect}`);
    }
  });
  test("the legacy production-drawing size chart never reaches the RFQ", () => {
    for (const dir of [join("server", "rfq"), join("server", "rfq", "techflat"), join("src", "features", "techpack")])
      for (const f of readdirSync(dir).filter((x) => /\.(mjs|ts)$/.test(x)))
        assert.doesNotMatch(readFileSync(join(dir, f), "utf8"), /official_size_chart|production-drawing\/data/, `${dir}/${f} reads the legacy chart`);
    assert.doesNotMatch(JSON.stringify(build(modernOrder())), /official size chart/i);
  });
  test("an unknown zone is an error", () => {
    const o = modernOrder();
    o.items[0].customization.embroidery[1].placement = "elbowPatch";
    assert.ok(codes(validate(withFiles(o))).includes("UNKNOWN_ZONE"));
  });
  test("known physical zone dimensions convert the customer's placement to cm", () => {
    const master = clone(MASTER);
    const z = master.embroideryZones.zones.find((x) => x.zoneId === "leftChest");
    z.lockFields = { maxWidthCm: 9, maxHeightCm: 9, xReferenceCm: 10, yReferenceCm: 15 };
    const a = build(modernOrder(), master).artwork.find((x) => x.zoneId === "leftChest");
    assert.equal(a.placement.status, "PHYSICAL_FROM_MASTER_ZONE");
    // Fitted into 9 × 9 at aspect 1.75: 9 × 5.14; × scale 0.7 → 6.3 × 3.6; offset 0.1 × 9 / −0.05 × 9.
    assert.equal(a.placement.finishedWidthCm.value, 6.3);
    assert.equal(a.placement.finishedHeightCm.value, 3.6);
    assert.equal(a.placement.physicalOffsetXCm.value, 0.9);
    assert.equal(a.placement.physicalOffsetYCm.value, Math.round(-0.05 * 9 * 10) / 10);
    assert.equal(a.placement.finishedWidthCm.status, "SYSTEM_DERIVED");
    const zone = build(modernOrder(), master).embroideryZones.find((x) => x.zoneId === "leftChest");
    assert.equal(zone.zoneWidthCm.status, "PROVISIONAL_TARGET");
    assert.equal(zone.approved, false);
  });
});

describe("legacy data", () => {
  test("an older order (free placement, legacy zones, text without a font) builds without crashing", () => {
    const spec = build(LEGACY_ORDER);
    assert.equal(spec.artwork.length, 3);
    const v = validate(build(LEGACY_ORDER, MASTER, { files: Object.fromEntries(spec.artwork.map((a) => [a.elementId, { artwork: a.artworkType === "TEXT" ? null : "artwork/x.png", original: null }])) }));
    assert.ok(codes(v, "warnings").includes("LEGACY_PLACEMENT"));
    assert.ok(!codes(v).includes("UNKNOWN_ZONE"));
    const legacyText = spec.artwork.find((a) => a.zoneId === "upperBack");
    assert.equal(legacyText.placement.rotationDeg.value, -4);
    assert.match(legacyText.text.font, /Not recorded/);
  });
});

describe("measurement strategy (Master Spec v0.2)", () => {
  test("the RFQ still reads v0.1; v0.2 keeps v0.1 intact, approves nothing and flags the unverified supplied chart", () => {
    assert.match(readFileSync(join(ROOT, "server/rfq/generate.mjs"), "utf8"), /MASTER_SPEC_FILE = "garment-spec\/jacketek-master-spec-v0\.1\.json"/);
    const v2Text = readFileSync(join(ROOT, "garment-spec/jacketek-master-spec-v0.2.json"), "utf8");
    assert.equal(v2Text, readFileSync(join(ROOT, "reports/JACKETEK Master Garment Spec Validation Draft v0.2.json"), "utf8"), "garment-spec v0.2 is a verbatim copy of the report");
    const v2 = JSON.parse(v2Text);
    assert.equal(v2.productionApproved, false);
    assert.doesNotMatch(v2Text, /APPROVED_PRODUCTION/);
    assert.deepEqual(v2.poms.map(({ measurementPlan, ...p }) => p), MASTER.poms, "every v0.1 POM and its provenance unchanged");
    assert.ok(v2.poms.every((p) => p.measurementPlan.approvalState === "NOT_APPROVED"));
    assert.deepEqual(v2.referenceValues, MASTER.referenceValues);
    assert.equal(v2.sources.find((s) => s.id === "SUP").verified, false);
    assert.ok(v2.secondaryVisualReferenceLimitation.flags.includes("SOURCE IMAGE CURRENTLY UNAVAILABLE"));
    assert.equal(v2.methodConflicts.length, 8);
    assert.equal(v2.sampleValidationWorkflow.steps.length, 8);
    const plan = Object.fromEntries(v2.poms.map((p) => [p.id, p.measurementPlan]));
    assert.deepEqual(Object.keys(plan).filter((id) => plan[id].status === "PROVISIONAL_TARGET").sort(), ["B01", "B06"]);
    assert.deepEqual([plan.B01.proposedTargetM.rangeMin, plan.B01.proposedTargetM.rangeMax, plan.B06.proposedTargetM.rangeMin, plan.B06.proposedTargetM.rangeMax], [61, 62.2, 67.3, 68]);
    // K1 = DROPPED_SHOULDER: across shoulder is set by the pattern maker; the set-in range stays a reference only.
    assert.deepEqual(v2.resolvedConflicts.find((c) => c.id === "K1"), { ...v2.resolvedConflicts.find((c) => c.id === "K1"), status: "RESOLVED", decision: "DROPPED_SHOULDER" });
    assert.deepEqual(v2.conflicts, MASTER.conflicts, "v0.1 conflict text kept verbatim");
    assert.equal(plan.B09.status, "TBD_PATTERN_MAKER");
    assert.equal(plan.B09.proposedTargetM, null);
    assert.deepEqual([v2.setInReferenceM.B09.rangeMin, v2.setInReferenceM.B09.rangeMax], [49.5, 50]);
    assert.equal(plan.S01.proposedTargetM, null, "no sleeve target");
    assert.equal(plan.S02.proposedTargetM, null, "no sleeve target");
    assert.ok(v2.poms.every((p) => p.measurementPlan.evidence.siGraphics !== "PHYSICAL_MEASUREMENT"), "S.i. example values are never physical measurements");
  });
  test("K2 materials: partially resolved — design intent only, no specification value, v0.1 BOM untouched", () => {
    const v2 = JSON.parse(readFileSync(join(ROOT, "garment-spec/jacketek-master-spec-v0.2.json"), "utf8"));
    assert.deepEqual(v2.bom, MASTER.bom);
    assert.deepEqual(v2.construction, MASTER.construction);
    assert.equal(v2.partiallyResolvedConflicts.find((c) => c.id === "K2").status, "PARTIALLY_RESOLVED");
    assert.ok(!v2.resolvedConflicts.some((c) => c.id === "K2"));
    const comp = Object.fromEntries(v2.materialConstructionPlan.components.map((c) => [c.id, c]));
    assert.equal(Object.keys(comp).length, 12);
    assert.equal(comp["K2.1"].material.value, "Cotton Fabric");
    assert.equal(comp["K2.2"].material.value, "Leather");
    assert.equal(comp["K2.2"].spec.leatherTypeOrAlternative.status, "TBD_SUPPLIER_PROPOSAL");
    assert.equal(comp["K2.3"].material.value, null, "lining composition not invented");
    assert.match(v2.materialConstructionPlan.leatherPolicy.alternatives, /^ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT$/, "synthetic / PU never replaces Leather silently");
    assert.deepEqual(v2.materialConstructionPlan.contradictions.filter((x) => x.status.startsWith("OPEN")).map((x) => x.id), ["X-01", "X-03", "X-04", "X-05", "X-13"]);
    for (const c of Object.values(comp)) {
      assert.equal(c.approvalState, "NOT_APPROVED");
      for (const [k, f] of Object.entries(c.spec)) if (!["K2.8.pocketType", "K2.10.sleeveAttachment"].includes(`${c.id}.${k}`)) assert.equal(f.value, null, `${c.id}.${k}`);
    }
    assert.ok(v2.materialConstructionPlan.embroideryConstruction.types.every((t) => Object.values(t.fields).every((f) => f.value === null)));
  });
});

describe("RFQ PDF (needs Chrome / Edge)", () => {
  let out, gen;
  before(async () => {
    out = mkdtempSync(join(tmpdir(), "jk-rfq-test-"));
    gen = await import("../../server/rfq/generate.mjs");
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  const pdfOrder = () => {
    const o = modernOrder();
    // No Front Letters / colourway here: those are rebuilt from the real library on the server.
    o.items[0].customization.embroidery = o.items[0].customization.embroidery.filter((e) => e.id !== "e-fl");
    return o;
  };

  test("generates JSON + PDF, never overwrites, and refuses structural errors", { timeout: 240000 }, async () => {
    const r1 = await gen.generateRFQTechPack(pdfOrder(), { outRoot: out });
    assert.equal(r1.revision, "RFQ-01");
    assert.ok(readFileSync(r1.pdf).subarray(0, 5).toString() === "%PDF-");
    const spec = JSON.parse(readFileSync(r1.json, "utf8"));
    assert.equal(spec.meta.documentStatus, "NOT_FOR_BULK_PRODUCTION");
    assert.equal(spec.validation.errors.length, 0);
    assert.ok(r1.pages >= 10, `pages: ${r1.pages}`);
    for (const a of spec.artwork) assert.ok(existsSync(join(r1.dir, a.files.artwork)), `artwork file ${a.files.artwork}`);
    assert.ok(existsSync(join(r1.dir, "previews", "flat-front.svg")));
    // PDF metadata title carries the RFQ status.
    assert.match(readFileSync(r1.pdf).toString("latin1"), /NOT FOR BULK PRODUCTION|\(\\376\\377|<FEFF/);

    const r2 = await gen.generateRFQTechPack(pdfOrder(), { outRoot: out });
    assert.equal(r2.revision, "RFQ-02");
    assert.ok(existsSync(r1.pdf), "RFQ-01 kept");
    const spec2 = JSON.parse(readFileSync(r2.json, "utf8"));
    assert.deepEqual(spec2.revisionHistory.map((h) => h.revision), ["RFQ-01", "RFQ-02"]);

    const bad = pdfOrder();
    bad.items[0].size = null;
    bad.items[0].customization.size = null;
    await assert.rejects(gen.generateRFQTechPack(bad, { outRoot: out }), (e) => e instanceof gen.RfqError && e.issues.some((i) => i.code === "MISSING_SIZE"));
    const dir = join(out, gen.designIdOf(bad.items[0]));
    assert.ok(!existsSync(dir) || !readdirSync(dir).some((d) => /^RFQ-/.test(d)), "nothing written for an invalid spec");
  });

  test("document content: sections, status on every page, TBD wording, no approval wording", async () => {
    const { renderRfqHtml } = await import("../../server/rfq/render.mjs");
    const latest = gen.latestRfq(out, gen.designIdOf(pdfOrder().items[0]));
    const spec = JSON.parse(readFileSync(join(latest.dir, "manufacturing-spec.json"), "utf8"));
    const { html } = renderRfqHtml(spec, { artDir: latest.dir });
    for (const section of ["Technical flats", "Colourway", "Bill of materials", "Measurement specification — POM", "Grading / size table", "Construction details", "Embroidery zone register", "Quotation request", "Open items / to be confirmed", "Revision history / document control"])
      assert.ok(html.includes(section), `section ${section}`);
    const pages = html.split('<section class="page').length - 1;
    assert.equal(html.split('<div class="ph-r status">RFQ — NOT FOR BULK PRODUCTION</div>').length - 1, pages, "status in every header");
    assert.equal(html.split("RFQ — NOT FOR BULK PRODUCTION · Not a production tech pack").length - 1, pages, "status in every footer");
    assert.equal(html.split("<h2>Artwork &amp; placement — ").length - 1, spec.artwork.length, "one artwork page per artwork");
    assert.ok(html.includes("TBD — to be confirmed on sample"));
    assert.ok(html.includes("TBD — supplier"));
    assert.ok(html.includes("PROVISIONAL PLACEMENT — PHYSICAL ANCHORS TO BE CONFIRMED ON SAMPLE"));
    // Zone ratios are documented as ratios; the configurator's cm estimate is not printed.
    assert.ok(html.includes("Embroidery placement schedule"));
    assert.ok(html.includes("NORMALIZED PLACEMENT — NOT PHYSICAL SIZE"));
    assert.doesNotMatch(html, /Size estimate for quoting/);
    for (const a of spec.artwork) {
      const [w, h] = a.placement.configuratorSizeCm.value ?? [];
      if (w !== undefined) assert.ok(!html.includes(`${w.toFixed(1)} × ${h.toFixed(1)} cm`), `${a.artworkId}: configurator estimate printed`);
    }
    // Provisional M targets sit next to the reference values (table and drawings).
    assert.ok(html.includes("target ½ 61–62.2 cm"));
    assert.ok(html.includes("target 49.5–50 cm"));
    // Canonical flat everywhere; POM diagrams use the table's ids; no procedural flat left.
    assert.ok(html.includes('id="layer-silhouette"'), "canonical flat in the document");
    for (const f of ["render.mjs", "flats.mjs", "generate.mjs"]) assert.doesNotMatch(readFileSync(join("server", "rfq", f), "utf8"), /varsityFlat|techflat\/(geometry|draw|pommap)/, `${f} imports a procedural flat`);
    const pomPages = html.split('<section class="page').filter((s) => /<div class="ph-c">POM diagram — /.test(s));
    assert.equal(pomPages.length, 5, "five POM diagram pages");
    for (const s of pomPages) {
      const drawn = new Set([...s.slice(s.indexOf("pom-draw"), s.indexOf("pom-table")).matchAll(/>([BSRCFP]\d\d)(?:\/([BSRCFP]\d\d))?[ <]/g)].flatMap((m) => [m[1], m[2]].filter(Boolean)));
      const listed = new Set([...s.slice(s.indexOf("pom-table")).matchAll(/<b>([BSRCFPL]\d\d)<\/b>/g)].map((m) => m[1]));
      assert.deepEqual([...drawn].sort(), [...listed].sort(), "diagram and table show the same POM ids");
      for (const id of listed) assert.ok(spec.measurements.poms.some((p) => p.id === id), `${id} is a spec POM`);
    }
    // Approval wording only ever appears negated.
    const text = html.replace(/<[^>]+>/g, " ");
    for (const m of text.matchAll(/(production[ -]approved|approved for (bulk )?production)/gi)) {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      assert.match(before, /(not|NOT|never|only after)[^.]*$/, `un-negated approval wording: "${before}${m[0]}"`);
    }
    // The text artwork prints exactly as entered, line by line.
    assert.ok(html.includes("<div>CLASS OF</div><div>2027</div>"));
  });
});

describe("M development sample request (MSR-01)", () => {
  const V2 = JSON.parse(readFileSync(join(ROOT, "garment-spec/jacketek-master-spec-v0.2.json"), "utf8"));
  let R, V, req;
  before(async () => {
    R = await import("../sample-development/request.mjs");
    V = await import("../sample-development/variance.mjs");
    req = R.buildRequest(V2, []);
  });

  test("targets: only B01 / B06 provisional; no across-shoulder or sleeve target; nothing filled", () => {
    assert.deepEqual(req.targets.map((t) => [t.id, t.min, t.max, t.status, t.confidence]), [["B01", 61, 62.2, "PROVISIONAL_TARGET", "LOW"], ["B06", 67.3, 68, "PROVISIONAL_TARGET", "LOW"]]);
    const row = (id) => req.measurementSheet.find((r) => r.id === id);
    for (const id of ["B09", "B09-C", "S02", "S02-E", "S01", "S01-E"]) assert.equal(row(id).target, null, `${id} has a target`);
    assert.equal(row("B09").targetText, "TBD — PATTERN MAKER");
    assert.deepEqual(req.measurementSheet.filter((r) => r.pomId === "S02" || r.pomId === "S01").map((r) => r.id), ["S02", "S02-E", "S01", "S01-E"]);
    assert.ok(row("S02").howToMeasure.includes("CUFF SEAM") && row("S02-E").howToMeasure.includes("FINISHED CUFF EDGE"));
    for (const r of req.measurementSheet) {
      assert.equal(r.tolerance.value, null);
      assert.equal(r.tolerance.text, "TBD");
      assert.equal(r.patternProposed.value, null);
      assert.equal(r.sampleActual.value, null);
    }
    // Every v0.2 POM is on the sheet.
    for (const p of V2.poms) assert.ok(req.measurementSheet.some((r) => r.pomId === p.id), p.id);
    assert.equal(req.productionApproved, false);
    assert.doesNotMatch(JSON.stringify(req), /PRODUCTION_APPROVED|49\.5|90\.17|124\.46/);
  });

  test("materials: Leather intent kept, alternatives never replace it, no value proposed; return form has no approval", () => {
    assert.equal(req.designIntent.body, "Cotton Fabric");
    assert.equal(req.designIntent.sleeves, "Leather");
    assert.equal(req.materials.alternativeProposals.label, "ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT");
    assert.equal(req.materials.alternativeProposals.replacesDesignIntent, false);
    for (const s of req.materials.sections) for (const f of s.fields) assert.equal(f.value, null, `${s.id}.${f.key}`);
    for (const f of [...req.construction.pockets.fields, ...req.construction.sewing.fields]) assert.equal(f.value, null, f.key);
    for (const t of req.embroidery.tests) assert.equal(t.size.value, null);
    assert.equal(req.droppedShoulder.construction, "DROPPED SHOULDER");
    assert.deepEqual(req.droppedShoulder.parameters.map((p) => [p.id, p.value]), [["SC-1", null], ["SC-2", null], ["SC-3", null]]);
    const form = R.buildReturnForm(req);
    assert.doesNotMatch(JSON.stringify(Object.keys(form)) + JSON.stringify(form.measurements[0]), /approv/i);
    assert.equal(form.measurements.length, req.measurementSheet.length);
  });

  test("variance: actual − target only; no pass / fail without a tolerance", () => {
    const row = (id) => req.measurementSheet.find((r) => r.id === id);
    const S = R.VARIANCE_STATUS;
    const v = V.varianceFor(row("B01"), { sampleActual: 63.0, patternProposed: 62.0 });
    assert.equal(v.status, S.OUTSIDE);
    assert.equal(v.outsideBy, 0.8);
    assert.equal(v.actualMinusMin, 2);
    assert.equal(v.actualMinusPatternProposed, 1);
    assert.equal(V.varianceFor(row("B06"), { sampleActual: 67.5 }).status, S.WITHIN);
    assert.equal(V.varianceFor(row("B06"), { sampleActual: 67.5 }).outsideBy, 0);
    assert.equal(V.varianceFor(row("B06"), {}).status, S.REVIEW);
    assert.equal(V.varianceFor(row("B09"), { sampleActual: 55 }).status, S.NONE);
    assert.equal(V.varianceFor(row("S02"), { sampleActual: 50 }).status, S.NONE);
    assert.equal(V.varianceFor(row("S01"), { sampleActual: 80 }).status, S.REFERENCE);
    const rep = V.varianceReport(req, { measurements: [{ id: "B01", sampleActual: 61.5 }] });
    assert.equal(rep.rows.length, req.measurementSheet.length);
    assert.equal(rep.counts.WITHIN_TARGET_RANGE, 1);
    assert.doesNotMatch(JSON.stringify(rep), /"(PASS|FAIL|PRODUCTION_APPROVED)"/);
  });

  test("consistency: B01 half chest, four sleeve methods, welt material open, S01 / S01-E in the validation plan", () => {
    const b01 = req.measurementSheet.find((r) => r.id === "B01");
    assert.equal(b01.name, "Half Chest — Flat Width");
    assert.deepEqual([b01.derived.formula, b01.derived.measured], ["Flat Width × 2", false]);
    assert.equal(req.targets[0].quantity, "Half Chest — Flat Width");
    assert.match(R.buildReturnForm(req).measurements[0].report, /Flat width only/);
    assert.ok(!req.measurementSheet.some((r) => /circumference/i.test(r.id)), "no separate circumference row");
    const welt = req.construction.pockets.fields.find((f) => f.key === "weltMaterial");
    assert.equal(welt.fill, "FACTORY TO PROPOSE / JACKETEK TO APPROVE AFTER SAMPLE");
    const fmr = readFileSync(join(ROOT, "garment-spec/factory-material-proposal-request.md"), "utf8");
    assert.doesNotMatch(fmr, /welts intended in the sleeve leather|welt material matching the leather sleeves/);
    assert.match(fmr, /Welt material: \*\*FACTORY TO PROPOSE \/ JACKETEK TO APPROVE\*\*/);
    const plan = readFileSync(join(ROOT, "garment-spec/m-sample-validation-plan.md"), "utf8");
    assert.doesNotMatch(plan, /S01 via the shoulder point AND straight/);
    assert.match(plan, /S01 = centre back → cuff seam AND S01-E = centre back → finished cuff edge/);
    assert.match(plan, /\| S01-E Sleeve — centre back → finished cuff edge \(COMPARISON ONLY\)/);
  });

  test("OD-03 resolved: factory sharing of derived drawings recorded as user-confirmed; remaining decisions open", () => {
    assert.equal(req.drawingLicence.status, "RESOLVED");
    assert.equal(req.drawingLicence.record, "USER-CONFIRMED WRITTEN PERMISSION FROM S.i. GRAPHICS FOR FACTORY SHARING OF DERIVED TECHNICAL DRAWINGS");
    assert.match(req.drawingLicence.pdfNote, /EDITABLE SOURCE TEMPLATE FILES ARE NOT INCLUDED/);
    assert.equal(req.drawingLicence.restrictions.length, 4);
    assert.ok(!req.openDecisions.some((d) => d.id === "OD-03"), "OD-03 is not open");
    assert.deepEqual(req.resolvedDecisions.map((d) => d.id), ["OD-03"]);
    const od = Object.fromEntries(req.openDecisions.map((d) => [d.id, d]));
    for (const id of ["OD-01", "OD-02", "OD-04", "OD-05", "OD-06"]) assert.ok(od[id], id);
    assert.equal(od["OD-05"].status, "PATTERN MAKER TO SET");
    assert.match(od["OD-06"].status, /after the factory proposals/);
    for (const d of req.openDecisions) assert.doesNotMatch(d.status, /APPROVED|RESOLVED/);
  });

  test("the customer RFQ still reads Master Spec v0.1", () => {
    assert.match(readFileSync(join(ROOT, "server/rfq/generate.mjs"), "utf8"), /MASTER_SPEC_FILE = "garment-spec\/jacketek-master-spec-v0\.1\.json"/);
  });
});

describe("Development size chart v0.1 (approved for development use)", () => {
  const chart = JSON.parse(readFileSync(join(ROOT, "garment-spec/jacketek-development-size-chart-v0.1.json"), "utf8"));
  const V2 = JSON.parse(readFileSync(join(ROOT, "garment-spec/jacketek-master-spec-v0.2.json"), "utf8"));
  const row = (id) => chart.table.find((r) => r.id === id);
  const near = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

  test("M values: B01 62.0, B01-C 124.0, B06 68.0, SC-1 5.0, B09 ≈ 59.5, S02-E ≈ 60.4", () => {
    assert.equal(row("B01").bySize.M, 62.0);
    assert.equal(row("B01-C").bySize.M, 124.0);
    assert.equal(row("B06").bySize.M, 68.0);
    assert.equal(chart.shoulderExtension.valuePerSideCm, 5.0);
    assert.equal(row("SC-1").bySize.M, 5.0);
    near(row("B09").bySize.M, 59.5);
    near(row("S02-E").bySize.M, 60.4);
    assert.deepEqual(chart.core.map((d) => [d.id, d.class]), [["B01", "DEVELOPMENT_TARGET"], ["B06", "DEVELOPMENT_TARGET"]]);
  });

  test("formulas hold for every size: B09 = Golden Bear + 10, S02-E = GB CB sleeve − ½ B09, B03 = B01, B01-C = 2 × B01", () => {
    const gb = Object.fromEntries(chart.goldenBearReference.map((r) => [r.id, r.bySize]));
    for (const s of chart.sizes) {
      near(row("B09").bySize[s], gb.B09[s] + 10, 0.06);
      near(row("S02-E").bySize[s], gb.S01[s] - (gb.B09[s] + 10) / 2, 0.06);
      assert.equal(row("B03").bySize[s], row("B01").bySize[s]);
      near(row("B01-C").bySize[s], 2 * row("B01").bySize[s], 0.001);
    }
    assert.deepEqual(chart.sizes, ["XS", "S", "M", "L", "XL", "XXL"]);
  });

  test("S02 depends on S09; armhole stays with the pattern maker; S01 is reference only", () => {
    assert.ok(chart.sizes.every((s) => row("S02").bySize[s] === null), "S02 has no number");
    assert.match(row("S02").formula, /S02-E − S09/);
    const armhole = chart.patternMaker.find((p) => p.ids.includes("B14"));
    assert.ok(armhole && armhole.ids.includes("SC-3") && /PATTERN_MAKER_SET \+ SAMPLE_VALIDATION/.test(armhole.what));
    assert.ok(!chart.table.some((r) => r.id === "B14"), "no armhole number");
    assert.match(row("S01").label, /REFERENCE ONLY/);
    assert.equal(V2.poms.find((p) => p.id === "B14").measurementPlan.developmentValue.status, "PATTERN_MAKER_SET + SAMPLE_VALIDATION");
  });

  test("approved for development use only — nothing production approved; v0.2 carries it, v0.1 untouched", () => {
    assert.equal(chart.status, "APPROVED FOR DEVELOPMENT USE — NOT PRODUCTION APPROVED");
    assert.equal(chart.approval.developmentUse.approved, true);
    assert.equal(chart.approval.production.approved, false);
    assert.equal(chart.productionApproved, false);
    assert.doesNotMatch(JSON.stringify(chart), /PRODUCTION_APPROVED|"production":\{"approved":true/);
    assert.deepEqual(V2.developmentSizeChart.table, chart.table);
    assert.equal(V2.productionApproved, false);
    assert.equal(V2.poms.find((p) => p.id === "B09").measurementPlan.developmentValue.rows[0].bySize.M, row("B09").bySize.M);
    assert.equal(MASTER.productionApproved, false);
    assert.equal(MASTER.developmentSizeChart, undefined, "v0.1 is not changed");
  });
});

describe("Development tech pack from the live design (needs Chrome / Edge)", () => {
  let D, I, Z, F, out, r1;
  const chart = JSON.parse(readFileSync(join(ROOT, "garment-spec/jacketek-development-size-chart-v0.1.json"), "utf8"));
  before(async () => {
    D = await import("../../server/techpack/development.mjs");
    I = await import("../../server/techpack/designInput.mjs");
    Z = await import("../../server/techpack/developmentSizes.mjs");
    F = await import("./devDesignFixture.mjs");
    out = mkdtempSync(join(tmpdir(), "jk-dev-"));
  });
  after(() => out && rmSync(out, { recursive: true, force: true }));

  test("selected size maps to its own development measurements (never M by default)", () => {
    for (const size of chart.sizes) {
      const m = Z.developmentMeasurements(size);
      for (const r of m.rows) assert.equal(r.value, chart.table.find((x) => x.id === r.id).bySize[size], `${size} ${r.id}`);
      assert.equal(m.productionApproved, false);
    }
    assert.notEqual(Z.developmentMeasurements("L").rows[0].value, Z.developmentMeasurements("M").rows[0].value);
    assert.equal(Z.developmentMeasurements("XL").rows.find((r) => r.id === "S02").value, null, "S02 stays formula-only");
    assert.throws(() => Z.developmentMeasurements("3XL"));
  });

  test("asset / path injection is rejected before anything is read", () => {
    const base = F.devDesign("M");
    const bad = (mutate, why) => {
      const c = structuredClone(base);
      mutate(c);
      assert.throws(() => I.validateDevelopmentDesign(c, S), I.DesignInputError, why);
    };
    bad((c) => (c.embroidery[1].image.src = "/embroidery-library/../../server-data/jacketek.db"), "library path traversal");
    bad((c) => (c.embroidery[1].image.src = "/embroidery-library/assets/%2e%2e/%2e%2e/package.json"), "encoded traversal");
    bad((c) => (c.embroidery[1].image.library.asset = "/embroidery-library/assets/../library.json"), "asset not the library entry");
    bad((c) => (c.embroidery[1].image.library.id = "ojisan:not-a-design"), "unknown library design");
    bad((c) => (c.embroidery[3].image.src = "file:///C:/Windows/win.ini"), "file URL upload");
    bad((c) => (c.embroidery[3].image.src = "https://example.com/x.png"), "remote URL upload");
    bad((c) => (c.embroidery[3].image.src = "C:/JACKETEK_PORTABLE/.env.local"), "plain path upload");
    bad((c) => (c.embroidery[1].image.src = "data:image/png;base64,AAAA"), "library design replaced by browser data");
    bad((c) => (c.embroidery[0].image.frontLetters.letter1 = "../"), "front letters");
    bad((c) => (c.size = null), "no size");
    bad((c) => (c.colours.body = "not-a-colour"), "unknown colour");
    bad((c) => (c.embroidery[0].placement = "../../x"), "unknown zone");
    bad((c) => Object.defineProperty(c, "__proto__", { value: { polluted: true }, enumerable: true }), "prototype key");
    assert.doesNotThrow(() => I.validateDevelopmentDesign(base, S));
    assert.equal(D.developmentPdfFile(out, "../..", "DEV-01"), null);
    assert.equal(D.developmentPdfFile(out, "D-000000000000", "../../x"), null);
  });

  test("live design → spec → drawing → PDF: every element round-trips; nothing approved; no cm; only used artwork", { timeout: 600000 }, async () => {
    const design = F.devDesign("L");
    r1 = await D.generateDevelopmentTechPack(design, { outRoot: out, testLabel: "AUTOMATED TEST" });
    const spec = r1.spec;
    assert.equal(r1.revision, "DEV-01");
    assert.ok(existsSync(r1.pdf) && r1.pages > 10);
    for (const f of ["design-config.json", "manufacturing-spec.json", "generation-report.json"]) assert.ok(existsSync(join(r1.dir, f)), f);
    for (const d of ["artwork", "previews", "source"]) assert.ok(existsSync(join(r1.dir, d)), d);
    // The frozen snapshot is the design as sent (text line breaks and all).
    assert.deepEqual(JSON.parse(readFileSync(join(r1.dir, "design-config.json"), "utf8")).config, design);
    // selected size → its measurements
    assert.equal(spec.garment.size.value, "L");
    assert.equal(spec.developmentMeasurements.selectedSize, "L");
    assert.equal(spec.developmentMeasurements.rows.find((r) => r.id === "B01").value, chart.table.find((r) => r.id === "B01").bySize.L);
    // colours / materials
    const cw = (role) => spec.colourway.find((c) => c.role === role);
    assert.equal(cw("Body").colourId.value, "fabric-burgundy");
    assert.equal(cw("Body").hex, S.ALL_COLOURS.find((c) => c.id === "fabric-burgundy").hex);
    assert.equal(cw("Sleeves").colourId.value, "leather-black");
    assert.equal(cw("Rib — collar, cuffs, waistband (base)").colourId.value, "fabric-white");
    assert.equal(cw("Snaps").colourId.value, "gold");
    assert.equal(spec.garment.bodyMaterial.value, "Cotton Fabric");
    assert.equal(spec.garment.sleeveMaterial.value, "Leather");
    const art = (id) => spec.artwork.find((a) => a.elementId === id);
    // Front Letters
    assert.equal(art("fx-fl").artworkType, "FRONT_LETTERS");
    assert.deepEqual([art("fx-fl").frontLetters.letter1, art("fx-fl").frontLetters.letter2, art("fx-fl").frontLetters.templateId], ["J", "K", F.FIXTURE_DESIGNS.frontLetters.designId]);
    // ready-library artwork
    assert.equal(art("fx-patch").source.designId, F.FIXTURE_DESIGNS.patch.designId);
    assert.equal(art("fx-patch").source.libraryId, F.FIXTURE_DESIGNS.patch.libraryId);
    // text, exact
    assert.equal(art("fx-text").text.content, "CLASS OF\n2027");
    assert.deepEqual(art("fx-text").text.lines, ["CLASS OF", "2027"]);
    // sleeve artwork in its zones
    assert.equal(art("fx-num").zoneId, "rightSleeveUpper");
    assert.equal(art("fx-patch").zoneId, "leftSleeveMiddle");
    // scale and offsets as the configurator shows them
    assert.deepEqual([art("fx-up").placement.normalizedScale, art("fx-up").placement.normalizedOffsetX, art("fx-up").placement.normalizedOffsetY], [0.6, -0.1, 0.08]);
    assert.equal(art("fx-num").placement.normalizedScale, 0.75);
    // fill / outline
    assert.equal(art("fx-text").threads[0].threadId.value, "red");
    if (F.FIXTURE_DESIGNS.back) assert.equal(art("fx-back").threads.find((t) => /fill/i.test(t.role))?.threadId.value, "gold");
    // normalised placement: design ↔ spec ↔ drawing QA all pass
    assert.ok(r1.report.qa.designToSpec.ok && r1.report.qa.designToSpec.checks.length > 30);
    assert.ok(r1.report.qa.specToDrawing.ok && r1.report.qa.specToDrawing.checks.length >= spec.artwork.length * 2);
    // no physical cm placement
    for (const a of spec.artwork) {
      assert.ok(!("configuratorSizeCm" in a.placement));
      for (const k of ["finishedWidthCm", "finishedHeightCm", "physicalOffsetXCm", "physicalOffsetYCm"]) assert.equal(a.placement[k].value, null);
    }
    for (const z of spec.embroideryZones) assert.deepEqual(Object.keys(z.configuratorReference).sort(), ["normalised", "note", "status"]);
    // nothing production approved; marks on every page; no legacy values
    assert.equal(spec.documentStatus.productionApproved, false);
    assert.equal(spec.meta.documentType, "DEVELOPMENT_TECH_PACK");
    assert.doesNotMatch(JSON.stringify(spec), /"approved":true|APPROVED_PRODUCTION|"productionApproved":true/);
    const html = readFileSync(join(r1.dir, "source", "development-tech-pack.html"), "utf8");
    for (const sec of html.split('<section class="page').slice(1)) for (const mark of ["DEVELOPMENT TECH PACK", "NOT FOR BULK PRODUCTION", "NOT PRODUCTION APPROVED"]) assert.ok(sec.includes(mark), mark);
    assert.doesNotMatch(html.replace(/<[^>]+>/g, " "), /\b(60|70|62)(\.0)? cm\b/, "no legacy chart values");
    // only the artwork this design uses
    const files = readdirSync(join(r1.dir, "artwork")).map((f) => `artwork/${f}`).sort();
    assert.deepEqual(files, [...r1.report.artworkFiles].sort());
    assert.equal(spec.artwork.length, design.embroidery.length);
    assert.ok(files.length <= spec.artwork.length * 2);
    // Revisions are never overwritten.
    const r2 = await D.generateDevelopmentTechPack(design, { outRoot: out, testLabel: "AUTOMATED TEST" });
    assert.equal(r2.designId, r1.designId);
    assert.equal(r2.revision, "DEV-02");
    assert.ok(existsSync(r1.pdf));
  });

  test("the customer RFQ still reads Master Spec v0.1; the development pack reads v0.2", () => {
    assert.match(readFileSync(join(ROOT, "server/rfq/generate.mjs"), "utf8"), /MASTER_SPEC_FILE = "garment-spec\/jacketek-master-spec-v0\.1\.json"/);
    assert.equal(D.DEV_MASTER_FILE, "garment-spec/jacketek-master-spec-v0.2.json");
  });
});
