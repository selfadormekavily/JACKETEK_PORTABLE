#!/usr/bin/env node
// QA — NEW SYNTHETIC DESIGN: website vs manufacturing spec vs technical drawing.
//
//   node scripts/qa/new-design-compare.mjs <qaDir> <rfqDir>
//
// Website  = the design the configurator saved (website/qa-design-config.json) placed with the
//            configurator's own geometry (embroideryGeometry.ts zoneContent) — what the 3D jacket shows.
// Spec     = the manufacturing-spec.json the RFQ pipeline built from it.
// Drawing  = where the RFQ renderer puts each artwork on the canonical flat (flats.mjs
//            zoneOnFlat / zoneOnSleeve + artworkInZone), projected back to garment-normalised terms.
// Writes comparisons/*.png (website screenshot vs technical flat), placement-check.json,
// spec-check.json and QA_REPORT.md. Read-only on the RFQ.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalFlat, fillsFor, sleeveSvg, viewSvg, zoneOnFlat, zoneOnSleeve } from "../../server/rfq/flats.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const [qaDir = "dev-output/qa-new-design", rfqDir] = process.argv.slice(2);
const QA = resolve(ROOT, qaDir), RFQ = resolve(ROOT, rfqDir);
const OUT = join(QA, "comparisons");
mkdirSync(OUT, { recursive: true });
const config = JSON.parse(readFileSync(join(QA, "website", "qa-design-config.json"), "utf8"));
const spec = JSON.parse(readFileSync(join(RFQ, "manufacturing-spec.json"), "utf8"));
const BROWSER = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r4 = (n) => Math.round(n * 10000) / 10000;

