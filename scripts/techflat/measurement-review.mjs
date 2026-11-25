#!/usr/bin/env node
// MEASUREMENT REVIEW PACKAGE — what the RFQ can state today about measurements and
// embroidery-zone placement, before another RFQ revision is issued. Review only: changes no
// spec, no RFQ, no approval.
//
//   node scripts/techflat/measurement-review.mjs [--out dev-output/measurement-review-v1]
//
// Measurements come only from the Master Garment Spec v0.1 (reference values, provisional M
// targets, TBD); zones only from the live configurator (embroideryGeometry.ts normalisedZone),
// drawn with the RFQ's own placement code. NOTHING is converted to cm without a calibration,
// and no value is read from the drawing (the flat is not to scale).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalFlat, zoneOnFlat, zoneOnSleeve } from "../../server/rfq/flats.mjs";
import { compose } from "../../server/rfq/techflat/canonical.mjs";
import { pomDisplay } from "../../server/rfq/techflat/pomlabels.mjs";
import { canonicalSheets } from "../../server/rfq/techflat/sheets.mjs";
import { CALIBRATION, zoneRatios } from "../../server/rfq/techflat/zoneratios.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const out = resolve(ROOT, args.includes("--out") ? args[args.indexOf("--out") + 1] : "dev-output/measurement-review-v1");
mkdirSync(out, { recursive: true });
const MASTER_FILE = "garment-spec/jacketek-master-spec-v0.1.json";
const master = JSON.parse(readFileSync(join(ROOT, MASTER_FILE), "utf8"));
const D = pomDisplay(master);
const F = canonicalFlat();
const BROWSER = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fx = (n) => (Math.round(n * 100) / 100).toString();

