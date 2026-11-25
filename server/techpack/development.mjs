// DEVELOPMENT TECH PACK — the live configurator design (JacketConfig) → Manufacturing Spec →
// technical drawings → PDF. SERVER-SIDE ONLY. Not a Production Tech Pack, not a customer RFQ.
//
//   <outRoot>/<designId>/DEV-NN/
//     JACKETEK-Development-Tech-Pack.pdf
//     design-config.json        the frozen design exactly as received (checked, production-only fields removed)
//     manufacturing-spec.json   built from that snapshot only
//     generation-report.json    round-trip QA: design ↔ spec ↔ drawing, files, page count
//     artwork/                  only the artwork this design uses
//     previews/                 base + coloured flats (SVG)
//     source/                   the printed HTML
//
// The same pipeline as the RFQ (server/rfq/generate.mjs): library files read from the embroidery
// library, Front Letters rebuilt from their template, text drawn with the configurator's own code,
// colourways rebuilt from their colour layers; the spec built by the website's shared
// buildManufacturingSpec, from an in-memory, unsaved line (no order is created or stored).
// Measurements: the approved development size chart, for the selected size. Revisions are never
// overwritten (DEV-01, DEV-02 …). The customer RFQ generator and Master Spec v0.1 are untouched.
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withColourways } from "../colourways.mjs";
import { withLibraryAssets } from "../libraryAssets.mjs";
import { withTextArtwork } from "../textArtwork.mjs";
import { loadShared } from "../tsModule.mjs";
import { canonicalFlat, fillsFor, sleeveSvg, viewSvg, zoneOnFlat, zoneOnSleeve } from "../rfq/flats.mjs";
import { decodeImageDataUrl, designIdOf } from "../rfq/generate.mjs";
import { validateDevelopmentDesign } from "./designInput.mjs";
import { developmentMeasurements } from "./developmentSizes.mjs";
import { renderDevelopmentHtml } from "./devRender.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEV_MASTER_FILE = "garment-spec/jacketek-master-spec-v0.2.json";
export const DEV_PDF = "JACKETEK-Development-Tech-Pack.pdf";
export const DEV_REVISION = /^DEV-\d{2}$/;
export const DESIGN_ID = /^D-[0-9a-f]{12}$/;
export const MARKS = ["DEVELOPMENT TECH PACK", "NOT FOR BULK PRODUCTION", "NOT PRODUCTION APPROVED"];
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

