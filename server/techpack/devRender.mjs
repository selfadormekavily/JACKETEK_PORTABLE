// Development Manufacturing Spec (JSON) → DEVELOPMENT TECH PACK HTML (A4 landscape), printed to PDF
// by server/techpack/development.mjs. Reads ONLY the spec and the artwork files it names.
// Every page: DEVELOPMENT TECH PACK · NOT FOR BULK PRODUCTION · NOT PRODUCTION APPROVED.
// Placement: the website's normalised zones (approved for development reference); physical cm
// placement is TO BE CALIBRATED FROM THE PHYSICAL SAMPLE and never printed as a number.
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fillsFor, sleeveSvg, viewSvg, canonicalFlat } from "../rfq/flats.mjs";
import { SHORT } from "../rfq/techflat/pomlabels.mjs";
import { canonicalSheets } from "../rfq/techflat/sheets.mjs";
import { zoneRatios } from "../rfq/techflat/zoneratios.mjs";
import { backPomSheet, keyMethodDrawings, lab, sleeveMethodDrawings, sleevePomSheet } from "./methodDrawings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const CSS = readFileSync(join(ROOT, "server", "rfq", "rfq.css"), "utf8");
const TEXT_FONT = readFileSync(join(ROOT, "public", "fonts", "embroidery", "tajawal.ttf")).toString("base64");
const MARKS = ["DEVELOPMENT TECH PACK", "NOT FOR BULK PRODUCTION", "NOT PRODUCTION APPROVED"];
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const table = (head, rows, cls = "") =>
  `<table class="grid ${cls}"><thead><tr>${head.map((h) => `<th${h.w ? ` style="width:${h.w}"` : ""}>${h.t ?? h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.join("")}</tr>`).join("")}</tbody></table>`;