// ------------------------------------------------------------- live zones
const { build } = await import("esbuild");
const bundle = await build({ entryPoints: [join(ROOT, "src/features/configurator/model/embroideryGeometry.ts")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const G = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const zones = G.EMBROIDERY_ZONE_LIST.map((z, i) => ({
  zoneId: z.id, zoneName: z.name, side: z.side, label: `Z${i + 1}`, used: true,
  allowedContent: z.accepts.design && z.accepts.text ? "Design or text" : z.accepts.text ? "Text only" : "Design only",
  configuratorReference: { normalised: G.normalisedZone(z) },
}));
for (const z of zones) z.ratios = zoneRatios(z);

// ------------------------------------------------------------- POM classification
const CLASS = { VERIFIED_SOURCE: "VERIFIED_SOURCE", DERIVED_FROM_APPROVED_SPEC: "DERIVED_FROM_APPROVED_SPEC", TO_MEASURE_ON_SAMPLE: "TO_MEASURE_ON_SAMPLE", TO_SET_BY_PATTERN_MAKER: "TO_SET_BY_PATTERN_MAKER" };
const targets = master.provisionalTargetRangeM;
const TARGET_OF = { B01: { range: targets.chestHalfFlatCm, basis: "half chest, flat (B01 is a full circumference: compare half × 2)" }, B09: { range: targets.acrossShoulderCm, basis: "across shoulder" }, B06: { range: targets.bodyLengthCm, basis: "body length" } };
const sheets = canonicalSheets(F, D);
const drawnOn = (id) => sheets.filter((s) => s.ids.includes(id)).map((s) => s.name);
const poms = master.poms.map((p) => {
  const ref = master.referenceValues.values[p.id]?.M ?? null;
  const t = TARGET_OF[p.id] ?? null;
  return {
    id: p.id, name: p.name, area: p.area, method: p.method,
    classification: CLASS[p.status] ?? "UNKNOWN",
    hasNumericValue: !!ref,
    referenceM: ref ? { cm: ref.cm, inches: ref.inches, status: "VERIFIED_SOURCE", source: master.referenceValues.source, approved: false, note: "Golden Bear Classic Fit reference — not JACKETEK production approved" } : null,
    provisionalTargetM: t ? { rangeCm: t.range, basis: t.basis, status: "PROVISIONAL_TARGET", source: "Master Spec v0.1 provisionalTargetRangeM", approved: false } : null,
    drawingLabel: `${D[p.id].value} ${D[p.id].status}${D[p.id].target ? ` · target ${D[p.id].target} PROVISIONAL` : ""}`,
    drawnOn: drawnOn(p.id),
  };
});

// ------------------------------------------------------------- sheet html
const css = `@page { size: A4 landscape; margin: 0 }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff }
.sheet { width: 297mm; height: 210mm; box-sizing: border-box; padding: 7mm 9mm 6mm; display: flex; flex-direction: column }
.tb { display: grid; grid-template-columns: 1fr auto; align-items: end; border-bottom: .4mm solid #111; padding-bottom: 1.6mm; font-size: 8pt }
.tb .t { font-size: 11pt; font-weight: bold; letter-spacing: .03em }
.badge { border: .3mm solid #5a2386; color: #5a2386; background: #f6effc; padding: .7mm 2mm; font-weight: bold; font-size: 7.2pt }
.badge.y { border-color: #8a5a00; color: #6b4600; background: #fff4d6 }
.main { flex: 1; display: flex; gap: 4mm; padding-top: 3mm; min-height: 0 }
.dr { flex: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3mm; align-content: center }
.tab { width: 104mm }
table { border-collapse: collapse; width: 100%; font-size: 6.6pt }
th, td { border: .2mm solid #999; padding: .6mm .9mm; vertical-align: top; text-align: left }
th { background: #ececec; font-size: 6.1pt; text-transform: uppercase }
td.c { font-weight: bold; color: #0b4f8a; white-space: nowrap } td.v { font-weight: bold }
.m { color: #444; font-size: 6pt; margin-top: .3mm } .mono { font-family: Consolas, monospace }
.prov { color: #5a2386; font-weight: bold } .tbd { color: #8a5a00; font-weight: bold }
.note { font-size: 6.4pt; color: #333; margin-top: 2mm; line-height: 1.35 }
.ft { border-top: .25mm solid #888; padding-top: 1.2mm; font-size: 6.4pt; color: #333 }`;
const STATUS_TXT = { PROV: "PROVISIONAL", REF: "REFERENCE", SAMPLE: "TBD — SAMPLE MEASUREMENT", PATTERN: "TBD — PATTERN MAKER", DERIVED: "TBD — DERIVED (formula)" };
function page(title, sub, badge, drawingsHtml, tableHtml, foot) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="sheet">
<div class="tb"><div><div class="t">${esc(title)}</div>${esc(sub)}</div><div class="badge${badge.y ? " y" : ""}">${esc(badge.text)}</div></div>
<div class="main">${drawingsHtml ? `<div class="dr">${drawingsHtml}</div>` : ""}${tableHtml}</div>
<div class="ft">${foot}</div></div></body></html>`;
}
const pomTable = (ids) => `<div class="tab"><table><thead><tr><th>POM</th><th>Measurement / how to measure</th><th>M</th><th>Status</th></tr></thead><tbody>${ids
  .map((id) => {
    const d = D[id];
    const val = d.value === "TBD" ? '<span class="tbd">TBD</span>' : `<b>${esc(d.value)}</b>${d.target ? `<div class="prov">target ${esc(d.target)}</div>` : ""}`;
    return `<tr><td class="c">${id}</td><td><b>${esc(d.name)}</b><div class="m">${esc(d.method)}</div></td><td class="v">${val}</td><td class="${d.value === "TBD" ? "tbd" : ""}">${esc(STATUS_TXT[d.status] ?? d.status)}${d.target ? '<div class="prov">+ PROVISIONAL target</div>' : ""}</td></tr>`;
  })
  .join("")}</tbody></table><div class="note">Values only from the Master Garment Spec v0.1: REFERENCE = Golden Bear Classic Fit published value (not JACKETEK production approved); target = the master spec's PROVISIONAL M range. TBD = no value yet — measured on the M sample or set by the pattern maker. The drawing is not to scale and no value is taken from it.</div></div>`;

// Zone ratio drawings: the canonical flat, landmark guides, the zone boxes (RFQ placement code).
const LIVE = "#0a5bd8", GUIDE = "#5a2386";
function zoneDrawing(viewKey, list, wMm = 150, hMm = 165) {
  const V = F.views[viewKey];
  const vb = V.viewBox, region = { x0: vb[0], y0: vb[1], x1: vb[0] + vb[2], y1: vb[1] + vb[3] };
  const u = 1 / Math.min(wMm / (region.x1 - region.x0), hMm / (region.y1 - region.y0));
  const o = [];
  const text = (x, y, s, anchor = "start", fill = GUIDE, size = 2.2) => `<text x="${fx(x)}" y="${fx(y)}" font-size="${fx(size * u)}" fill="${fill}" text-anchor="${anchor}" font-weight="bold" paint-order="stroke" stroke="#fff" stroke-width="${fx(0.7 * u)}">${esc(s)}</text>`;
  const line = (a, b, dash = "3 2") => `<line x1="${fx(a[0])}" y1="${fx(a[1])}" x2="${fx(b[0])}" y2="${fx(b[1])}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke"/>`;
  if (!viewKey.startsWith("sleeve")) {
    const L = V.landmarks, hps = (L.HPS_L[1] + L.HPS_R[1]) / 2;
    const cx = viewKey === "back" ? L.cbNeck?.[0] ?? (V.frame.x0 + V.frame.x1) / 2 : (V.frame.x0 + V.frame.x1) / 2;
    o.push(line([L.waistbandX0 - 6 * u, hps], [L.waistbandX1 + 6 * u, hps]), text(L.waistbandX1 + 7 * u, hps + 0.8 * u, "HPS  v = 0"));
    o.push(line([L.waistbandX0 - 6 * u, L.waistbandTop], [L.waistbandX1 + 6 * u, L.waistbandTop]), text(L.waistbandX1 + 7 * u, L.waistbandTop + 0.8 * u, "WAISTBAND TOP  v = 1"));
    o.push(line([cx, hps - 4 * u], [cx, L.hem + 3 * u], "1 1.6"), text(cx, L.hem + 6 * u, `${viewKey === "back" ? "CB" : "CF"} line  u = 0`, "middle"));
    o.push(line([L.waistbandX0, L.hem + 9 * u], [L.waistbandX1, L.hem + 9 * u], "0"), text((L.waistbandX0 + L.waistbandX1) / 2, L.hem + 12.5 * u, "body width at the waistband  (u = ±1 at its ends)", "middle"));
  } else {
    const S = F.views.sleeveRight.landmarks;
    const mir = viewKey === "sleeveLeft" ? F.views.sleeveLeft.mirrorX : (p) => p;
    const sp = mir(S.SP), a = mir(S.cuff.TL), b = mir(S.cuff.TR);
    const side = viewKey === "sleeveLeft" ? 1 : -1, anchor = side > 0 ? "start" : "end";
    o.push(`<circle cx="${fx(sp[0])}" cy="${fx(sp[1])}" r="${fx(1.1 * u)}" fill="${GUIDE}"/>`, text(sp[0] + side * 3 * u, sp[1] - 1 * u, "SHOULDER POINT  s = 0", anchor));
    o.push(line(a, b, "0"), text((side > 0 ? Math.max(a[0], b[0]) : Math.min(a[0], b[0])) + side * 3 * u, (a[1] + b[1]) / 2 + 0.8 * u, "CUFF SEAM  s = 1", anchor));
  }
  for (const z of list) {
    const box = z.side === "leftSleeve" || z.side === "rightSleeve" ? zoneOnSleeve(z) : zoneOnFlat(z, z.side);
    o.push(`<rect x="${fx(box.c[0] - box.w / 2)}" y="${fx(box.c[1] - box.h / 2)}" width="${fx(box.w)}" height="${fx(box.h)}" transform="rotate(${fx(box.rot)} ${fx(box.c[0])} ${fx(box.c[1])})" fill="${LIVE}" fill-opacity="0.12" stroke="${LIVE}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`);
    o.push(`<circle cx="${fx(box.c[0])}" cy="${fx(box.c[1])}" r="${fx(0.8 * u)}" fill="${LIVE}"/>`);
    o.push(text(box.c[0], box.c[1] - 1.6 * u, `${z.label} ${z.zoneName}`, "middle", LIVE, 2.3));
    o.push(text(box.c[0], box.c[1] + 3.2 * u, `${z.ratios.centre}`, "middle", LIVE, 2));
    o.push(text(box.c[0], box.c[1] + 6 * u, `w ${z.ratios.width} · h ${z.ratios.height}`, "middle", LIVE, 2));
  }
  return compose(V, region, wMm, hMm, { extra: `<g id="zone-ratio-overlay">${o.join("")}</g>` }).svg;
}
const zoneTable = (list) => `<div class="tab"><table><thead><tr><th>Zone</th><th>Normalized centre · W · H</th><th>Landmark position</th><th>cm (when calibrated)</th></tr></thead><tbody>${list
  .map((z) => `<tr><td class="c">${z.label}<div class="m">${esc(z.zoneName)}</div><div class="m">${esc(z.allowedContent)}</div></td><td class="mono">${esc(z.ratios.centre)}<br>w ${z.ratios.width} · h ${z.ratios.height}</td><td>${esc(z.ratios.landmarks.join(". "))}.<div class="m">Reference: ${esc(z.ratios.reference)}</div></td><td class="tbd">TBD<div class="m mono">${Object.entries(z.ratios.formulas).map(([k, v]) => `${esc(k)} = ${esc(v)}`).join("<br>")}</div></td></tr>`)
  .join("")}</tbody></table><div class="note"><span class="prov">NORMALIZED PLACEMENT — NOT PHYSICAL SIZE.</span> Ratios of the live configurator zones (approved for visual placement; back zones 2026-10-09). ${esc(CALIBRATION.status)}</div></div>`;

// ------------------------------------------------------------- emit
const tmp = join(out, ".tmp");
mkdirSync(tmp, { recursive: true });
function emit(name, html, svg = null) {
  if (svg) writeFileSync(join(out, `${name}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  const f = join(tmp, `${name}.html`);
  writeFileSync(f, html);
  execFileSync(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--screenshot=${join(out, `${name}.png`)}`, "--window-size=1123,794", pathToFileURL(f).href], { stdio: "ignore" });
}
const FOOT_M = "JACKETEK · measurement review v1 · size M · Master Garment Spec v0.1 (VALIDATION DRAFT, not production approved) · canonical S.i. Graphics flat (licensed; unchanged), NOT TO SCALE · RFQ — NOT FOR BULK PRODUCTION";
const pomSheet = (n) => sheets.find((s) => s.name === n);
for (const [file, sheetName, title] of [
  ["01-front-measurements", "05-front-pom", "FRONT — MEASUREMENTS (body)"],
  ["01b-front-detail-measurements", "05b-front-detail-pom", "FRONT — MEASUREMENTS (neck, collar, opening, snaps, pockets)"],
  ["02-back-measurements", "06-back-pom", "BACK — MEASUREMENTS"],
  ["03-sleeve-measurements", "07-sleeve-pom", "SLEEVE — MEASUREMENTS (wearer's right; left = mirror image)"],
]) {
  const sh = pomSheet(sheetName);
  emit(file, page(title, "Reference values and provisional M targets where the master spec has them; every other POM shows where and how it is measured, marked TBD.", { text: "PROVISIONAL — NOT FOR BULK PRODUCTION", y: true }, sh.drawings.map((d) => d.svg).join(""), pomTable(sh.ids), FOOT_M), sh.drawings[0].svg);
}
const pick = (side) => zones.filter((z) => z.side === side);
for (const [file, view, side, title] of [
  ["04-front-zones-ratios", "front", "front", "FRONT — EMBROIDERY ZONE RATIOS"],
  ["05-back-zones-ratios", "back", "back", "BACK — EMBROIDERY ZONE RATIOS"],
  ["06-left-sleeve-zones-ratios", "sleeveLeft", "leftSleeve", "LEFT SLEEVE — EMBROIDERY ZONE RATIOS"],
  ["07-right-sleeve-zones-ratios", "sleeveRight", "rightSleeve", "RIGHT SLEEVE — EMBROIDERY ZONE RATIOS"],
]) {
  const svg = zoneDrawing(view, pick(side));
  emit(file, page(title, "Zones as on the live configurator, placed on the flat by garment landmarks (the RFQ's own placement code).", { text: "NORMALIZED PLACEMENT — NOT PHYSICAL SIZE" }, svg, zoneTable(pick(side)), FOOT_M), svg);
}
const VIEW = { front: "Front", back: "Back", leftSleeve: "Left sleeve", rightSleeve: "Right sleeve" };
const schedule = `<div style="flex:1"><table><thead><tr><th>Zone</th><th>Name</th><th>View</th><th>Allowed content</th><th>Norm. centre</th><th>Norm. W</th><th>Norm. H</th><th>Landmark position</th><th>Phys. W cm</th><th>Phys. H cm</th><th>Phys. position</th><th>Status</th><th>Source / provenance</th></tr></thead><tbody>${zones
  .map((z) => `<tr><td class="c">${z.label}</td><td>${esc(z.zoneName)}</td><td>${VIEW[z.side]}</td><td>${esc(z.allowedContent)}</td><td class="mono">${z.ratios.centreLines.map(esc).join("<br>")}</td><td class="mono">${z.ratios.width}</td><td class="mono">${z.ratios.height}</td><td>${esc(z.ratios.landmarks.join(". "))}.</td><td class="tbd">TBD</td><td class="tbd">TBD</td><td class="tbd">TBD</td><td><span class="tbd">Physical: TBD — pattern maker</span><div class="prov">Ratio: approved for visual placement</div></td><td class="m">Live configurator zone (embroideryGeometry.ts); back zones as approved 2026-10-09</td></tr>`)
  .join("")}</tbody></table><div class="note"><b>From ratio to cm once calibrated</b> — body vertical: ${esc(CALIBRATION.body.vertical.formula)} (${esc(CALIBRATION.body.vertical.unit)}); body across: ${esc(CALIBRATION.body.horizontal.formula)} (${esc(CALIBRATION.body.horizontal.unit)}); sleeve along: ${esc(CALIBRATION.sleeve.along.formula)} (${esc(CALIBRATION.sleeve.along.unit)}); sleeve across: ${esc(CALIBRATION.sleeve.across.formula)}. ${esc(CALIBRATION.status)} The provisional M targets (half chest, across shoulder, body length) measure other lines and do not scale zones.</div></div>`;
emit("08-placement-schedule", page("EMBROIDERY PLACEMENT SCHEDULE — ALL 10 ZONES", "Normalized geometry from the live configurator; physical values unresolved and shown as TBD.", { text: "NORMALIZED PLACEMENT — NOT PHYSICAL SIZE" }, "", schedule, FOOT_M));
rmSync(tmp, { recursive: true, force: true });

// ------------------------------------------------------------- data
const count = (k) => poms.filter((p) => p.classification === k).length;
writeFileSync(join(out, "measurement-review.json"), JSON.stringify({
  schema: "jacketek.measurementReview", version: "1.0.0", generatedAt: new Date().toISOString(),
  status: "REVIEW — NOT PRODUCTION APPROVED; RFQ — NOT FOR BULK PRODUCTION",
  masterSpec: { file: MASTER_FILE, title: master.title, revision: master.revision, documentStatus: master.documentStatus, productionApproved: master.productionApproved },
  pomSummary: { total: poms.length, VERIFIED_SOURCE: count("VERIFIED_SOURCE"), DERIVED_FROM_APPROVED_SPEC: count("DERIVED_FROM_APPROVED_SPEC"), TO_MEASURE_ON_SAMPLE: count("TO_MEASURE_ON_SAMPLE"), TO_SET_BY_PATTERN_MAKER: count("TO_SET_BY_PATTERN_MAKER"), UNKNOWN: count("UNKNOWN"), withNumericReference: poms.filter((p) => p.hasNumericValue).map((p) => p.id), withProvisionalTarget: poms.filter((p) => p.provisionalTargetM).map((p) => p.id), note: "PROVISIONAL_TARGET is not a POM status in the master spec: it is the M target range attached to B01 (as half chest), B06 and B09. DERIVED_FROM_APPROVED_SPEC POMs are formulas with no value yet." },
  poms,
  zones: zones.map((z) => ({ zoneId: z.zoneId, label: z.label, name: z.zoneName, view: z.side, allowedContent: z.allowedContent, normalised: z.configuratorReference.normalised, centre: z.ratios.centre, width: z.ratios.width, height: z.ratios.height, landmarks: z.ratios.landmarks, reference: z.ratios.reference, cmFormulasWhenCalibrated: z.ratios.formulas, physical: { widthCm: null, heightCm: null, positionCm: null, status: "TBD — pattern maker", approved: false }, provenance: "Live configurator (src/features/configurator/model/embroideryGeometry.ts); ratios approved for visual placement (back zones 2026-10-09)" })),
  calibration: CALIBRATION,
  provisionalCmConversion: { result: "NOT DERIVED", reason: "Each normalised unit maps to unmeasured POMs (B07 − R01, B03, S02 − S09, S04–S06). The provisional M values (half chest 61–62.2, across shoulder 49.5–50, body length 67.3–68) measure other lines, and B06's start point and rib inclusion are unstated, so scaling zones from them would invent pattern geometry." },
  configuratorSizeEstimates: { source: "src/features/configurator/model/embroideryGeometry.ts zone box (3D model metres × 100) → configurator panel 'Area W × H cm' and order physicalSize", rfqTreatment: "Removed from the factory-facing RFQ pages; kept in manufacturing-spec.json as configuratorSizeCm with source 'Configurator visual estimate — not a production measurement; not printed in the RFQ'.", websiteTreatment: "Unchanged (customer-facing configurator)." },
  legacySizeChart: { file: "production-drawing/data/official_size_chart.json", mValuesCm: { chestWidthFlat: 60, jacketLength: 70, sleeveLength: 62 }, conflict: "Conflicts with the Master Garment Spec v0.1 (provisional half chest 61–62.2, body length 67.3–68; sleeve unresolved).", treatment: "Flagged LEGACY in the file (_status), the production-drawing README and PDF legend and the admin order page; never read by the RFQ generator (test: 'the legacy production-drawing size chart never reaches the RFQ'). Not deleted." },
}, null, 1) + "\n");
console.log("POMs", JSON.stringify({ total: poms.length, VERIFIED_SOURCE: count("VERIFIED_SOURCE"), DERIVED: count("DERIVED_FROM_APPROVED_SPEC"), SAMPLE: count("TO_MEASURE_ON_SAMPLE"), PATTERN: count("TO_SET_BY_PATTERN_MAKER"), UNKNOWN: count("UNKNOWN") }));
console.log("written:", out);