export class DevTechPackError extends Error {
  constructor(message, { status = 422, issues = [] } = {}) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;

// ---------------------------------------------------------------- the website's zone geometry
let geometry = null;
/** src/features/configurator/model/embroideryGeometry.ts, bundled for Node (the same code the 3D configurator runs). */
export async function websiteGeometry() {
  if (geometry) return geometry;
  const { build } = await import("esbuild");
  const b = await build({ entryPoints: [join(ROOT, "src/features/configurator/model/embroideryGeometry.ts")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent", alias: { "@": join(ROOT, "src") } });
  geometry = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`);
  return geometry;
}

// ---------------------------------------------------------------- QA: design ↔ spec ↔ drawing
const near = (a, b, tol = 1e-4) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

/**
 * Every field of the live design against the Manufacturing Spec built from it. `config` is the
 * frozen design; `resolved` the same design after server-side artwork resolution (for aspects).
 * Returns { ok, checks: [{ element, field, design, spec, ok }] }.
 */
export function compareConfigToSpec(config, spec, S, G) {
  const checks = [];
  const add = (element, field, design, inSpec, ok = design === inSpec) => checks.push({ element, field, design, spec: inSpec, ok: !!ok });
  const colour = (id) => S.ALL_COLOURS.find((c) => c.id === id);
  const cw = (role) => spec.colourway.find((c) => c.role === role);
  const material = (id) => S.MATERIALS.find((m) => m.id === id)?.name ?? null;
  add("garment", "size", config.size, spec.garment.size.value);
  add("garment", "body material", material(config.materials.body), spec.garment.bodyMaterial.value);
  add("garment", "sleeve material", material(config.materials.sleeves), spec.garment.sleeveMaterial.value);
  add("garment", "body colour id", config.colours.body, cw("Body")?.colourId.value);
  add("garment", "body colour hex", colour(config.colours.body)?.hex ?? null, cw("Body")?.hex);
  add("garment", "sleeve colour id", config.colours.sleeves, cw("Sleeves")?.colourId.value);
  add("garment", "sleeve colour hex", colour(config.colours.sleeves)?.hex ?? null, cw("Sleeves")?.hex);
  add("garment", "rib colour id", config.colours.trim, cw("Rib — collar, cuffs, waistband (base)")?.colourId.value);
  add("garment", "rib stripe colour (follows the sleeves, as in the 3D preview)", config.colours.sleeves, cw("Rib stripes")?.colourId.value);
  add("garment", "snap finish", config.buttons, cw("Snaps")?.colourId.value);
  const active = (config.embroidery ?? []).filter((e) => (e.kind === "text" ? !!e.text?.trim() : !!e.image?.src));
  add("embroidery", "active element count", active.length, spec.artwork.length);
  for (const e of active) {
    const a = spec.artwork.find((x) => x.elementId === e.id);
    if (!a) {
      add(e.id, "present in spec", true, false, false);
      continue;
    }
    const img = e.image;
    const type = e.kind === "text" ? "TEXT" : img.frontLetters ? "FRONT_LETTERS" : img.library ? "library" : "UPLOAD";
    add(e.id, "zone", e.placement, a.zoneId);
    add(e.id, "content type", type, type === "library" ? (a.source.kind === "library" ? "library" : a.artworkType) : a.artworkType);
    if (img?.library) add(e.id, "library design id", img.library.designId, a.source.designId);
    if (img?.library) add(e.id, "library id", img.library.libraryId, a.source.libraryId);
    if (img?.frontLetters) {
      add(e.id, "front letter 1", img.frontLetters.letter1, a.frontLetters?.letter1);
      add(e.id, "front letter 2", img.frontLetters.letter2, a.frontLetters?.letter2);
      add(e.id, "front letters template", img.frontLetters.templateId, a.frontLetters?.templateId);
      add(e.id, "front letters style", img.frontLetters.style, a.frontLetters?.style);
    }
    if (e.kind === "text") {
      add(e.id, "text (exact, line breaks kept)", e.text.replace(/\r\n?/g, "\n"), a.text?.content);
      add(e.id, "font", e.textStyle?.fontName ?? null, e.textStyle ? a.text?.font : null);
      add(e.id, "text thread (fill)", e.thread ?? null, a.threads[0]?.threadId.value ?? null);
    }
    if (img?.colourway) {
      for (const s of img.colourway.slots) {
        const t = a.threads.find((x) => x.role === s.label);
        const chosen = img.colourway.colours[s.id] ?? null;
        const asDesigned = S.THREADS.some((x) => x.id === s.defaultThread) ? s.defaultThread : null;
        add(e.id, `thread ${s.label}`, chosen ?? asDesigned, t?.threadId.value ?? null);
      }
    } else if (e.kind === "image" && e.thread) add(e.id, "thread", e.thread, a.threads[0]?.threadId.value);
    // Placement: the configurator's own clamp of its own transform (what the 3D jacket shows).
    const zone = G.EMBROIDERY_ZONES_BY_ID[e.placement];
    if (zone) {
      const t = G.clampInZone(zone.box, a.aspect, e.inZone);
      add(e.id, "scale", t.scale, a.placement.normalizedScale, near(t.scale, a.placement.normalizedScale));
      add(e.id, "offset X", t.x, a.placement.normalizedOffsetX, near(t.x, a.placement.normalizedOffsetX));
      add(e.id, "offset Y", t.y, a.placement.normalizedOffsetY, near(t.y, a.placement.normalizedOffsetY));
      const z = spec.embroideryZones.find((x) => x.zoneId === e.placement);
      const n = G.normalisedZone(zone), m = z?.configuratorReference?.normalised;
      add(e.id, "normalised zone (website geometry)", JSON.stringify(n), JSON.stringify(m));
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * Manufacturing Spec ↔ the technical drawing: for every artwork, the box the drawing places
 * (server/rfq/flats.mjs) keeps the website zone's centre and W:H, and the artwork keeps the spec's
 * scale and offsets. Drawing units are compared as ratios only (never cm).
 */
export function compareSpecToDrawing(spec) {
  const checks = [];
  const flat = canonicalFlat();
  for (const a of spec.artwork) {
    const z = spec.embroideryZones.find((x) => x.zoneId === a.zoneId);
    const n = z?.configuratorReference?.normalised;
    if (!z || !n) {
      checks.push({ artworkId: a.artworkId, field: "zone", ok: false, note: "no fixed zone / normalised placement" });
      continue;
    }
    const body = z.side === "front" || z.side === "back";
    const box = body ? zoneOnFlat(z, z.side) : zoneOnSleeve(z);
    const add = (field, expected, drawn, tol = 1e-6) => checks.push({ artworkId: a.artworkId, zoneId: a.zoneId, field, expected, drawn, ok: near(expected, drawn, tol) });
    add("zone W:H (website box proportions)", n.aspect, box.w / box.h, 1e-6);
    if (body) {
      const V = flat.views[z.side], L = V.landmarks;
      const hps = (L.HPS_L[1] + L.HPS_R[1]) / 2, len = L.waistbandTop - hps, half = (L.waistbandX1 - L.waistbandX0) / 2;
      const cx = z.side === "back" ? (L.cbNeck?.[0] ?? (V.frame.x0 + V.frame.x1) / 2) : (V.frame.x0 + V.frame.x1) / 2;
      add("zone centre v (share of HPS → waistband top)", n.v, (box.c[1] - hps) / len);
      add("zone centre u (share of half waistband width)", n.u, ((z.side === "back" ? -1 : 1) * (box.c[0] - cx)) / half);
      add("zone height h (share of HPS → waistband top)", n.h, box.h / len);
    } else {
      const S = flat.views.sleeveRight.landmarks;
      const overarm = S.overarm.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - S.overarm[i][0], p[1] - S.overarm[i][1]), 0);
      add("zone height h (share of shoulder point → cuff seam)", n.h, box.h / overarm);
    }
    // The artwork inside the box: auto-fit, then the spec's scale and offsets (shares of the box).
    const p = a.placement;
    const [w0, h0] = a.aspect >= box.w / box.h ? [box.w, box.w / a.aspect] : [box.h * a.aspect, box.h];
    checks.push({ artworkId: a.artworkId, zoneId: a.zoneId, field: "artwork drawn at spec scale / offset", expected: { scale: p.normalizedScale, x: p.normalizedOffsetX, y: p.normalizedOffsetY }, drawn: { widthShareOfBox: (w0 * p.normalizedScale) / box.w, heightShareOfBox: (h0 * p.normalizedScale) / box.h, centreShiftX: p.normalizedOffsetX, centreShiftY: p.normalizedOffsetY }, ok: p.normalizedScale > 0 && p.normalizedScale <= 1 });
  }
  return { ok: checks.every((c) => c.ok), checks };
}

// ---------------------------------------------------------------- the development document
/** RFQ-shaped spec (validated) → the development document: status, selected-size measurements, no cm estimates. */
function toDevelopmentSpec(spec, { master, masterFile, size }) {
  const dev = structuredClone(spec);
  dev.meta = {
    ...dev.meta,
    documentType: "DEVELOPMENT_TECH_PACK",
    documentStatus: "DEVELOPMENT — NOT FOR BULK PRODUCTION — NOT PRODUCTION APPROVED",
    statusBanner: MARKS.join(" · "),
    generator: "JACKETEK development tech pack generator (server/techpack/development.mjs)",
    designSource: "Live configurator — frozen JacketConfig snapshot (design-config.json); no order",
    orderId: null,
    orderLine: null,
    masterSpec: { file: masterFile.file, sha256: masterFile.sha256, title: master.title, revision: master.revision, productionApproved: false },
  };
  dev.documentStatus = { ...dev.documentStatus, code: "DEVELOPMENT_TECH_PACK", productionApproved: false, statement: "Development tech pack for sample development and review. Not for bulk production. Not production approved." };
  dev.developmentMeasurements = developmentMeasurements(size);
  // K1 is resolved in Master Spec v0.2 (dropped shoulder); K2 partially resolved — the shared builder reads v0.1 wording.
  const k1 = master.shoulderConstruction;
  if (k1?.decision) {
    const note = `${k1.decision} — JACKETEK decision ${k1.decided} (Master Spec v0.2, K1 resolved). Shoulder point, slope and armhole: pattern maker (SC-1 development rule 5.0 cm per side).`;
    dev.garment.shoulderConstruction = { value: "Dropped shoulder", unit: null, status: "SYSTEM_DERIVED", source: "Master Spec v0.2 — K1 resolved", approved: false, note };
    for (const f of [dev.garment.fit, dev.style?.fit]) if (f?.note) f.note = f.note.replace(/\s*Shoulder construction is open \(conflict K1\)\.?/, " Dropped shoulder (K1 resolved).");
  }
  const resolved = new Map([...(master.resolvedConflicts ?? []), ...(master.partiallyResolvedConflicts ?? [])].map((c) => [c.id, c.status]));
  dev.conflicts = dev.conflicts.map((c) => ({ ...c, developmentStatus: resolved.get(c.id) ?? "OPEN" }));
  // Physical embroidery placement is not calibrated: keep the normalised placement only — no
  // configurator / 3D-model centimetres anywhere in the development document.
  for (const z of dev.embroideryZones) {
    const n = z.configuratorReference?.normalised;
    z.configuratorReference = { status: "SYSTEM_DERIVED", normalised: n, note: "Website zone relative to garment landmarks (embroideryGeometry.ts normalisedZone). NORMALIZED DESIGN PLACEMENT — not a physical dimension." };
  }
  for (const a of dev.artwork) delete a.placement.configuratorSizeCm;
  dev.placementPolicy = {
    normalized: "NORMALIZED DESIGN PLACEMENT — APPROVED FOR DEVELOPMENT REFERENCE",
    physical: "PHYSICAL CM PLACEMENT — TO BE CALIBRATED FROM PHYSICAL SAMPLE",
    source: "src/features/configurator/model/embroideryGeometry.ts (the configurator's own zones and clamp)",
  };
  const plan = master.materialConstructionPlan;
  dev.materialIntent = plan
    ? {
        status: plan.k2?.status ?? null,
        components: plan.components.map((c) => ({ id: c.id, name: c.name, designIntent: c.designIntent, intentStatus: c.intentStatus, status: c.status, approvalState: c.approvalState })),
        leatherPolicy: plan.leatherPolicy ?? null,
        rule: "Detailed specifications remain TBD_SUPPLIER_PROPOSAL / TBD_PATTERN_MAKER. Nothing here is approved.",
      }
    : null;
  return dev;
}

/** The development document's own checks (on top of the RFQ validator's integrity checks). */
export function validateDevelopmentSpec(spec) {
  const errors = [];
  const err = (code, message) => errors.push({ severity: "ERROR", code, message });
  if (spec.meta?.documentType !== "DEVELOPMENT_TECH_PACK") err("DOCUMENT_TYPE", "Not a development tech pack.");
  if (spec.documentStatus?.productionApproved !== false) err("PRODUCTION_APPROVAL", "A development tech pack can never be production approved.");
  if (spec.developmentMeasurements?.productionApproved !== false) err("PRODUCTION_APPROVAL", "Development measurements can't be production approved.");
  if (spec.developmentMeasurements?.selectedSize !== spec.garment?.size?.value) err("SIZE", "Development measurements are not the selected size.");
  const text = JSON.stringify(spec);
  if (/"approved":\s*true|APPROVED_PRODUCTION|"productionApproved":\s*true/.test(text)) err("PRODUCTION_APPROVAL", "Approval wording / flags found.");
  for (const a of spec.artwork) {
    const p = a.placement;
    if ("configuratorSizeCm" in p) err("CM_PLACEMENT", `${a.artworkId}: configurator cm estimate present.`);
    for (const k of ["finishedWidthCm", "finishedHeightCm", "physicalOffsetXCm", "physicalOffsetYCm"]) if (p[k]?.value !== null) err("CM_PLACEMENT", `${a.artworkId}: ${k} has a value before calibration.`);
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------- generation
const browser = () => {
  const b = BROWSERS.find((p) => existsSync(p));
  if (!b) throw new DevTechPackError("No Chrome / Edge available to print the PDF.", { status: 500 });
  return b;
};

async function printPdf(htmlFile, pdfFile, profile) {
  const common = ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000", `--user-data-dir=${profile}`];
  const { stdout } = await run(browser(), [...common, "--dump-dom", pathToFileURL(htmlFile).href], { maxBuffer: 512 * 1024 * 1024 });
  if (!/data-ready="1"/.test(stdout)) throw new DevTechPackError("Layout check did not complete; PDF not printed.", { status: 500 });
  const overflow = /data-overflow="([^"]*)"/.exec(stdout)?.[1] ?? "";
  if (overflow) {
    // Development aid: keep the laid-out page for inspection.
    if (process.env.DEV_TECHPACK_DEBUG_HTML) writeFileSync(process.env.DEV_TECHPACK_DEBUG_HTML, stdout);
    throw new DevTechPackError(`Layout: content does not fit on page(s) ${overflow}; PDF not printed.`, { status: 500 });
  }
  await run(browser(), [...common, `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href]);
  if (!existsSync(pdfFile)) throw new DevTechPackError("The browser did not write the PDF.", { status: 500 });
  return Number(/data-pages="(\d+)"/.exec(stdout)?.[1] ?? 0);
}

let queue = Promise.resolve();
/**
 * Generates the next DEV-NN development tech pack for a live design (the browser's JacketConfig).
 * Returns { designId, revision, dir, pdf, pages, report, spec }.
 */
export function generateDevelopmentTechPack(rawConfig, { outRoot, now = new Date(), testLabel = null } = {}) {
  const job = queue.then(() => generate(rawConfig, { outRoot, now, testLabel }));
  queue = job.catch(() => {});
  return job;
}

async function generate(rawConfig, { outRoot, now, testLabel }) {
  if (!outRoot) throw new DevTechPackError("No output folder.", { status: 500 });
  const S = await loadShared();
  // 1. Freeze the design: everything below reads only this checked copy.
  const config = validateDevelopmentDesign(rawConfig, S);
  const snapshot = structuredClone(config);
  const designId = designIdOf({ size: config.size, customization: config });
  try {
    canonicalFlat();
  } catch (err) {
    throw new DevTechPackError(`The canonical technical flat is not installed (${err.message}).`, { status: 500 });
  }
  const masterBuf = readFileSync(join(ROOT, DEV_MASTER_FILE));
  const master = JSON.parse(masterBuf.toString("utf8"));
  if (master.schema !== S.MASTER_SCHEMA) throw new DevTechPackError(`Master spec schema "${master.schema}" is not supported.`, { status: 500 });
  const masterFile = { file: DEV_MASTER_FILE, sha256: sha(masterBuf) };
  const G = await websiteGeometry();

  // 2. An in-memory line (never stored, no customer, no order id) — the shape the shared builder reads.
  const createdAt = now.toISOString();
  const line = { productId: S.PRODUCT.id, productName: S.PRODUCT.name, size: config.size, quantity: 1, unitPrice: null, lineTotal: null, customization: structuredClone(config) };
  const draft = { id: null, createdAt, status: "development", items: [line] };
  const withLib = withLibraryAssets(draft);
  const libraryOriginals = new Map();
  for (const e of withLib.items[0].customization.embroidery ?? []) if (e.image?.library && e.image.src?.startsWith("data:")) libraryOriginals.set(e.id, e.image.src);
  const order = await withColourways(await withTextArtwork(withLib));

  // 3. Revision: next DEV-NN; never overwritten.
  const designDir = join(outRoot, designId);
  mkdirSync(designDir, { recursive: true });
  const existing = readdirSync(designDir).filter((d) => DEV_REVISION.test(d)).sort();
  const revision = `DEV-${String(existing.length ? Number(existing.at(-1).slice(4)) + 1 : 1).padStart(2, "0")}`;
  const history = existing.map((r) => ({ revision: r, date: "", specVersion: "", summary: "Earlier development revision (kept unchanged)" }));

  const stage = join(designDir, `.staging-${randomBytes(6).toString("hex")}`);
  for (const d of ["artwork", "previews", "source"]) mkdirSync(join(stage, d), { recursive: true });
  try {
    const base = { order, lineIndex: 0, master, masterFile, designId, revision, createdAt, history };
    const first = S.buildManufacturingSpec(base);
    const elements = new Map((order.items[0].customization.embroidery ?? []).map((e) => [e.id, e]));
    const files = {};
    const written = [];
    for (const a of first.artwork) {
      const e = elements.get(a.elementId);
      const src = e.kind === "text" ? e.textArtwork?.src : e.image?.src;
      const entry = { artwork: null, original: null, pixelSize: null };
      if (src) {
        const img = decodeImageDataUrl(src, a.artworkId);
        entry.artwork = `artwork/${a.artworkId}.${img.ext}`;
        entry.pixelSize = img.pixelSize;
        writeFileSync(join(stage, entry.artwork), img.buf);
        written.push(entry.artwork);
      }
      const originalSrc = e.kind === "image" ? (e.image.original?.src ?? libraryOriginals.get(e.id) ?? null) : null;
      if (originalSrc && originalSrc !== src) {
        const img = decodeImageDataUrl(originalSrc, `${a.artworkId} original`);
        entry.original = `artwork/${a.artworkId}-original.${img.ext}`;
        writeFileSync(join(stage, entry.original), img.buf);
        written.push(entry.original);
      }
      files[a.elementId] = entry;
    }
    const built = S.buildManufacturingSpec({ ...base, files });
    const inside = (rel) => existsSync(join(stage, rel)) && !rel.includes("..");
    const baseValidation = S.validateManufacturingSpec(built, { masterPomIds: master.poms.map((p) => p.id), fileExists: inside });
    if (!baseValidation.ok) throw new DevTechPackError(`The Manufacturing Spec has ${baseValidation.errors.length} error(s); no tech pack was generated.`, { issues: baseValidation.errors });
    const spec = toDevelopmentSpec(built, { master, masterFile, size: config.size });
    if (testLabel) spec.meta.testDocument = String(testLabel);
    spec.baseValidation = { errors: baseValidation.errors, warnings: baseValidation.warnings.length, info: baseValidation.info.length };
    const devValidation = validateDevelopmentSpec(spec);
    const designQa = compareConfigToSpec(snapshot, spec, S, G);
    const drawingQa = compareSpecToDrawing(spec);
    if (!devValidation.ok || !designQa.ok || !drawingQa.ok) {
      throw new DevTechPackError("The tech pack does not match the design; nothing was generated.", { issues: [...devValidation.errors, ...designQa.checks.filter((c) => !c.ok).map((c) => ({ code: "DESIGN_MISMATCH", message: `${c.element} ${c.field}: design ${JSON.stringify(c.design)} ≠ spec ${JSON.stringify(c.spec)}` })), ...drawingQa.checks.filter((c) => !c.ok).map((c) => ({ code: "DRAWING_MISMATCH", message: `${c.artworkId} ${c.field}` }))] });
    }
    spec.validation = { ok: true, errors: [], warnings: baseValidation.warnings, info: baseValidation.info };

    // 4. Files.
    writeFileSync(join(stage, "design-config.json"), json({ schema: "jacketek.designSnapshot", designId, revision, frozenAt: createdAt, source: "Live configurator (JacketConfig)", config: snapshot }));
    writeFileSync(join(stage, "manufacturing-spec.json"), json(spec));
    const colour = (role) => spec.colourway.find((c) => c.role === role)?.hex;
    const fills = fillsFor({ body: colour("Body"), sleeves: colour("Sleeves"), rib: colour("Rib — collar, cuffs, waistband (base)"), stripe: colour("Rib stripes"), snap: colour("Snaps") });
    const plainZones = spec.embroideryZones.map((z, i) => ({ ...z, used: false, label: `Z${i + 1}` }));
    writeFileSync(join(stage, "previews", "flat-front.svg"), viewSvg("front", { wMm: 160, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "flat-back.svg"), viewSvg("back", { wMm: 160, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "flat-left-sleeve.svg"), sleeveSvg("leftSleeve", { wMm: 70, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "flat-right-sleeve.svg"), sleeveSvg("rightSleeve", { wMm: 70, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "colourway-front.svg"), viewSvg("front", { wMm: 160, hMm: 200, fills, boxes: false }));
    writeFileSync(join(stage, "previews", "colourway-back.svg"), viewSvg("back", { wMm: 160, hMm: 200, fills, boxes: false }));

    const { html, pageTitles } = renderDevelopmentHtml(spec, { artDir: stage });
    writeFileSync(join(stage, "source", "development-tech-pack.html"), html);
    const work = join(stage, ".print");
    mkdirSync(work);
    const htmlFile = join(work, "dev.html");
    writeFileSync(htmlFile, html);
    const pages = await printPdf(htmlFile, join(stage, DEV_PDF), join(work, "profile"));
    rmSync(work, { recursive: true, force: true });

    const report = {
      designId,
      revision,
      generatedAt: createdAt,
      selectedSize: config.size,
      document: { type: "DEVELOPMENT_TECH_PACK", marks: MARKS, productionApproved: false, pdf: DEV_PDF, pages, sections: pageTitles },
      sources: { design: "design-config.json (frozen live JacketConfig)", masterSpec: masterFile, sizeChart: spec.developmentMeasurements.source },
      artwork: spec.artwork.map((a) => ({ artworkId: a.artworkId, elementId: a.elementId, zoneId: a.zoneId, type: a.artworkType, files: a.files })),
      artworkFiles: written,
      qa: { designToSpec: designQa, specToDrawing: drawingQa, developmentValidation: devValidation, baseValidation: spec.baseValidation },
    };
    writeFileSync(join(stage, "generation-report.json"), json(report));
    const finalDir = join(designDir, revision);
    if (existsSync(finalDir)) throw new DevTechPackError(`${revision} already exists; nothing was overwritten.`, { status: 409 });
    renameSync(stage, finalDir);
    return { designId, revision, dir: finalDir, pdf: join(finalDir, DEV_PDF), pages, report, spec };
  } catch (err) {
    rmSync(stage, { recursive: true, force: true });
    throw err;
  }
}

/** A generated development PDF, only by validated id and revision (never a browser-supplied path). */
export function developmentPdfFile(outRoot, designId, revision) {
  if (!DESIGN_ID.test(designId ?? "") || !DEV_REVISION.test(revision ?? "")) return null;
  const file = join(outRoot, designId, revision, DEV_PDF);
  return existsSync(file) ? file : null;
}