const { build } = await import("esbuild");
const b = await build({ entryPoints: [join(ROOT, "src/features/configurator/model/embroideryGeometry.ts")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const G = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`);
const L = G.REFERENCE_LANDMARKS;
const BODY = L.hpsY - L.waistbandTopY, SLEEVE = L.sleeveTopY - L.cuffSeamY;
const isSleeve = (side) => side === "leftSleeve" || side === "rightSleeve";

// ------------------------------------------------------------- 1 website placement (normalised)
const aspectOf = (e) => (e.kind === "text" ? e.textStyle?.aspect : e.image?.aspect);
function websitePlacement(e) {
  const z = G.EMBROIDERY_ZONES_BY_ID[e.placement];
  const aspect = aspectOf(e);
  const { size: [w, h], offset: [dx, dy], transform } = G.zoneContent(z.box, aspect, e.inZone);
  const zoneWH = r4(z.box[0] / z.box[1]);
  if (isSleeve(z.side)) {
    // Sleeve: along the sleeve as a share of shoulder point → cuff seam; across and width as shares of the zone's width.
    return { side: z.side, s: r4((L.sleeveTopY - (z.point[1] + dy)) / SLEEVE), across: r4(dx / z.box[0]), w: r4(w / z.box[0]), h: r4(h / SLEEVE), scale: transform.scale, offset: [transform.x, transform.y], aspect: r4(aspect), zoneWH, zoneH: r4(z.box[1] / SLEEVE) };
  }
  const facing = z.side === "back" ? -1 : 1;
  const x = z.point[0] + dx * facing, y = z.point[1] + dy;
  // Body: u, v as shares of the body; artwork width as a share of the zone's width, height as a share of HPS → waistband top.
  return { side: z.side, u: r4(x / L.waistbandHalfWidth), v: r4((L.hpsY - y) / BODY), w: r4(w / z.box[0]), h: r4(h / BODY), scale: transform.scale, offset: [transform.x, transform.y], aspect: r4(aspect), zoneWH, zoneH: r4(z.box[1] / BODY), zoneWofBody: r4(z.box[0] / (2 * L.waistbandHalfWidth)) };
}

// ------------------------------------------------------------- 2 drawing placement (projected back)
const F = canonicalFlat();
const zonesById = new Map(spec.embroideryZones.map((z) => [z.zoneId, z]));
function drawingPlacement(a) {
  const z = zonesById.get(a.zoneId);
  const n = z.configuratorReference.normalised;
  const p = a.placement;
  const box = isSleeve(z.side) ? zoneOnSleeve(z) : zoneOnFlat(z, z.side);
  const [w0, h0] = a.aspect >= box.w / box.h ? [box.w, box.w / a.aspect] : [box.h * a.aspect, box.h];
  const aw = w0 * p.normalizedScale, ah = h0 * p.normalizedScale;
  // Inside its zone box on the drawing? (share of the box it pokes out by, 0 = inside)
  const out = Math.max(0, Math.abs(p.normalizedOffsetX * box.w) + aw / 2 - box.w / 2) / box.w + Math.max(0, Math.abs(p.normalizedOffsetY * box.h) + ah / 2 - box.h / 2) / box.h;
  const overflow = r4(out);
  if (isSleeve(z.side)) {
    const S = F.views.sleeveRight.landmarks;
    const len = S.overarm.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - S.overarm[i][0], q[1] - S.overarm[i][1]), 0);
    return { side: z.side, s: r4(n.s - (p.normalizedOffsetY * box.h) / len), across: r4(p.normalizedOffsetX), w: r4(aw / box.w), h: r4(ah / len), overflow, zoneWH: r4(box.w / box.h), zoneH: r4(box.h / len), box };
  }
  const V = F.views[z.side], LV = V.landmarks;
  const hps = (LV.HPS_L[1] + LV.HPS_R[1]) / 2, len = LV.waistbandTop - hps, half = (LV.waistbandX1 - LV.waistbandX0) / 2;
  const cx0 = z.side === "back" ? LV.cbNeck?.[0] ?? (V.frame.x0 + V.frame.x1) / 2 : (V.frame.x0 + V.frame.x1) / 2;
  const dir = z.side === "back" ? -1 : 1;
  const cx = box.c[0] + p.normalizedOffsetX * box.w, cy = box.c[1] - p.normalizedOffsetY * box.h;
  return { side: z.side, u: r4((dir * (cx - cx0)) / half), v: r4((cy - hps) / len), w: r4(aw / box.w), h: r4(ah / len), overflow, zoneWH: r4(box.w / box.h), zoneH: r4(box.h / len), zoneWofBody: r4(box.w / (2 * half)), box };
}

// ------------------------------------------------------------- 3 compare
const TOL_POS = 0.01, TOL_SIZE = 0.02;
const rows = [];
for (const e of config.embroidery) {
  const a = spec.artwork.find((x) => x.elementId === e.id);
  const web = websitePlacement(e);
  const spc = { scale: a.placement.normalizedScale, offset: [a.placement.normalizedOffsetX, a.placement.normalizedOffsetY], aspect: r4(a.aspect), zoneId: a.zoneId, normalisedZone: zonesById.get(a.zoneId).configuratorReference.normalised };
  const drw = drawingPlacement(a);
  const posKeys = isSleeve(web.side) ? ["s", "across"] : ["u", "v"];
  const dPos = Math.max(...posKeys.map((k) => Math.abs(web[k] - drw[k])));
  const dW = Math.abs(drw.w / web.w - 1), dH = Math.abs(drw.h / web.h - 1);
  const specOk = spc.zoneId === e.placement && Math.abs(spc.scale - web.scale) < 1e-4 && Math.abs(spc.offset[0] - web.offset[0]) < 1e-4 && Math.abs(spc.offset[1] - web.offset[1]) < 1e-4 && Math.abs(spc.aspect - web.aspect) < 0.002;
  // The drawing keeps each artwork's true proportions, so in a zone whose box proportions differ
  // between the 3D model and the flat (the flat is relatively wider) only the limiting side matches.
  const sizeOk = dW <= TOL_SIZE && dH <= TOL_SIZE;
  const aspectExplained = !sizeOk && Math.min(dW, dH) <= TOL_SIZE && Math.max(dW, dH) <= 0.2;
  const inside = drw.overflow <= 0.005;
  const dZone = Math.abs(drw.zoneWH / web.zoneWH - 1), dZoneH = Math.abs(drw.zoneH / web.zoneH - 1);
  const verdict = !specOk || dPos > TOL_POS || !inside ? "FAIL" : sizeOk && dZone <= TOL_SIZE && dZoneH <= TOL_SIZE ? "PASS" : aspectExplained ? "MINOR DIFFERENCE" : "FAIL";
  rows.push({ artworkId: a.artworkId, zone: e.placement, kind: a.artworkType, website: web, spec: spc, drawing: { ...drw, box: undefined }, diff: { position: r4(dPos), artworkWidthRel: r4(dW), artworkHeightRel: r4(dH), zoneHeightRel: r4(dZoneH), zoneShapeRel: r4(dZone), zoneWidthRel: r4(Math.abs(drw.zoneWH * drw.zoneH / (web.zoneWH * web.zoneH) - 1)), ...(web.zoneWofBody ? { zoneWidthShareOfBodyRel_info: r4(Math.abs(drw.zoneWofBody / web.zoneWofBody - 1)) } : {}) }, specMatchesWebsite: specOk, verdict, insideZoneOnDrawing: inside, note: !inside ? `Drawn ${Math.round(drw.overflow * 1000) / 10}% of the zone box outside the box (the website keeps it inside); size ${Math.round(Math.max(dW, dH) * 1000) / 10}% off — the drawn zone box is proportioned unlike the website's.` : aspectExplained ? `Same position and ${dW <= TOL_SIZE ? "width" : "height"}; the ${dW <= TOL_SIZE ? "height" : "width"} differs by ${Math.round(Math.max(dW, dH) * 1000) / 10}% because the drawing keeps the artwork's proportions while the flat's zone box is proportioned differently from the 3D model's.` : "" });
}
writeFileSync(join(QA, "placement-check.json"), JSON.stringify({ tolerances: { position: TOL_POS, sizeRelative: TOL_SIZE }, units: "position: body u, v as shares of the body; sleeve s as share of shoulder point → cuff seam, across as share of the zone width. Artwork: w as share of its zone's width, h as share of HPS → waistband top (body) or shoulder point → cuff seam (sleeve). Zone: zoneH as share of the same length, zoneWH = W:H. zoneWidthShareOfBodyRel_info = zone width as a share of the body width at the waistband — differs by design: the flat-laid body is wider for its length than the 3D model's front, and the drawing keeps the zone's true proportions instead.", rows }, null, 1) + "\n");

// ------------------------------------------------------------- 4 field survival website → spec
const checks = [];
const ck = (component, what, website, specVal, ok = JSON.stringify(website) === JSON.stringify(specVal)) => checks.push({ component, what, website, spec: specVal, result: ok ? "PASS" : "FAIL" });
const cw = (role) => spec.colourway.find((c) => c.role === role);
ck("colour", "body colour", config.colours.body, cw("Body")?.colourId.value);
ck("colour", "sleeve colour", config.colours.sleeves, cw("Sleeves")?.colourId.value);
ck("colour", "rib colour", config.colours.trim, cw("Rib — collar, cuffs, waistband (base)")?.colourId.value);
ck("colour", "snaps", config.buttons, cw("Snaps")?.colourId.value);
ck("material", "body material", "Cotton Fabric (felt)", `${cw("Body")?.material} (${config.materials.body})`, cw("Body")?.material === "Cotton Fabric" && config.materials.body === "felt");
ck("material", "sleeve material", "Leather", cw("Sleeves")?.material, cw("Sleeves")?.material === "Leather" && config.materials.sleeves === "leather");
ck("size", "size", config.size, spec.style?.requestedSampleSize?.value ?? spec.meta?.size ?? null, JSON.stringify(spec).includes(`"${config.size}"`));
for (const e of config.embroidery) {
  const a = spec.artwork.find((x) => x.elementId === e.id);
  ck("zone", `${a.artworkId} zone`, e.placement, a.zoneId);
  if (e.kind === "text") {
    ck("text", `${a.artworkId} text`, e.text, a.text.content);
    ck("text", `${a.artworkId} lines`, e.text.split("\n"), a.text.lines);
    ck("text", `${a.artworkId} font`, e.textStyle.fontId, a.text.fontId);
    ck("colour", `${a.artworkId} thread`, e.thread, a.threads[0]?.threadId.value);
  } else {
    ck("ready-made / letters", `${a.artworkId} design id`, e.image.library?.designId ?? e.image.frontLetters?.templateId, a.source.designId);
    if (e.image.frontLetters) ck("Front Letters", `${a.artworkId} letters`, e.image.frontLetters.letter1 + e.image.frontLetters.letter2, a.frontLetters.letter1 + a.frontLetters.letter2);
    if (e.image.colourway) for (const [slot, colour] of Object.entries(e.image.colourway.colours ?? {})) {
      const label = e.image.colourway.slots.find((s) => s.id === slot)?.label;
      const t = a.threads.find((x) => x.role === label);
      ck("Fill / Outline", `${a.artworkId} ${label}`, colour, t?.threadId.value);
    }
  }
  ck("scale", `${a.artworkId} scale`, e.inZone?.scale ?? 1, a.placement.normalizedScale);
  ck("offset", `${a.artworkId} offset`, [e.inZone?.x ?? 0, e.inZone?.y ?? 0], [a.placement.normalizedOffsetX, a.placement.normalizedOffsetY]);
}
for (const z of spec.embroideryZones) ck("normalized geometry", `${z.zoneId} normalised`, G.normalisedZone(G.EMBROIDERY_ZONES_BY_ID[z.zoneId]), z.configuratorReference.normalised);
ck("status", "document status", "NOT_FOR_BULK_PRODUCTION", spec.meta.documentStatus);
ck("status", "no production approval", false, JSON.stringify(spec).includes('"APPROVED_PRODUCTION"'));
ck("status", "QA label", "QA TEST — NOT A CUSTOMER ORDER — NOT FOR PRODUCTION", spec.meta.testDocument);
writeFileSync(join(QA, "spec-check.json"), JSON.stringify(checks, null, 1) + "\n");

// ------------------------------------------------------------- 5 comparison sheets
const colour = (role) => cw(role)?.hex;
const fills = fillsFor({ body: colour("Body"), sleeves: colour("Sleeves"), rib: colour("Rib — collar, cuffs, waistband (base)"), stripe: colour("Rib stripes"), snap: colour("Snaps") });
const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };
const href = (a) => { const f = join(RFQ, a.files.artwork ?? ""); return a.files.artwork && existsSync(f) ? `data:${MIME[extname(f)]};base64,${readFileSync(f).toString("base64")}` : null; };
const artworks = spec.artwork.map((a) => (a.artworkType === "TEXT" && a.threads[0]?.hex ? { ...a, tint: a.threads[0].hex } : a));
const zoneNo = new Map(spec.embroideryZones.map((z, i) => [z.zoneId, `Z${i + 1}`]));
const zones = spec.embroideryZones.map((z) => ({ ...z, label: zoneNo.get(z.zoneId) }));
const shotUri = (n) => `data:image/png;base64,${readFileSync(join(QA, "website", `${n}.png`)).toString("base64")}`;
const pc = (v) => `${Math.round(v * 1000) / 10}%`;
const fmt = (o) => (o.s !== undefined ? `s ${o.s} · across ${o.across}` : `u ${o.u} · v ${o.v}`) + `<br>art w ${o.w} (of zone) · h ${o.h}<br>zone h ${o.zoneH} · W:H ${o.zoneWH}`;
const tmp = join(OUT, ".tmp");
mkdirSync(tmp, { recursive: true });
const V = [
  ["01-front", "FRONT", "website-front", (o) => viewSvg("front", o), ["front"]],
  ["02-back", "BACK", "website-back", (o) => viewSvg("back", o), ["back"]],
  ["03-left-sleeve", "LEFT SLEEVE", "website-left-sleeve", (o) => sleeveSvg("leftSleeve", { ...o, wMm: 56 }), ["leftSleeve"]],
  ["04-right-sleeve", "RIGHT SLEEVE", "website-right-sleeve", (o) => sleeveSvg("rightSleeve", { ...o, wMm: 56 }), ["rightSleeve"]],
];
for (const [name, title, shotName, draw, sides] of V) {
  const svg = draw({ wMm: 112, hMm: 120, fills, zones, artworks, hrefOf: href, labels: true, boxes: true });
  const mine = rows.filter((r) => sides.includes(r.website.side));
  const table = mine.map((r) => `<tr><td><b>${esc(r.artworkId)}</b><div class="m">${esc(r.kind)} · ${esc(r.zone)}</div></td><td class="mono">${fmt(r.website)}<div class="m">scale ${r.website.scale} · offset ${r.website.offset.join(", ")}</div></td><td class="mono">${fmt(r.drawing)}</td><td class="mono">Δpos ${r.diff.position}<br>art ΔW ${pc(r.diff.artworkWidthRel)} · ΔH ${pc(r.diff.artworkHeightRel)}<br>zone ΔW ${pc(r.diff.zoneWidthRel)} · ΔH ${pc(r.diff.zoneHeightRel)} · Δshape ${pc(r.diff.zoneShapeRel)}<br>inside zone: ${r.insideZoneOnDrawing ? "yes" : "NO"}</td><td class="v ${r.verdict === "PASS" ? "ok" : r.verdict === "FAIL" ? "bad" : "warn"}">${r.verdict}<div class="m">${esc(r.note)}</div></td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4 landscape; margin: 0 } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff }
.sheet { width: 297mm; height: 210mm; box-sizing: border-box; padding: 6mm 8mm; display: flex; flex-direction: column }
.tb { display: flex; justify-content: space-between; align-items: end; border-bottom: .4mm solid #111; padding-bottom: 1.4mm }
.t { font-size: 11pt; font-weight: bold } .qa { background: #c00; color: #fff; font-weight: bold; font-size: 7.5pt; padding: .8mm 2mm }
.row { display: flex; gap: 4mm; margin-top: 2.5mm; height: 122mm } .row figure { margin: 0; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: .2mm solid #ccc }
.row img { max-width: 100%; max-height: 114mm; object-fit: contain } figcaption { font-size: 7pt; font-weight: bold; letter-spacing: .04em; margin-top: 1mm }
table { border-collapse: collapse; width: 100%; font-size: 6.5pt; margin-top: 2.5mm } th, td { border: .2mm solid #aaa; padding: .6mm 1mm; vertical-align: top; text-align: left } th { background: #eee }
.mono { font-family: Consolas, monospace } .m { color: #555; font-size: 5.9pt } .ok { color: #1a7f37; font-weight: bold } .warn { color: #9a6700; font-weight: bold } .bad { color: #c00; font-weight: bold }
</style></head><body><div class="sheet">
<div class="tb"><div class="t">${title} — WEBSITE vs TECHNICAL FLAT · synthetic QA design (${esc(spec.meta.designId)})</div><div class="qa">QA TEST — NOT A CUSTOMER ORDER — NOT FOR PRODUCTION</div></div>
<div class="row"><figure style="flex:0 0 122mm"><div style="width:120mm;height:114mm;overflow:hidden;position:relative"><img src="${shotUri(shotName)}" style="position:absolute;left:0;top:0;height:114mm;width:auto;max-width:none;max-height:none"></div><figcaption>WEBSITE — live configurator (3D), stage only</figcaption></figure><figure>${svg}<figcaption>TECHNICAL FLAT — RFQ renderer (canonical S.i. flat, not to scale)</figcaption></figure></div>
<table><thead><tr><th>Artwork</th><th>Website (normalised)</th><th>Drawing (projected back)</th><th>Difference</th><th>Verdict</th></tr></thead><tbody>${table || '<tr><td colspan="5">No artwork in this view.</td></tr>'}</tbody></table>
</div></body></html>`;
  const f = join(tmp, `${name}.html`);
  writeFileSync(f, html);
  execFileSync(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--screenshot=${join(OUT, `${name}-website-vs-drawing.png`)}`, "--window-size=1123,794", pathToFileURL(f).href], { stdio: "ignore" });
}
rmSync(tmp, { recursive: true, force: true });
for (const r of rows) console.log(r.artworkId.padEnd(26), r.verdict.padEnd(17), JSON.stringify(r.diff), r.specMatchesWebsite ? "spec=website" : "SPEC MISMATCH");
const fails = checks.filter((c) => c.result !== "PASS");
console.log(`field checks: ${checks.length - fails.length}/${checks.length} PASS`, fails.length ? JSON.stringify(fails) : "");