const td = (html, cls = "") => `<td${cls ? ` class="${cls}"` : ""}>${html}</td>`;
const tbd = (t) => `<span class="tbd">${esc(t)}</span>`;
const tag = (t, c = "open") => `<span class="tag ${c}">${esc(t)}</span>`;
const sw = (hex) => (hex ? `<span class="swatch" style="background:${esc(hex)}"></span>` : '<span class="swatch none"></span>');
const cm = (v) => (typeof v === "number" ? `${v.toFixed(1)} cm` : null);
const pct = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 1000) / 10)} %`;
const GROUP_TAG = { "DEVELOPMENT TARGET": "cust", "DERIVED DEVELOPMENT VALUE": "sys", "PATTERN MAKER SET": "open", "REFERENCE ONLY": "ref" };
const TYPE_NAME = { READY_MADE: "Ready-made library design", FRONT_LETTERS: "Front Letters", TEXT: "Text embroidery", UPLOAD: "Customer upload", NUMBER_YEAR: "Number / year", CREST: "Crest", OTHER_LIBRARY_DESIGN: "Library design" };

const PAGINATE = `document.fonts.ready.then(() => {
  const SAFE = 6;
  const used = (m) => { const top = m.getBoundingClientRect().top + parseFloat(getComputedStyle(m).paddingTop); let b = top; for (const c of m.children) b = Math.max(b, c.getBoundingClientRect().bottom); return b - top; };
  const over = (m) => used(m) + parseFloat(getComputedStyle(m).paddingTop) > m.clientHeight - SAFE;
  const pages = [...document.querySelectorAll("section.page")];
  for (let i = 0; i < pages.length; i++) {
    const sec = pages[i], main = sec.querySelector("main.pb");
    if (!over(main)) continue;
    const t = [...main.querySelectorAll("table.split")].pop();
    if (!t || t.tBodies[0].rows.length < 2) continue;
    const next = sec.cloneNode(true), nm = next.querySelector("main.pb");
    const h2 = nm.querySelector("h2");
    nm.innerHTML = "";
    if (h2) { h2.textContent = h2.textContent.replace(/ \\(continued\\)$/, "") + " (continued)"; nm.appendChild(h2); }
    const c = next.querySelector(".ph-c");
    if (c) c.textContent = c.textContent.replace(/ \\(continued\\)$/, "") + " (continued)";
    const t2 = t.cloneNode(false);
    t2.appendChild(t.tHead.cloneNode(true));
    const tb = document.createElement("tbody");
    t2.appendChild(tb);
    nm.appendChild(t2);
    const tail = [];
    for (let n = t.nextSibling; n; n = n.nextSibling) tail.push(n);
    tail.forEach((n) => nm.appendChild(n));
    while (over(main) && t.tBodies[0].rows.length > 1) tb.insertBefore(t.tBodies[0].rows[t.tBodies[0].rows.length - 1], tb.firstChild);
    if (!tb.rows.length) t2.remove();
    sec.after(next);
    pages.splice(i + 1, 0, next);
  }
  const all = [...document.querySelectorAll("section.page")];
  all.forEach((p, i) => { const n = p.querySelector(".pno"); if (n) n.textContent = "Page " + (i + 1) + " of " + all.length; });
  const bad = [];
  all.forEach((p, i) => { const m = p.querySelector("main.pb"); if (m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1) bad.push(i + 1); });
  document.body.setAttribute("data-pages", String(all.length));
  document.body.setAttribute("data-overflow", bad.join(","));
  document.body.setAttribute("data-ready", "1");
});`;

const EXTRA_CSS = `
.ph-r.status { font-size: 6.4pt; text-align: center; line-height: 1.25; }
.dev-h1 { font-size: 26pt; line-height: 1.05; margin: 1mm 0 3mm; }
.banner.big { font-size: 12pt; line-height: 1.5; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.xs { font-size: 6.6pt; line-height: 1.22; }
.sizebig { font-size: 20pt; font-weight: bold; letter-spacing: .04em; }
td.sel, th.sel { background: #e8f0fb !important; font-weight: bold; }
.meth { display: grid; grid-template-columns: 128mm 128mm; gap: 2mm 6mm; }
.meth figure svg { width: 128mm; height: 118mm; } .meth-t { grid-column: 1 / span 2; font-size: 7.4pt; } .meth-t p { margin: 0 0 0.8mm; }
.placenote { border: 0.35mm solid #1d4f91; background: #eef4fb; padding: 1.6mm 3mm; margin: 2mm 0; font-size: 7.6pt; }
.cover { grid-template-columns: 1fr 182mm; }
.cov-views { display: flex; gap: 3mm; align-items: center; justify-content: center; }
.tech2 { display: flex; gap: 6mm; justify-content: center; align-items: flex-start; }
.zlegend td { font-size: 7pt; }
`;

export function renderDevelopmentHtml(spec, { artDir }) {
  const pages = [];
  const page = (title, body, cls = "") => pages.push({ title, body, cls });
  const m = spec.meta;
  const dm = spec.developmentMeasurements;
  const size = dm.selectedSize;

  // Artwork files: only those the spec names, only inside the package folder.
  const dataUrlOf = (rel) => {
    if (!rel) return null;
    const file = resolve(artDir, rel);
    const r = relative(artDir, file);
    if (!r || r.startsWith("..") || isAbsolute(r) || !existsSync(file)) return null;
    const mime = MIME[extname(file).toLowerCase()];
    return mime ? `data:${mime};base64,${readFileSync(file).toString("base64")}` : null;
  };
  const hrefCache = new Map();
  const hrefOf = (a) => {
    if (!hrefCache.has(a.artworkId)) hrefCache.set(a.artworkId, dataUrlOf(a.files.artwork));
    return hrefCache.get(a.artworkId);
  };
  const colour = (role) => spec.colourway.find((c) => c.role === role);
  const fills = fillsFor({ body: colour("Body")?.hex, sleeves: colour("Sleeves")?.hex, rib: colour("Rib — collar, cuffs, waistband (base)")?.hex, stripe: colour("Rib stripes")?.hex, snap: colour("Snaps")?.hex });
  // Text artwork is drawn in black on the server; shown in its fill thread, as on the website.
  const artworks = spec.artwork.map((a) => (a.artworkType === "TEXT" && a.threads[0]?.hex ? { ...a, tint: a.threads[0].hex } : a));
  const zoneNo = new Map(spec.embroideryZones.map((z, i) => [z.zoneId, `Z${i + 1}`]));
  const zones = spec.embroideryZones.map((z) => ({ ...z, label: zoneNo.get(z.zoneId) }));
  const usedZones = zones.filter((z) => z.used);
  const threadOf = (a, re) => a.threads.find((t) => re.test(t.role));
  const threadText = (t) => (t ? `${sw(t.hex)} ${esc(t.name ?? (t.hex ? `design colour ${t.hex}` : "—"))}${t.threadId.value ? ` <span class="mono xs">${esc(t.threadId.value)}</span>` : ` ${tag(t.threadId.status)}`}${t.asDesigned ? ' <span class="xs muted">as designed</span>' : ""}` : '<span class="muted">—</span>');
  const surface = (z) => (z?.side === "leftSleeve" || z?.side === "rightSleeve" ? `${spec.garment.sleeveMaterial.value} (sleeve)` : `${spec.garment.bodyMaterial.value} (body)`);
  const nameOf = (a) => (a.text ? `"${a.text.content.replace(/\n/g, " ⏎ ")}"` : a.frontLetters ? `Letters ${a.frontLetters.letter1} ${a.frontLetters.letter2} — ${a.frontLetters.style}` : a.source.originalFileName ?? a.source.designId ?? "—");
  const devVal = (id) => dm.rows.find((r) => r.id === id);

  // ---------------------------------------------------------------- 1 Cover
  page(
    "Cover / document status",
    `<div class="cover"><div class="cover-left">
      <div class="brand">JACKETEK</div>
      <h1 class="dev-h1">DEVELOPMENT<br>TECH PACK</h1>
      <div class="banner big">${MARKS.map(esc).join("<br>")}</div>
      <table class="kv">
        <tr><th>Design ID</th><td class="mono"><b>${esc(m.designId)}</b></td></tr>
        <tr><th>Revision</th><td><b>${esc(m.revision)}</b></td></tr>
        <tr><th>Generated</th><td>${esc(m.createdAt.slice(0, 16).replace("T", " "))} UTC</td></tr>
        <tr><th>Selected size</th><td><span class="sizebig">SELECTED SIZE: ${esc(size)}</span></td></tr>
        <tr><th>Design source</th><td>${esc(m.designSource)}</td></tr>
        <tr><th>Garment</th><td>${esc(spec.style.name)} · ${esc(spec.garment.fit.value ?? "")} · ${esc(spec.garment.shoulderConstruction.value ?? "")}</td></tr>
        <tr><th>Measurements</th><td>Development size chart ${esc(dm.chartVersion)} — <b>${esc(dm.status)}</b></td></tr>
        <tr><th>Document status</th><td>${esc(spec.documentStatus.statement)}</td></tr>
      </table></div>
      <div class="cover-right"><div class="cov-views">
        <figure>${viewSvg("front", { wMm: 66, hMm: 82, fills, zones, artworks, hrefOf, labels: false, boxes: false })}<figcaption>Front</figcaption></figure>
        <figure>${viewSvg("back", { wMm: 66, hMm: 82, fills, zones, artworks, hrefOf, labels: false, boxes: false })}<figcaption>Back</figcaption></figure>
        <figure>${sleeveSvg("leftSleeve", { wMm: 20, hMm: 82, fills, zones, artworks, hrefOf, labels: false, boxes: false })}<figcaption>L</figcaption></figure>
        <figure>${sleeveSvg("rightSleeve", { wMm: 20, hMm: 82, fills, zones, artworks, hrefOf, labels: false, boxes: false })}<figcaption>R</figcaption></figure>
      </div><p class="note center">The design exactly as configured on the website, on the canonical technical flat (S.i.-based derived drawing; factory sharing permitted by written licence confirmation held by JACKETEK). Not to scale.</p></div>
    </div>`
  );

  // ---------------------------------------------------------------- 2 Colourway / materials
  const roleRows = spec.colourway.map((c) => [
    td(`<b>${esc(c.role)}</b>`),
    td(`${sw(c.hex)} ${esc(c.name ?? "—")}`),
    td(`<span class="mono">${esc(c.hex ?? "—")}</span>`),
    td(c.colourId.value ? `<span class="mono">${esc(c.colourId.value)}</span>` : tbd("TBD")),
    td(esc(c.material ?? "—")),
    td(tag(c.colourId.status === "CUSTOMER_SELECTED" ? "WEBSITE DESIGN" : c.colourId.status === "SYSTEM_DERIVED" ? "AS SHOWN IN 3D PREVIEW" : c.colourId.status)),
  ]);
  page(
    "Garment overview — colourway and materials",
    `<div class="tech2"><figure>${viewSvg("front", { wMm: 84, hMm: 62, fills, boxes: false })}<figcaption>Front</figcaption></figure><figure>${viewSvg("back", { wMm: 84, hMm: 62, fills, boxes: false })}<figcaption>Back</figcaption></figure><figure>${sleeveSvg("leftSleeve", { wMm: 24, hMm: 62, fills })}<figcaption>Left</figcaption></figure><figure>${sleeveSvg("rightSleeve", { wMm: 24, hMm: 62, fills })}<figcaption>Right</figcaption></figure></div>` +
      table([{ t: "Part", w: "22%" }, { t: "Colour", w: "20%" }, { t: "HEX (screen)", w: "11%" }, { t: "Colour ID", w: "15%" }, { t: "Material", w: "16%" }, { t: "Source", w: "16%" }], roleRows, "dense") +
      `<table class="kv small" style="margin-top:2mm"><tr><th>Body material</th><td><b>${esc(spec.garment.bodyMaterial.value)}</b> <span class="muted mono xs">(${esc(spec.garment.bodyMaterial.note ?? "")})</span></td></tr><tr><th>Sleeve material</th><td><b>${esc(spec.garment.sleeveMaterial.value)}</b> <span class="muted mono xs">(${esc(spec.garment.sleeveMaterial.note ?? "")})</span></td></tr><tr><th>Snaps</th><td>${esc(spec.garment.closure.snapFinish.value ?? "—")} — metal snaps; count / spacing ${tbd("PATTERN MAKER SET")}</td></tr><tr><th>Zipper</th><td>${esc(spec.garment.closure.zipper.value ?? "—")}</td></tr></table>
      <p class="note">Colours, materials and finishes are read from the website design. HEX values describe the on-screen colour; physical colour standards (lab dips / supplier codes): ${tbd("TBD_SUPPLIER_PROPOSAL")}. Rib stripes follow the sleeve colour exactly as the 3D preview shows them.</p>`
  );

  // ---------------------------------------------------------------- 3–4 Technical flats
  const legend = table([{ t: "Zone", w: "16%" }, { t: "Name", w: "50%" }, { t: "Design", w: "34%" }], zones.map((z) => [td(`<b class="mono">${z.label}</b>`), td(esc(z.zoneName)), td(z.used ? `<b>${esc(spec.artwork.find((a) => a.zoneId === z.zoneId)?.artworkId ?? "used")}</b>` : '<span class="muted">—</span>')]), "dense zlegend");
  page(
    "Technical flats — front and back",
    `<div class="flats"><div class="flats-body"><figure>${viewSvg("front", { wMm: 112, hMm: 70, fills, zones, artworks, hrefOf })}<figcaption>A · FRONT</figcaption></figure><figure>${viewSvg("back", { wMm: 112, hMm: 70, fills, zones, artworks, hrefOf })}<figcaption>B · BACK</figcaption></figure></div>
      <div class="flat-notes" style="grid-column: span 3"><h3>Embroidery zones (website)</h3>${legend}<p class="note">Red dashed boxes: zones used by this design; grey: empty zones. Artwork is drawn at the website's normalised zone, scale and offset. <b>NOT TO SCALE.</b></p></div></div>`
  );
  page(
    "Technical flats — left and right sleeve",
    `<div class="tech2"><figure>${sleeveSvg("leftSleeve", { wMm: 60, hMm: 150, fills, zones, artworks, hrefOf })}<figcaption>C · LEFT SLEEVE (as worn)</figcaption></figure><figure>${sleeveSvg("rightSleeve", { wMm: 60, hMm: 150, fills, zones, artworks, hrefOf })}<figcaption>D · RIGHT SLEEVE (as worn)</figcaption></figure>
      <div class="flat-notes" style="max-width:90mm"><h3>Sleeves</h3><ul><li>Material: <b>${esc(spec.garment.sleeveMaterial.value)}</b> · ${sw(colour("Sleeves")?.hex)} ${esc(colour("Sleeves")?.name ?? "")}</li><li>Rib cuff: ${sw(colour("Rib — collar, cuffs, waistband (base)")?.hex)} ${esc(colour("Rib — collar, cuffs, waistband (base)")?.name ?? "")}, stripes ${esc(colour("Rib stripes")?.name ?? "")}</li><li>Sleeve zones: Upper / Middle / Lower on each sleeve's outer face.</li><li>Complete sleeve flats reconstructed from the canonical front flat: visual geometry only, not a pattern.</li></ul></div></div>`
  );

  // ---------------------------------------------------------------- 5 Development measurements (selected size)
  const rows = dm.rows.map((r) => [
    td(`<b class="mono">${esc(r.id)}</b>`),
    td(esc(r.name)),
    td(r.value === null ? '<span class="mono">S02-E − S09</span>' : `<b class="big">${esc(cm(r.value))}</b>`, r.value === null ? "sel" : "num sel"),
    td(tag(r.group, GROUP_TAG[r.group] ?? "open")),
    td(`<span class="xs">${esc(r.note)}</span>`),
  ]);
  const full = table(
    [{ t: "POM", w: "8%" }, { t: "Measurement", w: "32%" }, ...dm.sizes.map((s) => ({ t: s, w: "8%", sel: s === size }))].map((h) => (h.sel ? { ...h, t: `<span class="sel">${h.t} ◀</span>` } : h)),
    dm.fullTable.filter((r) => r.id !== "S01").map((r) => [td(`<span class="mono">${esc(r.id)}</span>`), td(`<span class="xs">${esc(r.name)}</span>`), ...dm.sizes.map((s) => td(r.bySize[s] === null ? '<span class="xs">S02-E − S09</span>' : r.bySize[s].toFixed(1), s === size ? "num sel" : "num"))]),
    "dense"
  );
  page(
    `Development measurements — SELECTED SIZE ${size}`,
    `<p class="lead"><span class="sizebig">SELECTED SIZE: ${esc(size)}</span> &nbsp; Development size chart ${esc(dm.chartVersion)} — <b>${esc(dm.status)}</b>. Garment measured flat, cm.</p>` +
      table([{ t: "POM", w: "8%" }, { t: "Measurement", w: "36%" }, { t: `Size ${size}`, w: "14%" }, { t: "Class", w: "18%" }, { t: "Rule", w: "24%" }], rows) +
      `<h3>All sizes (selected size highlighted)</h3>${full}
      <p class="note">S02 (primary sleeve, shoulder point → cuff seam) = S02-E − S09; S09 (cuff rib height) is set by the pattern maker, so S02 has no number yet. S01 (centre back → cuff) is a REFERENCE ONLY comparison with Golden Bear, never a JACKETEK target. Armhole, shoulder slope, rib heights, collar, placket, pockets and lining: ${tbd("PATTERN MAKER SET")} — validated on the physical sample.</p>`
  );

  // ---------------------------------------------------------------- 6–7 Measurement methods
  const v = (id) => devVal(id);
  const valText = (id) => (v(id)?.value === null || v(id) === undefined ? "TBD" : cm(v(id).value));
  const L = {
    B01: lab("B01", "HALF CHEST — FLAT WIDTH", valText("B01"), "DEV"),
    "B01-A": lab("B01-A", "FLAT WIDTH pit to pit (alt.)", "reference only", "REF"),
    B06: lab("B06", "CB LENGTH collar seam → edge", valText("B06"), "DEV"),
    "B06-T": lab("B06-T", "from TOP of collar (alt.)", "reference only", "REF"),
    B09: lab("B09", "ACROSS SHOULDER seam pt → seam pt", valText("B09"), "DERIVED"),
    S02: lab("S02", "PRIMARY: SP → CUFF SEAM", "S02-E − S09", "PATTERN"),
    "S02-E": lab("S02-E", "SECONDARY: SP → CUFF EDGE", valText("S02-E"), "DERIVED"),
    S01: lab("S01", "COMPARISON: CB → CUFF SEAM", "reference only", "REF"),
    "S01-E": lab("S01-E", "COMPARISON: CB → CUFF EDGE", "reference only", "REF"),
  };
  const k = keyMethodDrawings(L);
  page(
    `Measurement methods — B01, B06, B09 (size ${size})`,
    `<div class="meth"><figure>${k.front.svg}<figcaption>B01 HALF CHEST — FLAT WIDTH (circumference = × 2, derived)</figcaption></figure><figure>${k.back.svg}<figcaption>B06 CENTRE-BACK LENGTH · B09 ACROSS SHOULDER — back facing up</figcaption></figure>
     <div class="meth-t">
      <p><b class="mono">B01</b> Garment flat, front up, snaps closed, smoothed without stretching. Level: 2.54 cm (1") below the armhole point, down the side seam. Straight across, side seam to side seam = FLAT WIDTH. Circumference = flat width × 2 (derived, not measured).</p>
      <p><b class="mono">B06</b> Back facing up, rib relaxed. Centre back at the COLLAR SEAM → finished bottom edge of the waistband rib, straight along CB. (B06-T from the top of the collar: reference only.)</p>
      <p><b class="mono">B09</b> Back facing up. Left shoulder point → right shoulder point; dropped shoulder: where the sleeve-attachment seam crosses the shoulder line. Straight, seam point to seam point.</p>
      <p class="note">Values printed are the selected size's development values. Drawing not to scale; lines show where, not how long.</p></div></div>`
  );
  const sm = sleeveMethodDrawings(L);
  page(
    "Measurement methods — sleeve (never interchanged)",
    `<div class="meth"><figure>${sm.sleeve.svg}<figcaption>S02 PRIMARY and S02-E SECONDARY — sleeve laid straight</figcaption></figure><figure>${sm.back.svg}<figcaption>S01 / S01-E COMPARISON ONLY — from centre back</figcaption></figure>
     <div class="meth-t">${table([{ t: "Rank", w: "22%" }, { t: "Method", w: "62%" }, { t: `Size ${size}`, w: "16%" }], [
       [td("<b>PRIMARY</b> S02"), td("Shoulder point → <b>cuff seam</b> (rib excluded), along the overarm fold, sleeve laid straight."), td('<span class="mono">S02-E − S09</span>')],
       [td("<b>SECONDARY</b> S02-E"), td("Shoulder point → <b>finished cuff edge</b> (rib included, relaxed). Never reported as S02."), td(`<b>${esc(valText("S02-E"))}</b>`)],
       [td("<b>COMPARISON ONLY</b> S01 / S01-E"), td("Centre back at the collar seam → along the shoulder line → down the overarm → cuff seam / finished cuff edge. Never a JACKETEK target."), td('<span class="muted">reference only</span>')],
     ], "dense")}</div></div>`
  );

  // ---------------------------------------------------------------- 8 POM locations
  const D = {};
  for (const id of Object.keys(SHORT)) D[id] = { code: id, short: SHORT[id], value: "TBD", status: "SAMPLE", target: null };
  for (const r of dm.rows) if (D[r.id] && r.group !== "REFERENCE ONLY") D[r.id] = { ...D[r.id], value: r.value === null ? "TBD" : cm(r.value), status: r.group === "DEVELOPMENT TARGET" ? "DEV" : r.group === "DERIVED DEVELOPMENT VALUE" ? "DERIVED" : "PATTERN" };
  D.B01.short = "HALF CHEST — FLAT WIDTH";
  D.S01 = { ...D.S01, value: "reference only", status: "REF" };
  D.S02 = { ...D.S02, value: "S02-E − S09", status: "PATTERN" };
  for (const id of ["B10", "B11", "B14", "B15", "B16", "S09", "S10", "R01", "R05", "C01", "C02", "F03", "F04", "F05", "F07", "P03", "P04", "P05"]) if (D[id]) D[id].status = "PATTERN";
  const shared = canonicalSheets(canonicalFlat(), D);
  const own = { back: backPomSheet(D, L), sleeve: sleevePomSheet(D, L) };
  const POM_PAGE = { "05-front-pom": "front body", "05b-front-detail-pom": "front: neck, collar, opening, snaps, pockets", back: "back", sleeve: "sleeve", "08-rib-detail": "rib: collar, cuff, waistband" };
  for (const nm of Object.keys(POM_PAGE)) {
    const sh = own[nm] ?? shared.find((x) => x.name === nm);
    if (!(nm in own) && sh.ids.some((id) => id === "S01" || id === "S02")) throw new Error(`${nm}: a shared sheet with a sleeve-length line`);
    const tr = sh.ids.map((id) => [td(`<b class="mono">${esc(id)}</b>`), td(esc(D[id]?.short ?? L[id]?.short ?? id)), td(D[id] && D[id].value !== "TBD" ? `<b>${esc(D[id].value)}</b>` : L[id] ? esc(L[id].value) : tbd("TBD"))]);
    const multi = sh.drawings.length > 1;
    page(`POM locations — ${POM_PAGE[nm]} (size ${size})`, `<div class="pom-page${multi ? " multi" : ""}"><div class="pom-draw">${sh.drawings.map((d) => `<figure>${d.svg}${d.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : ""}</figure>`).join("")}</div><div class="pom-table">${table([{ t: "POM", w: "14%" }, { t: "Measurement", w: "56%" }, { t: size, w: "30%" }], tr, "dense pomd")}<p class="note">Blue lines: where each POM is measured. TBD values are set by the pattern maker and measured on the sample. Not to scale.</p></div></div>`);
  }

  // ---------------------------------------------------------------- 9 Placement schedule
  const sched = spec.artwork.map((a) => {
    const z = zones.find((x) => x.zoneId === a.zoneId);
    const r = z ? zoneRatios(z) : null;
    const p = a.placement;
    return [
      td(`<b class="mono">${esc(a.artworkId)}</b>`),
      td(`${esc(a.zoneName)}<br><span class="xs muted">${esc(z?.label ?? "")}</span>`),
      td(`${esc(TYPE_NAME[a.artworkType] ?? a.artworkType)}<br><span class="xs">${esc(nameOf(a))}</span>`),
      td(`<span class="mono xs">${esc(a.source.designId ?? "—")}</span>`),
      td(threadText(threadOf(a, /^fill/i) ?? a.threads[0])),
      td(threadText(threadOf(a, /^outline/i))),
      td(`<span class="mono">${p.normalizedScale}</span>`, "num"),
      td(`<span class="mono">${p.normalizedOffsetX} / ${p.normalizedOffsetY}</span>`, "num"),
      td(`<span class="mono xs">${esc(r ? `${r.centre} · ${r.width} · h ${r.height}` : "—")}</span>`),
      td(`<span class="xs">${esc(surface(z))}</span>`),
      td('<span class="tbd xs">FACTORY TO PROPOSE</span>'),
      td('<span class="tbd xs">CALIBRATE ON SAMPLE</span>'),
    ];
  });
  page(
    "Embroidery / patch placement schedule",
    `<div class="placenote"><b>${esc(spec.placementPolicy.normalized)}</b> — the website's own zones, scale and offsets (${esc(spec.placementPolicy.source)}). <b>${esc(spec.placementPolicy.physical)}</b> — no centimetre position or size is stated for any artwork.</div>` +
      (sched.length
        ? table([{ t: "Artwork", w: "10%" }, { t: "Zone", w: "8%" }, { t: "Type / content", w: "13%" }, { t: "Design ID", w: "8%" }, { t: "Fill", w: "9%" }, { t: "Outline", w: "9%" }, { t: "Scale", w: "5%" }, { t: "Offset X / Y", w: "7%" }, { t: "Normalised zone", w: "10%" }, { t: "Surface", w: "7%" }, { t: "Method", w: "7%" }, { t: "Physical cm", w: "7%" }], sched, "dense split")
        : '<p class="lead">This design has no embroidery or patches.</p>') +
      `<p class="note">Scale = share of the largest size that fits the zone (1 = fitted). Offset = shift of the artwork centre as a share of the zone width / height (+X right facing the zone, +Y up). Normalised zone: body u / v / h are shares of garment landmarks (CF / CB line, HPS → waistband top); sleeve s / h shares of shoulder point → cuff seam; W:H the zone's proportions.</p>`
  );

  // ---------------------------------------------------------------- 10 One page per artwork
  for (const a of artworks) {
    const z = zones.find((x) => x.zoneId === a.zoneId);
    const zr = z ? zoneRatios(z) : null;
    const p = a.placement;
    const href = hrefOf(a);
    const view = !z ? null : z.side === "front" || z.side === "back" ? viewSvg(z.side, { wMm: 112, hMm: 104, fills, zones, artworks: [a], hrefOf, highlight: z.zoneId }) : sleeveSvg(z.side, { wMm: 50, hMm: 104, fills, zones, artworks: [a], hrefOf, highlight: z.zoneId });
    const sizeText = p.normalizedScale >= 0.999 ? "100 % — fitted to the zone" : `${Math.round(p.normalizedScale * 1000) / 10} % of the largest size that fits the zone`;
    const where = p.normalizedOffsetX === 0 && p.normalizedOffsetY === 0 ? "Centred in the zone" : `Centre ${pct(p.normalizedOffsetX)} of zone width across · ${pct(p.normalizedOffsetY)} of zone height up`;
    const threads = a.threads.length
      ? a.threads.map((t) => `<tr><td>${esc(t.role)}</td><td>${threadText(t)}</td><td>${t.asDesigned ? "design's own colour" : "chosen on the website"}</td></tr>`).join("")
      : `<tr><td colspan="3">Original design colours (no colour change on the website) — thread matching ${tbd("TBD — factory proposal")}</td></tr>`;
    const textBlock = a.text
      ? `<h4>Text — exactly as entered (${a.text.lineCount} line${a.text.lineCount > 1 ? "s" : ""})</h4><div class="textbox" dir="${a.text.direction}">${a.text.lines.map((l) => `<div>${esc(l) || "&nbsp;"}</div>`).join("")}</div><table class="kv small"><tr><th>Font</th><td>${esc(a.text.font)}${a.text.fontId ? ` <span class="mono muted">(${esc(a.text.fontId)})</span>` : ""}</td></tr><tr><th>Direction / alignment</th><td>${a.text.direction === "rtl" ? "Right-to-left" : "Left-to-right"} · ${esc(a.text.alignment)}</td></tr></table>`
      : "";
    const lettersBlock = a.frontLetters ? `<table class="kv small"><tr><th>Letters (left · right)</th><td><b class="big-letters">${esc(a.frontLetters.letter1)} · ${esc(a.frontLetters.letter2)}</b></td></tr><tr><th>Letter template / style</th><td>${esc(a.frontLetters.style)} <span class="mono muted xs">${esc(a.frontLetters.templateId)}</span></td></tr><tr><th>Artwork</th><td class="xs">Rebuilt on the server from the corrected Front Letters template + these two letters (the same assets as the website).</td></tr></table>` : "";
    page(
      `Artwork — ${a.artworkId}`,
      `<div class="art-page"><div class="art-view"><figure>${view ?? tbd("Zone not in the fixed zone system")}<figcaption>${esc(a.zoneName)} (${esc(z?.label ?? "—")}) — ${esc(z?.garmentPanel ?? "")}</figcaption></figure>
        <div class="placenote xs"><b>NORMALIZED DESIGN PLACEMENT</b> — approved for development reference. <b>PHYSICAL CM PLACEMENT</b> — to be calibrated from the physical sample.</div></div>
        <div class="art-detail"><div class="art-head"><div class="preview">${href ? (a.tint ? `<span class="tinted" style="background-color:${esc(a.tint)};-webkit-mask-image:url(${href});mask-image:url(${href})"></span>` : `<img src="${href}" alt="">`) : tbd("No image")}</div>
          <table class="kv">
            <tr><th>Artwork ID</th><td class="mono"><b>${esc(a.artworkId)}</b></td></tr>
            <tr><th>Type</th><td>${esc(TYPE_NAME[a.artworkType] ?? a.artworkType)}</td></tr>
            <tr><th>Source</th><td>${esc(a.source.kind)}${a.source.libraryTitleEn || a.source.libraryTitle ? ` · ${esc(a.source.libraryTitleEn ?? "")}${a.source.libraryTitle ? ` (${esc(a.source.libraryTitle)})` : ""}` : ""}${a.source.libraryCode ? ` <span class="mono muted">[${esc(a.source.libraryCode)}]</span>` : ""}</td></tr>
            <tr><th>Design ID / file</th><td class="mono xs">${esc(a.source.designId ?? "—")}<br>${esc(a.source.originalFileName ?? "")}<br>${esc(a.files.artwork ?? "")}${a.files.original ? ` · ${esc(a.files.original)}` : ""}</td></tr>
            <tr><th>Material surface</th><td><b>${esc(surface(z))}</b></td></tr>
            <tr><th>Manufacturing method</th><td>${tbd("TBD — factory proposal")} <span class="xs muted">(website preview: satin embroidery)</span></td></tr>
          </table></div>
          ${textBlock}${lettersBlock}
          <h4>Placement (website)</h4>
          <table class="kv small">
            <tr><th>Zone</th><td>${esc(a.zoneName)} <span class="mono muted">${esc(a.zoneId)}</span></td></tr>
            <tr><th>Scale</th><td><b>${esc(sizeText)}</b> <span class="mono muted">(scale ${p.normalizedScale})</span></td></tr>
            <tr><th>Offset</th><td><b>${esc(where)}</b> <span class="mono muted">(x ${p.normalizedOffsetX}, y ${p.normalizedOffsetY})</span></td></tr>
            <tr><th>Normalised zone</th><td>${zr ? `<span class="mono">${esc(zr.centre)} · ${esc(zr.width)} · h ${esc(zr.height)}</span><br><span class="xs muted">${esc(zr.landmarks.join(". "))}.</span>` : tbd("TBD")}</td></tr>
            <tr><th>Artwork W:H</th><td class="mono">${a.aspect}</td></tr>
            <tr><th>Rotation</th><td>${a.placement.rotationDeg?.value ?? 0}° <span class="xs muted">(fixed zones do not rotate artwork)</span></td></tr>
            <tr><th>Physical size / position</th><td>${tbd("CALIBRATE FROM PHYSICAL SAMPLE")}</td></tr>
          </table>
          <h4>Colours</h4>
          <table class="grid dense"><thead><tr><th>Layer</th><th>Thread / colour</th><th>Source</th></tr></thead><tbody>${threads}</tbody></table>
        </div></div>`
    );
  }

  // ---------------------------------------------------------------- 11 Materials / construction
  const mi = spec.materialIntent;
  page(
    "Materials and construction — development status",
    (mi
      ? table([{ t: "ID", w: "6%" }, { t: "Component", w: "18%" }, { t: "JACKETEK design intent", w: "40%" }, { t: "Specification status", w: "36%" }], mi.components.map((c) => [td(`<span class="mono">${esc(c.id)}</span>`), td(`<b>${esc(c.name)}</b>`), td(`<span class="xs">${esc(c.designIntent)}</span>`), td(`<span class="xs">${esc(c.status)}</span>`)]), "dense split")
      : "") +
      `<p class="note"><b>This design:</b> body ${esc(spec.garment.bodyMaterial.value)} ${sw(colour("Body")?.hex)} ${esc(colour("Body")?.name ?? "")}, sleeves ${esc(spec.garment.sleeveMaterial.value)} ${sw(colour("Sleeves")?.hex)} ${esc(colour("Sleeves")?.name ?? "")}, rib ${esc(colour("Rib — collar, cuffs, waistband (base)")?.name ?? "")}, metal snaps ${esc(spec.garment.closure.snapFinish.value ?? "")}, lining required. Detailed specifications (GSM, leather thickness, rib composition, lining weight, snap diameter, SPI …): ${tbd("TBD_SUPPLIER_PROPOSAL")} / ${tbd("TBD_PATTERN_MAKER")} — not decided here. ${mi?.leatherPolicy ? `Leather is the sleeve design intent; synthetic / PU only as ${esc(mi.leatherPolicy.alternatives)}.` : ""}</p>`
  );

  // ---------------------------------------------------------------- 12 Open items / document control
  const conflicts = spec.conflicts.map((c) => [td(`<b class="mono">${esc(c.id)}</b>`), td(esc(c.topic)), td(tag(c.developmentStatus ?? "OPEN", c.developmentStatus === "RESOLVED" ? "ref" : "open"))]);
  page(
    "Development open items and document control",
    `<div class="two"><div><h3>Open development items</h3>${table([{ t: "ID", w: "12%" }, { t: "Topic", w: "60%" }, { t: "Status", w: "28%" }], conflicts, "dense")}
      <ul class="small"><li>Pattern maker: shoulder slope, armhole / sleeve cap, rib heights (S09 fixes S02), collar, placket and snap layout, pockets, lining.</li><li>Embroidery: physical zone sizes and positions — calibrate from the physical sample (K3).</li><li>Factory: material specifications, embroidery / patch method, backing and thread codes.</li></ul></div>
      <div><h3>Document control</h3><table class="kv small">
        <tr><th>Design ID</th><td class="mono">${esc(m.designId)}</td></tr><tr><th>Revision</th><td><b>${esc(m.revision)}</b></td></tr>
        <tr><th>Revisions of this design</th><td>${spec.revisionHistory.map((r) => esc(r.revision)).join(" · ")}</td></tr>
        <tr><th>Design source</th><td>${esc(m.designSource)}</td></tr>
        <tr><th>Master spec</th><td class="mono xs">${esc(m.masterSpec.file)}<br>sha256 ${esc(m.masterSpec.sha256 ?? "")}</td></tr>
        <tr><th>Size chart</th><td class="mono xs">${esc(dm.source)} (${esc(dm.chartVersion)})</td></tr>
        <tr><th>Artwork in this design</th><td>${spec.artwork.length} item(s) · zones used: ${usedZones.map((z) => esc(z.zoneName)).join(", ") || "none"}</td></tr>
        <tr><th>Status</th><td><b>${MARKS.map(esc).join(" · ")}</b></td></tr>
      </table></div></div>`
  );

  // ---------------------------------------------------------------- assemble
  const N = pages.length;
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>JACKETEK Development Tech Pack ${esc(m.designId)} ${esc(m.revision)} — ${MARKS.join(" · ")}</title>
<style>@font-face{font-family:"JK Text";src:url(data:font/ttf;base64,${TEXT_FONT}) format("truetype")}${CSS}${EXTRA_CSS}</style></head><body>`;
  const body = pages
    .map(
      (p, i) => `<section class="page ${p.cls}">
  <header class="ph"><div class="ph-l"><b>JACKETEK</b> · DEV TECH PACK · <span class="mono">${esc(m.designId)}</span> · ${esc(m.revision)} · <b>SIZE ${esc(size)}</b></div><div class="ph-c">${esc(p.title)}</div><div class="ph-r status">${MARKS[0]} · ${MARKS[1]}<br>${MARKS[2]}</div></header>
  <main class="pb">${i === 0 ? "" : `<h2>${esc(p.title)}</h2>`}${p.body}</main>
  <footer class="pf"><div>${m.testDocument ? `<span class="qa">${esc(m.testDocument)}</span> · ` : ""}${MARKS.join(" · ")}</div><div>${esc(m.designId)} · ${esc(m.revision)} · selected size ${esc(size)} · generated ${esc(m.createdAt.slice(0, 16).replace("T", " "))} UTC</div><div class="pno">Page ${i + 1} of ${N}</div></footer>
</section>`
    )
    .join("\n");
  return { html: `${head}${body}<script>${PAGINATE}</script></body></html>`, pageTitles: pages.map((p) => p.title) };
}
