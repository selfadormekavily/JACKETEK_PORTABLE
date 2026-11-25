#!/usr/bin/env node
// TECHNICAL FLAT REVIEW PACKAGE v2 — on the canonical (licensed S.i. Graphics) flat.
//
//   node scripts/techflat-review-v2.mjs [--out dev-output/review-flat-v2]
//
// Every sheet = the unchanged garment flat + a separate overlay (POM / colourway).
// <name>.svg is the composed drawing; <name>.overlay.svg the overlay alone (same view box);
// <name>.png an A4 landscape preview of the sheet (drawing + POM table).
// Measurement values come only from the master spec (garment-spec/…v0.1.json); unknowns print TBD.
// The working flat is a licensed derivative: these outputs stay in server-data (git-ignored).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadFlat } from "../server/rfq/techflat/canonical.mjs";
import { pomDisplay } from "../server/rfq/techflat/pomlabels.mjs";
import { canonicalSheets } from "../server/rfq/techflat/sheets.mjs";

const args = process.argv.slice(2);
const out = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : "dev-output/review-flat-v2");
mkdirSync(out, { recursive: true });
const master = JSON.parse(readFileSync("garment-spec/jacketek-master-spec-v0.1.json", "utf8"));
const D = pomDisplay(master);
const F = loadFlat();
const BROWSER = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------- sheet
const PROVISIONAL = "PROVISIONAL SILHOUETTE / CONSTRUCTION TO BE CONFIRMED ON SAMPLE";
const NOTE = "NOT TO SCALE. Garment flat: S.i. Graphics varsity flat (licensed), dropped shoulder as drawn — K1 (set-in vs dropped) still open. Measurement lines show HOW each POM is measured; values only from the JACKETEK Master Spec v0.1.";
const STATUS_TXT = { PROV: "PROVISIONAL", REF: "REFERENCE", SAMPLE: "MEASURE ON SAMPLE", PATTERN: "PATTERN MAKER", DERIVED: "DERIVED" };
function sheetHtml(title, drawings, ids, { tableW = 92 } = {}) {
  const rows = ids.map((id) => D[id]).map((p) => `<tr><td class="c">${p.code}</td><td><b>${esc(p.name)}</b><div class="m">${esc(p.method)}</div></td><td class="v">${esc(p.value)}</td><td class="s s-${p.status}">${STATUS_TXT[p.status]}</td></tr>`).join("");
  const table = ids.length ? `<div class="tab"><table><thead><tr><th>POM</th><th>Measurement / how to measure</th><th>M</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4 landscape; margin: 0 }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff }
.sheet { width: 297mm; height: 210mm; box-sizing: border-box; padding: 7mm 9mm 6mm; display: flex; flex-direction: column }
.tb { display: grid; grid-template-columns: 1fr auto; align-items: end; border-bottom: .4mm solid #111; padding-bottom: 1.6mm; font-size: 8pt }
.tb .t { font-size: 11pt; font-weight: bold; letter-spacing: .03em }
.tb .p { border: .3mm solid #8a5a00; color: #6b4600; background: #fff4d6; padding: .7mm 2mm; font-weight: bold; font-size: 7.4pt }
.main { flex: 1; display: flex; gap: 4mm; padding-top: 3mm; min-height: 0 }
.dr { flex: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3mm; align-content: center }
.dr figure { margin: 0; text-align: center } .dr figcaption { font-size: 7pt; font-weight: bold; letter-spacing: .04em; margin-top: 1mm }
.tab { width: ${tableW}mm }
table { border-collapse: collapse; width: 100%; font-size: 6.9pt }
th, td { border: .2mm solid #999; padding: .7mm 1mm; vertical-align: top; text-align: left }
th { background: #ececec; font-size: 6.4pt; text-transform: uppercase }
td.c { font-weight: bold; color: #0b4f8a; white-space: nowrap } td.v { white-space: nowrap; font-weight: bold }
.m { color: #444; font-size: 6.2pt; margin-top: .4mm } td.s { font-size: 5.9pt; font-weight: bold }
.s-PROV { color: #5a2386 } .s-REF { color: #111 } .s-SAMPLE, .s-PATTERN, .s-DERIVED { color: #8a5a00 }
.ft { border-top: .25mm solid #888; padding-top: 1.2mm; font-size: 6.6pt; color: #333; display: flex; justify-content: space-between; gap: 6mm }
</style></head><body><div class="sheet">
<div class="tb"><div><div class="t">${esc(title)}</div>JACKETEK · TECHNICAL FLAT REVIEW v2 · size M · canonical garment flat + separate overlays</div><div class="p">${PROVISIONAL}</div></div>
<div class="main"><div class="dr">${drawings.map((d) => `<figure>${d.svg}${d.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : ""}</figure>`).join("")}</div>${table}</div>
<div class="ft"><div>${esc(NOTE)}</div><div>Dimension lines: blue · TBD = no approved value</div></div>
</div></body></html>`;
}
const tmp = join(out, ".html");
mkdirSync(tmp, { recursive: true });
const report = { generatedAt: new Date().toISOString(), base: "garment-spec/working-varsity-flat (S.i. Graphics licensed flat)", masterSpec: "garment-spec/jacketek-master-spec-v0.1.json", sheets: [] };
function emit(name, title, drawings, ids = [], opts = {}) {
  // SVG: the first (main) drawing; overlay alone next to it.
  writeFileSync(join(out, `${name}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${drawings[0].svg}\n`);
  if (drawings[0].overlay) writeFileSync(join(out, `${name}.overlay.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${drawings[0].overlay}\n`);
  drawings.slice(1).forEach((d, i) => writeFileSync(join(out, `${name}.${String.fromCharCode(98 + i)}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${d.svg}\n`));
  const html = join(tmp, `${name}.html`);
  writeFileSync(html, sheetHtml(title, drawings, ids, opts));
  execFileSync(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--screenshot=${join(out, `${name}.png`)}`, "--window-size=1123,794", pathToFileURL(html).href], { stdio: "ignore" });
  report.sheets.push({ name, title, poms: ids, collisions: drawings.flatMap((d) => d.collisions ?? []) });
}
const sheets = canonicalSheets(F, D, { colourDemo: { fills: { body: "#64152B", sleeves: "#111111", rib: "#F4F4F4", stripe: "#111111", snap: "#c09a5c", welt: "#111111" }, title: "COLOURWAY OVERLAY — demo with order JK-261008-5V5E colours (garment geometry unchanged)" } });
for (const sh of sheets) emit(sh.name, sh.title, sh.drawings, sh.ids, { tableW: sh.tableW });

rmSync(tmp, { recursive: true, force: true });
const drawn = new Set(report.sheets.flatMap((s) => s.poms));
report.pomsNotDrawn = master.poms.map((p) => p.id).filter((id) => !drawn.has(id));
writeFileSync(join(out, "review-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`review package v2 → ${out}`);
for (const s of report.sheets) console.log(`  ${s.name}: ${s.poms.length} POMs${s.collisions.length ? `  LABEL COLLISIONS: ${s.collisions.join(", ")}` : ""}`);
console.log(`  POMs not drawn (table only / inside garment): ${report.pomsNotDrawn.join(", ")}`);
