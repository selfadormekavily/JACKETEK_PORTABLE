#!/usr/bin/env node
// Fidelio Varsity — 4-page TECH PACK generator (A4 portrait).
//
//   node build/populate.mjs --order <sheet.json> --out <file.pdf> [--html-only]
//
// <sheet.json> is a Production Sheet (src/features/production/orderToProductionOrder.ts).
// Artwork files it names are read from the same folder (scripts/production-pdf.mjs
// writes them there). Pages:
//   1 ORDER   2 MATERIAL + COLOUR   3 TECHNICAL FLAT + MEASUREMENTS   4 EMBROIDERY ARTWORK
// Measurements come only from data/official_size_chart.json (via data/measurements.json);
// everything else prints TO BE CONFIRMED. Prints `tbc: [...]` (JSON) on stdout.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DRAWING, flatBounds, flatGeometry, flatSvg, line, poly } from "../flats/varsityFlat.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const sheetPath = opt("--order");
if (!sheetPath) {
  console.error("usage: node build/populate.mjs --order <sheet.json> --out <file.pdf> [--html-only]");
  process.exit(1);
}
const outPdf = resolve(opt("--out") ?? join(ROOT, "..", "tech_pack.pdf"));
const htmlOnly = args.includes("--html-only");

const stripBom = (s) => s.replace(/^\uFEFF/, "");
const readJson = (p) => JSON.parse(stripBom(readFileSync(p, "utf8")));
const sheet = readJson(resolve(sheetPath));
const artDir = dirname(resolve(sheetPath));
const chart = readJson(join(ROOT, "data/official_size_chart.json"));
const spec = readJson(join(ROOT, "data/measurements.json"));

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TBC = '<span class="tbc">TO BE CONFIRMED</span>';
const CAL = '<span class="tbc">TO BE CALIBRATED</span>';
// Safety net (runs before printing): a card never clips its rows — its table is
// set a little smaller (down to 72 %) until its last row is inside the card.
const FIT_CARDS = `document.fonts.ready.then(() => {
  for (const card of document.querySelectorAll(".card")) {
    const kv = card.querySelector("table.kv");
    if (!kv) continue;
    const fits = () => kv.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 2;
    for (let z = 0.96; !fits() && z >= 0.72; z -= 0.04) kv.style.zoom = String(z);
  }
});`;
const tbcList = [];
const n1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

// ---------------------------------------------------------------------------
// Measurements for the ordered size (data/measurements.json):
//   confirmed — the official size chart, as approved
//   derived   — Blender pattern value × (official value for this size / pattern value)
//               of the confirmed measurement it is calibrated against
//   fixed     — verified pattern detail, the same for every size
//   tbc       — no reliable data: printed TO BE CONFIRMED
const row = chart.rows.find((r) => r.size === sheet.size.chart);
if (!row) throw new Error(`size ${sheet.size.chart} is not on the official size chart`);
const cm = (s) => parseFloat(String(s));
const factor = Object.fromEntries(
  Object.entries(spec.calibration).map(([k, c]) => [k, cm(row[c.chart]) / c.pattern_value])
);
const POM = spec.points.map((p) => {
  let v = null;
  if (p.status === "confirmed") v = cm(row[p.chart]);
  else if (p.status === "derived") v = p.pattern * factor[p.calibrate];
  else if (p.status === "fixed") v = p.value;
  if (v === null) tbcList.push(`MEASUREMENT_${p.code} ${p.name}`);
  return { ...p, value: v };
});
const pom = Object.fromEntries(POM.map((p) => [p.code, p]));
const g = flatGeometry({ chestFlat: pom.A.value, length: pom.B.value, sleeve: pom.C.value });
const Lm = g.landmarks;

// ---------------------------------------------------------------------------
// SVG helpers (cm, y up → SVG y down).
const fx = (n) => (Math.round(n * 100) / 100).toString();
const P = ([x, y]) => [x, -y];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mulv = (a, k) => [a[0] * k, a[1] * k];
const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const mirrorPt = ([x, y]) => [-x, y];

/** Height (mm) that shows `region` at `widthMm` wide without empty bands. */
const fitH = (region, widthMm, margin = 0) => (widthMm * (region.y1 - region.y0 + 2 * margin)) / (region.x1 - region.x0 + 2 * margin);

/** An <svg> sized in mm on the page, for a region in cm. Returns { open, u } (u = cm per mm). */

/** The artwork's size and position inside its fixed area, for the sheet. */
function placementInArea(img, dense = false) {
  const { sizeShare, offsetCm: [x, y] } = img.zonePlacement;
  const signed = (v) => `${v >= 0 ? "+" : "−"}${n1(Math.abs(v))}`;
  if (dense) {
    const size = sizeShare >= 0.999 ? "fitted" : `${Math.round(sizeShare * 100)} % of fitted`;
    const where = x === 0 && y === 0 ? "centred" : `centre ${signed(x)} across / ${signed(y)} up cm <span class="muted">(facing)</span>`;
    return `<b>${size}</b> · ${where}`;
  }
  const size = sizeShare >= 0.999 ? "fitted to the area (largest that fits)" : `${Math.round(sizeShare * 100)} % of the largest that fits`;
  const where = x === 0 && y === 0 ? "centred in the area" : `centre ${signed(x)} cm across / ${signed(y)} cm up from the area centre <span class="muted">(facing the zone)</span>`;
  return `<b>${size}</b> · ${where}<br><span class="muted">the area is fixed; the artwork stays wholly inside it</span>`;
}

function svgBox(region, widthMm, heightMm, margin = 0) {
  const w = region.x1 - region.x0 + 2 * margin, h = region.y1 - region.y0 + 2 * margin;
  const u = Math.max(w / widthMm, h / heightMm);
  const vw = widthMm * u, vh = heightMm * u;
  const x = (region.x0 + region.x1) / 2 - vw / 2, y = -(region.y0 + region.y1) / 2 - vh / 2;
  return {
    open: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fx(x)} ${fx(y)} ${fx(vw)} ${fx(vh)}" style="width:${widthMm}mm;height:${heightMm}mm" font-family="Arial, Helvetica, sans-serif">`,
    u,
  };
}

/**
 * Dimension: a → b measured, drawn offset by `off` cm (perpendicular,
 * positive = left of a→b). Label at fraction t along the line.
 */
function dim(a, b, off, label, u, { t = 0.5, real = false, labelSide = 1 } = {}) {
  const d = norm(sub(b, a)), n = [-d[1], d[0]];
  const A = addv(a, mulv(n, off)), B = addv(b, mulv(n, off));
  const ext = 1.2 * u; // extension past the dimension line
  const thin = 'stroke="#000" stroke-width="0.45" vector-effect="non-scaling-stroke"';
  const out = [];
  if (Math.abs(off) > 0.01) {
    const s = Math.sign(off);
    out.push(line([addv(a, mulv(n, s * 0.8 * u)), addv(A, mulv(n, s * ext))], thin));
    out.push(line([addv(b, mulv(n, s * 0.8 * u)), addv(B, mulv(n, s * ext))], thin));
  }
  // Arrowheads (filled), 1.6 mm long — outside the extension lines when the dimension is short.
  const ah = 1.6 * u, aw = 0.55 * u, fs = 2.15 * u;
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const short = len < 2.6 * ah;
  const head = (tip, dir) => poly([tip, addv(addv(tip, mulv(dir, ah)), mulv(n, aw)), addv(addv(tip, mulv(dir, ah)), mulv(n, -aw))], 'fill="#000" stroke="none"');
  if (short) {
    out.push(line([addv(A, mulv(d, -2 * ah)), addv(B, mulv(d, 2 * ah))], thin));
    out.push(head(A, mulv(d, -1)), head(B, d));
  } else {
    out.push(line([A, B], thin));
    out.push(head(A, d), head(B, mulv(d, -1)));
  }
  // Label: upright, along the line, on a white backing (beyond the arrow when short).
  const labelW = String(label).length * fs * 0.56;
  // Short and mostly vertical: a horizontal label beside the line; short otherwise: beyond the arrow.
  const besideV = short && Math.abs(d[1]) > 0.7;
  const at = besideV ? addv(A, mulv(sub(B, A), 0.5)) : short ? addv(B, mulv(d, 2.4 * ah + labelW / 2)) : addv(A, mulv(sub(B, A), t));
  const M = addv(at, mulv(n, besideV ? labelSide * (labelW / 2 + 1.2 * u) : short ? 0 : labelSide * 1.9 * u));
  let ang = besideV ? 0 : (Math.atan2(-d[1], d[0]) * 180) / Math.PI; // SVG angle
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const [mx, my] = P(M);
  out.push(
    `<g transform="translate(${fx(mx)} ${fx(my)}) rotate(${fx(ang)})"><text x="0" y="${fx(fs * 0.36)}" font-size="${fx(fs)}" text-anchor="middle" font-weight="${real ? 700 : 400}" paint-order="stroke" stroke="#fff" stroke-width="${fx(fs * 0.5)}">${esc(label)}</text></g>`
  );
  return out.join("");
}
/** Status mark used on the drawing and in the table. */
const MARK = { confirmed: "C", derived: "D", fixed: "F", tbc: "TBC" };
const dlabel = (code) => (pom[code].value === null ? `${code}  TBC` : `${code}  ${n1(pom[code].value)} ${MARK[pom[code].status]}`);

/** Line intersection of p + s·r with q + t·v. */
function intersect(p, r, q, v) {
  const den = r[0] * v[1] - r[1] * v[0];
  const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
  return addv(p, mulv(r, t));
}

// Geometry shortcuts.
const d = Lm.sleeveDir, pIn = Lm.sleeveAcross;
const sleeveR = (t) => addv(Lm.SP, mulv(d, t)); // point on the right sleeve's outer edge
const innerSeam = { p: Lm.UA, r: sub(Lm.sleeveEndInner, Lm.UA) };
const acrossAt = (t) => { const o = sleeveR(t); return [o, intersect(o, pIn, innerSeam.p, innerSeam.r)]; };
/**
 * Across the sleeve as the front flat shows it: outer edge → the armhole
 * (above the underarm the body covers the rest) or the inner seam below it.
 */
const armhole = g.parts.sleeveR.slice(0, -2); // SP → UA
function visibleAcrossAt(t) {
  const [o, seam] = acrossAt(t);
  let reach = Math.hypot(...sub(seam, o));
  for (let i = 0; i < armhole.length - 1; i++) {
    const a = armhole[i], w = sub(armhole[i + 1], a);
    const den = pIn[0] * w[1] - pIn[1] * w[0];
    if (Math.abs(den) < 1e-9) continue;
    const s = ((a[0] - o[0]) * w[1] - (a[1] - o[1]) * w[0]) / den; // along pIn
    const k = ((a[0] - o[0]) * pIn[1] - (a[1] - o[1]) * pIn[0]) / den; // along the armhole segment
    if (k >= 0 && k <= 1 && s > 1e-6) reach = Math.min(reach, s);
  }
  return [o, addv(o, mulv(pIn, reach))];
}
const regionAll = flatBounds(g);
const regionTorso = { x0: -g.W - 5, x1: g.W + 5, y0: -1.5, y1: Lm.collarTopY + 2 };

const FILLS = {
  body: sheet.colours.body.hex, sleeves: sheet.colours.sleeves.hex, rib: sheet.colours.trim.hex, stripe: sheet.colours.sleeves.hex,
  welt: sheet.colours.sleeves.hex, snap: sheet.colours.snaps.hex, inside: sheet.colours.body.hex, tab: "#ffffff",
};

// ---------------------------------------------------------------------------
// Page furniture.
const PAGES = ["ORDER", "MATERIAL + COLOUR", "TECHNICAL FLAT + MEASUREMENTS", "EMBROIDERY ARTWORK"];
// Pages 5+: one embroidery stitch map per digitized artwork (with stored stitch data).
const MAPPED = sheet.images.filter((i) => i.digitized?.stitchMap);
const TOTAL = 4 + MAPPED.length;
const lineTag = sheet.line.count > 1 ? ` · LINE ${sheet.line.index + 1}/${sheet.line.count}` : "";
// LEGACY WARNING — this sheet's measurements come from the legacy size chart
// (data/official_size_chart.json), not the JACKETEK Master Garment Spec. Printed on every page
// (band above the header, line under the footer, watermark), boxed on page 1 and on the
// measurement page, so a page opened on its own cannot pass for a factory specification.
const LEGACY_WARNING = ["LEGACY REFERENCE ONLY", "DO NOT SEND TO FACTORY", "NOT JACKETEK MASTER SPEC", "VALUES REQUIRE RE-VALIDATION"];
const LEGACY_SOURCE = "Measurements come from the legacy size chart (production-drawing/data/official_size_chart.json, 2026-10-02), not the JACKETEK Master Garment Spec. Factory documents are the RFQ Tech Packs.";
const legacyBox = (cls) => `<div class="legacy-box ${cls}"><div class="lw">${LEGACY_WARNING.join("<br>")}</div><div class="ls">${LEGACY_SOURCE}</div></div>`;
const page = (n, body, title = PAGES[n - 1], units = "UNITS: CM · DO NOT SCALE DRAWINGS") => `
<section class="page">
  <div class="legacy-band">${LEGACY_WARNING.join(" · ")}</div>
  <div class="legacy-mark" aria-hidden="true">LEGACY · DO NOT SEND TO FACTORY</div>
  <header class="hdr">
    <div class="brand">FIDELIO <span>VARSITY · TECH PACK</span></div>
    <div class="title"><b>${String(n).padStart(2, "0")}</b> ${title}</div>
    <div class="ref">ORDER <b>${esc(sheet.productionId)}</b> · SIZE <b>${esc(sheet.size.chart)}</b>${lineTag}</div>
  </header>
  <main class="body">${body}</main>
  <footer class="ftr"><div>${units}</div><div>${esc(sheet.date)}</div><div>PAGE <b>${n}</b> / ${TOTAL}</div></footer>
  <div class="legacy-foot">${LEGACY_WARNING.join(" · ")}</div>
</section>`;

const kv = (rows) => `<table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;
const sw = (hex) => `<span class="sw" style="background:${esc(hex)}"></span>`;

// ---------------------------------------------------------------------------
// PAGE 1 — ORDER
function page1() {
  const del = sheet.delivery;
  const rows = [
    ["ORDER ID", `<b>${esc(sheet.orderId)}</b>${sheet.line.count > 1 ? ` &nbsp;·&nbsp; line ${sheet.line.index + 1} of ${sheet.line.count} (${esc(sheet.productionId)})` : ""}`],
    ["CUSTOMER", esc(sheet.customer.name)],
    ["PHONE", sheet.customer.phone ? esc(sheet.customer.phone) : "—"],
    ["ORDER DATE", esc(sheet.date)],
    ["JACKET SIZE", `<b>${esc(sheet.size.chart)}</b>${sheet.size.ordered !== sheet.size.chart ? ` (ordered as ${esc(sheet.size.ordered)})` : ""}`],
    ["FIT", esc(sheet.fit.name)],
    ["QUANTITY", `<b>${esc(sheet.quantity)}</b>`],
  ];
  if (del) rows.push(["DELIVERY", [del.address, [del.area, del.city].filter(Boolean).join(", ")].filter(Boolean).map(esc).join("<br>") + (del.notes ? `<br><span class="muted">${esc(del.notes)}</span>` : "")]);
  const w = 88, h = fitH(regionAll, w, 2);
  const v = (view) => { const b = svgBox(regionAll, w, h, 2); return `${b.open}${flatSvg(g, view)}</svg>`; };
  return page(1, `
    <div class="p1">
      ${kv(rows)}
      <div class="flats2">
        <figure>${v("front")}<figcaption>FRONT</figcaption></figure>
        <figure>${v("back")}<figcaption>BACK</figcaption></figure>
      </div>
      ${legacyBox("p1")}
    </div>`);
}

// ---------------------------------------------------------------------------
// PAGE 2 — MATERIAL + COLOUR
function page2() {
  // (What prints TO BE CONFIRMED here is already listed in the adapter's gaps.)
  const rows = sheet.materials.map((m) => {
    const material = m.material === null ? TBC : esc(m.material);
    let colour, code;
    if (m.colours === null) {
      colour = TBC;
      code = TBC;
    } else if (m.colours.length === 0) {
      colour = "—";
      code = "—";
    } else {
      colour = m.colours.map((c) => `${c.role ? `<span class="muted">${esc(c.role)}:</span> ` : ""}${esc(c.name)}`).join("<br>");
      code = m.colours.map((c) => `${sw(c.hex)}<span class="mono">${esc(c.hex.toUpperCase())}</span>`).join("<br>");
    }
    return `<tr><td class="part">${esc(m.part)}<small>${esc(m.pieces === "—" ? "" : m.pieces === "1" || /^\d+$/.test(m.pieces) ? `${m.pieces} pc${m.pieces === "1" ? "" : "s"}` : m.pieces)}</small></td><td>${material}${m.note ? `<small>${esc(m.note)}</small>` : ""}</td><td>${colour}</td><td>${code}</td></tr>`;
  });
  const w = 90, h = fitH(regionAll, w, 2);
  const v = (view) => { const b = svgBox(regionAll, w, h, 2); return `${b.open}${flatSvg(g, view, { fills: FILLS })}</svg>`; };
  const legend = [
    ["Body", sheet.colours.body], ["Sleeves · pocket welts · rib stripes", sheet.colours.sleeves],
    ["Collar · cuffs · waistband (rib)", sheet.colours.trim], ["Snaps", sheet.colours.snaps],
  ].map(([k, c]) => `<div>${sw(c.hex)}<b>${esc(c.name)}</b> <span class="mono">${esc(c.hex.toUpperCase())}</span><span class="muted"> — ${esc(k)}</span></div>`).join("");
  return page(2, `
    <table class="spec mat"><thead><tr><th>PART</th><th>MATERIAL</th><th>COLOR</th><th>COLOR CODE</th></tr></thead><tbody>${rows.join("")}</tbody></table>
    <div class="note">Color codes: website catalogue sRGB hex. Physical colour standard (Pantone / lab dip): ${TBC}.</div>
    <div class="flats2 map">
      <figure>${v("front")}<figcaption>COLOR MAP — FRONT</figcaption></figure>
      <figure>${v("back")}<figcaption>COLOR MAP — BACK</figcaption></figure>
    </div>
    <div class="legend">${legend}<div>${sw("#ffffff")}<b>Front tabs</b><span class="muted"> — colour ${TBC}</span></div></div>`);
}

// ---------------------------------------------------------------------------
// PAGE 3 — TECHNICAL FLAT + MEASUREMENTS
function frontDims(u) {
  const out = [];
  const W = g.W, L = g.L, nh = Lm.HPS[0];
  const SPl = mirrorPt(Lm.SP);
  // A — 1/2 chest, underarm to underarm.
  out.push(dim([-W, Lm.UA[1] - 1.5], [W, Lm.UA[1] - 1.5], 0, dlabel("A"), u, { t: 0.74, real: true }));
  // B — front length, HPS to hem.
  out.push(dim([-nh, L], [-nh, 0], 0, dlabel("B"), u, { t: 0.62, real: true, labelSide: -1 }));
  // E — shoulder width, above the collar (offset = left of a→b = up).
  out.push(dim(SPl, Lm.SP, Lm.collarTopY + 3.5 - Lm.SP[1], dlabel("E"), u, { t: 0.3 }));
  // F — hem width, below the waistband (a→b runs right to left: left = down).
  out.push(dim([g.ribW, 0], [-g.ribW, 0], 4, dlabel("F"), u, { t: 0.3 }));
  // G — armhole straight (right).
  out.push(dim(Lm.SP, Lm.UA, 2.2, dlabel("G"), u, { labelSide: 1 }));
  // C — sleeve length along the right sleeve's outer edge.
  out.push(dim(Lm.SP, Lm.cuffEndOuter, 3.5, dlabel("C"), u, { real: true }));
  // H, I across the left sleeve; J, K at the left cuff.
  const [ho, hi] = acrossAt((Lm.UA[0] - Lm.SP[0]) * d[0] + (Lm.UA[1] - Lm.SP[1]) * d[1]);
  out.push(dim(mirrorPt(hi), mirrorPt(ho), 0, dlabel("H"), u, { labelSide: -1 }));
  const [eo, ei] = acrossAt(g.S * 0.55);
  out.push(dim(mirrorPt(ei), mirrorPt(eo), 0, dlabel("I"), u, { labelSide: -1 }));
  // Left cuff: J across the cuff end (beyond it), K along its outer side.
  const c = g.parts.cuffL;
  out.push(dim(c[1], c[2], -3.2, dlabel("J"), u, { labelSide: -1 }));
  out.push(dim(c[0], c[1], 3.4, dlabel("K"), u, { labelSide: 1 }));
  // Pockets: N, O on the right welt; P, Q on the left; R from CF.
  const wr = g.parts.weltR, wl = g.parts.weltL;
  out.push(dim(wr[0], wr[1], 2, dlabel("N"), u));
  out.push(dim(wr[1], wr[2], 2.4, dlabel("O"), u, { labelSide: 1 }));
  out.push(dim(wl[1], wl[2], -2.2, dlabel("P"), u, { labelSide: -1 }));
  const xl = (wl[2][0] + wl[3][0]) / 2;
  out.push(dim([xl - 3.4, 0], [xl - 3.4, DRAWING.pocket.y0 * L], 0, dlabel("Q"), u, { labelSide: -1, t: 0.72 }));
  const xr = (wr[2][0] + wr[3][0]) / 2;
  out.push(dim([0, DRAWING.pocket.y0 * L - 2.5], [xr, DRAWING.pocket.y0 * L - 2.5], 0, dlabel("R"), u, { t: 0.62 }));
  // S — placket, front edge to the snap line.
  out.push(dim([Lm.placketX, Lm.frontNeckCF[1] - 4], [0, Lm.frontNeckCF[1] - 4], 0, dlabel("S"), u, { labelSide: 1 }));
  // T — waistband height (right side).
  out.push(dim([g.ribW, 0], [g.ribW, g.wb], -3, dlabel("T"), u, { labelSide: -1 }));
  return out.join("");
}
function backDims(u) {
  const out = [];
  out.push(dim([0, Lm.backNeckCB[1]], [0, 0], 0, dlabel("D"), u, { t: 0.55, labelSide: -1 }));
  // L — collar height, beside the collar on the viewer's left (left of upward travel).
  out.push(dim([0, Lm.backNeckCB[1]], [0, Lm.collarTopY], Lm.HPS[0] + 3, dlabel("L"), u, { labelSide: 1 }));
  out.push(dim([-Lm.HPS[0], g.L], [Lm.HPS[0], g.L], Lm.collarTopY + 3 - g.L, dlabel("M"), u));
  return out.join("");
}
function page3() {
  const reg = { ...regionAll, y0: regionAll.y0 - 9, y1: regionAll.y1 + 7, x0: regionAll.x0 - 3, x1: regionAll.x1 + 3 };
  const F = svgBox(reg, 188, Math.min(98, fitH(reg, 188)));
  const regB = { ...regionAll, y1: regionAll.y1 + 10, y0: regionAll.y0 - 1, x1: regionAll.x1 + 2 };
  const Bk = svgBox(regB, 76, fitH(regB, 76, 1), 1);
  const groups = ["BODY", "SLEEVE", "COLLAR", "POCKET", "CONSTRUCTION"];
  const ordered = groups.flatMap((gname) => POM.filter((p) => p.group === gname));
  // Split between two tables at a group boundary near the middle.
  const half = ordered.findIndex((p, i) => i >= ordered.length / 2 - 2 && p.group !== ordered[i - 1]?.group);
  const table = (list) => {
    let last = "";
    return `<table class="spec pom"><thead><tr><th>POM</th><th>MEASUREMENT</th><th>HOW TO MEASURE</th><th class="val">${esc(sheet.size.chart)}</th><th class="st">SOURCE</th></tr></thead><tbody>${list
      .map((p) => {
        const head = p.group !== last ? `<tr class="grp"><td colspan="5">${p.group}</td></tr>` : "";
        last = p.group;
        const value = p.value === null ? '<span class="dash">—</span>' : p.status === "confirmed" ? `<b>${n1(p.value)}</b>` : n1(p.value);
        return `${head}<tr class="s-${p.status}"><td class="code">${p.code}</td><td>${esc(p.name)}</td><td class="how">${esc(p.how)}</td><td class="val">${value}</td><td class="st"><span class="badge b-${p.status}">${MARK[p.status]}</span></td></tr>`;
      })
      .join("")}</tbody></table>`;
  };
  const legend = `<div class="mlegend">
      <span><span class="badge b-confirmed">C</span> LEGACY CHART (2026-10-02) — conflicts with Master Garment Spec v0.1; confirm before production</span>
      <span><span class="badge b-derived">D</span> DERIVED — Blender pattern calibrated</span>
      <span><span class="badge b-fixed">F</span> FIXED — verified detail, currently non-graded</span>
      <span><span class="badge b-tbc">TBC</span> requires supplier confirmation</span>
    </div>`;
  return page(3, `${legacyBox("p3")}
    <figure class="tech">${F.open}${flatSvg(g, "front")}${frontDims(F.u)}</svg><figcaption>FRONT — SIZE ${esc(sheet.size.chart)} · DRAWN TO SCALE FOR A / B / C ONLY · OTHER VALUES BY DIMENSION</figcaption></figure>
    <div class="p3row">
      <figure class="tech back">${Bk.open}${flatSvg(g, "back")}${backDims(Bk.u)}</svg><figcaption>BACK</figcaption></figure>
      ${panels()}
    </div>
    ${legend}
    <div class="poms">${table(ordered.slice(0, half))}${table(ordered.slice(half))}</div>`);
}

/** Panel breakdown: the main pieces, drawn at one common scale from the flat. */
function panels() {
  const { parts } = g;
  const cuffRect = [[0, 0], [g.cuffW, 0], [g.cuffW, g.ch], [0, g.ch]];
  const weltRect = (() => { const w = parts.weltR; const ww = Math.hypot(w[1][0] - w[0][0], w[1][1] - w[0][1]); const hh = Math.hypot(w[1][0] - w[2][0], w[1][1] - w[2][1]); return [[0, 0], [ww, 0], [ww, hh], [0, hh]]; })();
  // Sleeves stood upright (axis vertical) for the breakdown.
  const turn = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  const pieces = [
    ["01", "FRONT LEFT", "1", parts.front.right, "body"],
    ["02", "FRONT RIGHT", "1", parts.front.left, "body"],
    ["03", "BACK", "1", parts.back.whole, "body"],
    ["04", "LEFT SLEEVE", "1", turn(parts.sleeveR, -g.th), "sleeves"],
    ["05", "RIGHT SLEEVE", "1", turn(parts.sleeveL, g.th), "sleeves"],
    ["06", "COLLAR", "1", parts.collarBack, "rib"],
    ["07", "CUFF", "2", cuffRect, "rib"],
    ["08", "POCKET WELT", "2", weltRect, "sleeves"],
    ["09", "WAISTBAND", "1", parts.waistband, "rib"],
  ];
  const bb =(pts) => ({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) });
  // One scale for all: fit the largest piece into a cell.
  const cellW = 34, cellH = 15;
  const scale = Math.max(...pieces.map(([, , , pts]) => { const b = bb(pts); return Math.max((b.x1 - b.x0) / (cellW - 2), (b.y1 - b.y0) / (cellH - 2)); }));
  const mat = { body: sheet.materials[0].material, sleeves: sheet.materials[1].material, rib: "Rib knit" };
  const cells = pieces.map(([no, name, qty, pts, m]) => {
    const b = bb(pts);
    const vw = cellW * scale, vh = cellH * scale;
    const cx = (b.x0 + b.x1) / 2, cy = -(b.y0 + b.y1) / 2;
    return `<div class="piece"><svg viewBox="${fx(cx - vw / 2)} ${fx(cy - vh / 2)} ${fx(vw)} ${fx(vh)}" style="width:${cellW}mm;height:${cellH}mm">${poly(pts, 'fill="#fff" stroke="#000" stroke-width="0.7" vector-effect="non-scaling-stroke"')}</svg><div class="pn"><b>${no}</b> ${name}</div><div class="pq">× ${qty} · ${esc(mat[m] ?? "")}</div></div>`;
  });
  return `<div class="panels"><div class="sec">PANEL BREAKDOWN <span class="muted">— pieces per jacket, one common scale</span></div><div class="pieces">${cells.join("")}</div></div>`;
}

// ---------------------------------------------------------------------------
// PAGE 4 — EMBROIDERY ARTWORK
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp", ".svg": "image/svg+xml" };
function dataUrl(file) {
  const p = join(artDir, file);
  if (!existsSync(p)) throw new Error(`artwork file ${file} is missing next to the sheet`);
  return `data:${MIME[extname(file).toLowerCase()] ?? "application/octet-stream"};base64,${readFileSync(p).toString("base64")}`;
}

const isSleeve = (img) => img.side === "leftSleeve" || img.side === "rightSleeve";
const SIDE_NAMES = { front: "front", back: "back", leftSleeve: "left sleeve, outer side", rightSleeve: "right sleeve, outer side" };

/**
 * A sleeve zone's artwork on the front flat (the left sleeve as worn is
 * the flat's right-hand sleeve): centred across the sleeve as the flat
 * shows it (outer edge to armhole), at its stored distance below the
 * shoulder point, upright along the sleeve (its top toward the shoulder),
 * at its stored size.
 */
function sleevePlacementSvg(img, wMm, hMm) {
  const left = img.side === "leftSleeve";
  const side = left ? (p) => p : mirrorPt;
  const t = img.belowSpCm ?? 0;
  const [outer, inner] = visibleAcrossAt(t);
  const c = side(mulv(addv(outer, inner), 0.5));
  // A margin keeps the dimension along the shoulder inside the frame.
  const b = svgBox(regionAll, wMm, hMm, 4);
  const u = b.u;
  const w = img.widthCm, h = img.heightCm;
  const [sx, sy] = P(c);
  const deg = (g.th * 180) / Math.PI;
  // SVG turns clockwise: the left sleeve leans out to the right, the right one to the left.
  const turn = (left ? -deg : deg) - img.rotation;
  const rot = `rotate(${fx(turn)} ${fx(sx)} ${fx(sy)})`;
  const thin = 'stroke="#000" stroke-width="0.45" vector-effect="non-scaling-stroke"';
  const frame = `<rect x="${fx(sx - w / 2)}" y="${fx(sy - h / 2)}" width="${fx(w)}" height="${fx(h)}" fill="none" stroke="#000" stroke-width="0.6" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>`;
  let art;
  if (img.digitized) {
    const e = img.digitized.metadata.extents, m = 1;
    const svg = readFileSync(join(artDir, img.digitized.previewFile), "utf8");
    const box = `x="${fx(c[0] + (e.minX - m) / 10)}" y="${fx(-(c[1] + (e.maxY + m) / 10))}" width="${fx((e.maxX - e.minX + 2 * m) / 10)}" height="${fx((e.maxY - e.minY + 2 * m) / 10)}"`;
    art = `<g transform="${rot}">${svg.replace(/^<svg /, `<svg ${box} `)}${frame}</g>`;
  } else {
    art = `<g transform="${rot}"><image href="${dataUrl(img.processed.file)}" x="${fx(sx - w / 2)}" y="${fx(sy - h / 2)}" width="${fx(w)}" height="${fx(h)}" preserveAspectRatio="none"/>${frame}</g>`;
  }
  const cross = `<line x1="${fx(sx - 1.2)}" y1="${fx(sy)}" x2="${fx(sx + 1.2)}" y2="${fx(sy)}" ${thin}/><line x1="${fx(sx)}" y1="${fx(sy - 1.2)}" x2="${fx(sx)}" y2="${fx(sy + 1.2)}" ${thin}/>`;
  const sp = side(Lm.SP);
  const [px, py] = P(sp);
  const refs = `<circle cx="${fx(px)}" cy="${fx(py)}" r="${fx(0.5)}" fill="#000"/><text x="${fx(px + (left ? 0.9 : -0.9))}" y="${fx(py - 0.9)}" font-size="${fx(1.9 * u)}" text-anchor="${left ? "start" : "end"}">SP</text>`;
  // Along the sleeve's outer edge, outside it.
  const dims = dim(sp, side(sleeveR(t)), left ? 2.6 : -2.6, `${n1(t)} below SP`, u, { real: true });
  return `${b.open}${flatSvg(g, "front")}${refs}${art}${cross}${dims}</svg>`;
}

/** The artwork on the flat at its stored size, position and rotation. */
function placementSvg(img, wMm, hMm) {
  if (isSleeve(img)) return sleevePlacementSvg(img, wMm, hMm);
  const front = img.side === "front";
  const cx = front ? img.reference.xCm : -img.reference.xCm; // back view: viewer's right = wearer's right
  const cy = g.L - img.belowHpsCm;
  const b = svgBox(regionTorso, wMm, hMm, 0);
  const u = b.u;
  const w = img.widthCm, h = img.heightCm;
  const [sx, sy] = P([cx, cy]);
  const thin = 'stroke="#000" stroke-width="0.45" vector-effect="non-scaling-stroke"';
  // The digitized stitch field (already turned as sewn) at its true size; without a
  // design, the processed artwork. The dashed box is the artwork's frame.
  const frame = `<rect x="${fx(sx - w / 2)}" y="${fx(sy - h / 2)}" width="${fx(w)}" height="${fx(h)}" fill="none" stroke="#000" stroke-width="0.6" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" transform="rotate(${fx(-img.rotation)} ${fx(sx)} ${fx(sy)})"/>`;
  let art;
  if (img.digitized) {
    const e = img.digitized.metadata.extents, m = 1; // preview margin, mm
    const svg = readFileSync(join(artDir, img.digitized.previewFile), "utf8");
    const box = `x="${fx(cx + (e.minX - m) / 10)}" y="${fx(-(cy + (e.maxY + m) / 10))}" width="${fx((e.maxX - e.minX + 2 * m) / 10)}" height="${fx((e.maxY - e.minY + 2 * m) / 10)}"`;
    art = `${svg.replace(/^<svg /, `<svg ${box} `)}${frame}`;
  } else {
    art = `<g transform="rotate(${fx(-img.rotation)} ${fx(sx)} ${fx(sy)})"><image href="${dataUrl(img.processed.file)}" x="${fx(sx - w / 2)}" y="${fx(sy - h / 2)}" width="${fx(w)}" height="${fx(h)}" preserveAspectRatio="none"/></g>${frame}`;
  }
  const cross = `<line x1="${fx(sx - 1.2)}" y1="${fx(sy)}" x2="${fx(sx + 1.2)}" y2="${fx(sy)}" ${thin}/><line x1="${fx(sx)}" y1="${fx(sy - 1.2)}" x2="${fx(sx)}" y2="${fx(sy + 1.2)}" ${thin}/>`;
  // Reference lines: CF / CB and the HPS level.
  const ref = 'stroke="#000" stroke-width="0.4" stroke-dasharray="6 2 1 2" vector-effect="non-scaling-stroke"';
  const refs = `${line([[0, -1], [0, Lm.collarTopY + 1.5]], ref)}${line([[-g.W - 4, g.L], [g.W + 4, g.L]], ref)}
    <text x="${fx(0.6)}" y="${fx(-(Lm.collarTopY + 0.4))}" font-size="${fx(1.9 * u)}">${front ? "CF" : "CB"}</text>
    <text x="${fx(-g.W - 4)}" y="${fx(-(g.L + 0.6))}" font-size="${fx(1.9 * u)}">HPS</text>`;
  const r = Math.hypot(w, h) / 2;
  const dims = [
    Math.abs(cx) > 0.3 ? dim([0, cy - r - 2.2], [cx, cy - r - 2.2], 0, `${n1(img.fromCentreCm)} from ${front ? "CF" : "CB"}`, u, { real: true, labelSide: -1 }) : "",
    dim([cx + (cx >= 0 ? 1 : -1) * (r + 2.4), g.L], [cx + (cx >= 0 ? 1 : -1) * (r + 2.4), cy], 0, `${n1(img.belowHpsCm)} below HPS`, u, { real: true, labelSide: cx >= 0 ? -1 : 1 }),
  ].join("");
  return `${b.open}${flatSvg(g, img.side)}${refs}${art}${cross}${dims}</svg>`;
}

/** The stitch preview on the garment colour, sized in mm on the page. */
function stitchPreviewBox(img, sizeMm) {
  const svg = readFileSync(join(artDir, img.digitized.previewFile), "utf8");
  return `<div class="art digi" style="width:${sizeMm}mm;height:${sizeMm}mm;background:${esc(sheet.colours.body.hex)}">${svg.replace(/^<svg /, '<svg style="width:100%;height:100%" ')}</div>`;
}

function artworkCard(img, layout) {
  const src = img.original ? dataUrl(img.original.file) : dataUrl(img.processed.file);
  const px = (w, h) => (w && h ? `${w} × ${h} px` : "px size not recorded");
  const typeName = (m) => (m ?? "").replace("image/", "").replace("svg+xml", "svg").toUpperCase();
  const { artMm, diagW, dense, horizontal, thumb } = layout;
  const seamRows = [["ABOVE HEM / SHOULDER SEAM", CAL]];
  const fileRows = dense
    ? [
        ["SOURCE FILE", img.original ? `“${esc(img.original.customerFileName)}” · ${typeName(img.original.mimeType)} · ${px(img.original.widthPx, img.original.heightPx)}<br><span class="mono">${esc(img.original.file)}</span>` : `<span class="tbc">ORIGINAL NOT STORED</span>`],
        ["PROCESSED", img.text ? "none — drawn from the order's text and font" : img.asUploaded ? "none — the upload is used as-is" : `PNG · ${px(img.processed.widthPx, img.processed.heightPx)}<br><span class="mono">${esc(img.processed.file)}</span>`],
      ]
    : null;
  const dg = img.digitized?.metadata;
  const digiRows = dg
    ? [
        ["DESIGN ID", `<b class="mono">${esc(dg.designId)}</b>`],
        ["STITCHES", `<b>${dg.stitchCount.toLocaleString("en-US")}</b> · ${dg.threads.length} colour${dg.threads.length > 1 ? "s" : ""} · ${dg.trims} trims · ${dg.jumps} jumps`],
        ["STITCH FIELD", `${n1(dg.widthMm / 10)} × ${n1(dg.heightMm / 10)} cm <span class="muted">as sewn, ${dg.rotationDeg}° applied in the file</span>`],
        ["STITCH TYPES", (["fill", "satin", "running", "underlay"]).filter((t) => dg.stitchTypes[t]).map((t) => `${t} ${dg.stitchTypes[t].toLocaleString("en-US")}`).join(" · ")],
        ...(dense ? [] : [["DENSITY / UNDERLAY", `fill ${dg.density.fillSpacingMm} mm rows · ${dg.density.fillStitchMm} mm stitch · satin ${dg.density.satinSpacingMm} mm<br><span class="muted">underlay: tatami ${esc(dg.underlay.fill.split(",")[0].replace("tatami ", ""))} under fills, ${esc(dg.underlay.satin)} under satin</span>`]]),
        ["THREADS", dg.threads.map((t) => `${sw(t.hex)}<span class="mono">${esc(t.hex)}</span> <span class="muted">${esc(t.types.join("/"))}</span>`).join("&nbsp; ")],
        ["EMBROIDERY FILE", `<span class="mono">${esc(img.digitized.dstFile)}</span>${dense ? "" : ' <span class="muted">+ .json metadata, _PREVIEW.svg</span>'}`],
      ]
    : [["EMBROIDERY FILE", '<span class="tbc">NOT DIGITIZED</span>']];
  const sleeve = isSleeve(img);
  const ref = img.side === "front" ? "CF" : "CB";
  const position = sleeve
    ? `centred on the sleeve's outer side · <b>${n1(img.belowSpCm)} cm</b> below SP <span class="refb">REF</span>`
    : `<b>${n1(img.fromCentreCm)} cm</b> ${img.towards === "centre" ? `on ${ref}` : `from ${ref} to ${img.towards}`} · <b>${n1(img.belowHpsCm)} cm</b> below HPS <span class="refb">REF</span>`;
  // Fixed zones: the locked box, and where the customer placed the artwork inside it.
  // Dense cards: one line for both.
  const zoneRow = !img.zoneBoxCm
    ? []
    : dense && img.zonePlacement
      ? [["ZONE / PLACED", `<b>${n1(img.zoneBoxCm[0])} × ${n1(img.zoneBoxCm[1])} cm</b> fixed · ${placementInArea(img, true)}`]]
      : [
          ["FIXED ZONE", `<b>${n1(img.zoneBoxCm[0])} × ${n1(img.zoneBoxCm[1])} cm</b> <span class="muted">design ${img.zonePlacement ? "placed" : "fitted"} inside, proportions kept${img.zonePlacement ? "" : ", centred"}</span>`],
          ...(img.zonePlacement ? [["PLACEMENT IN AREA", placementInArea(img)]] : []),
        ];
  const sizeRot = `<b>${n1(img.widthCm)} × ${n1(img.heightCm)} cm</b> · <b>${img.rotation}°</b>${img.sizeSource === "aspect" ? ' <span class="muted">(size recalculated — older order)</span>' : ""}`;
  // Dense cards (several artworks): one line per fact.
  const denseRows = [...digiRows, ...zoneRow, ["SIZE / ROTATION", sizeRot], ["POSITION", position], ["HEM / SHOULDER", CAL]];
  const placeRows = sleeve
    ? [
        ["ACROSS SLEEVE", `centred on the outer side <span class="refb">REF</span>`],
        ["BELOW SP", `<b>${n1(img.belowSpCm)} cm</b> <span class="muted">shoulder point, along the sleeve</span> <span class="refb">REF</span>`],
      ]
    : [
        ["FROM " + ref, `<b>${n1(img.fromCentreCm)} cm</b> ${img.towards === "centre" ? "on centre" : `to ${img.towards}`} <span class="refb">REF</span>`],
        ["BELOW HPS", `<b>${n1(img.belowHpsCm)} cm</b> <span class="refb">REF</span>`],
      ];
  // Ready-made library designs: which one (source library, file, production code, id).
  const libRow = img.library
    ? [["LIBRARY DESIGN", `<b>${esc(img.library.libraryTitle)}</b>${img.library.productionName ? ` · code <b>${esc(img.library.productionName)}</b>` : ""}${img.library.originalFileName ? ` · ${esc(img.library.originalFileName)}` : ""}<br><span class="mono">${esc(img.library.id)}</span>`]]
    : [];
  // Text embroidery: the customer's text, set in its own font, and the font.
  if (img.text) {
    const lines = img.text.content.split("\n").length;
    const font = `<b>${esc(img.text.fontName)}</b> <span class="mono">${esc(img.text.fontId)}</span>`;
    const layoutNote = `${img.text.direction === "rtl" ? "right-to-left" : "left-to-right"} · lines centred · ${n1(img.text.fitScale * 100)}% of the zone height`;
    // The customer's own line breaks, always; dense cards set the text smaller, with the font on the same row.
    libRow.push(["TEXT EMBROIDERY", `<span class="stitchtext${dense ? " sm" : ""}" dir="auto" style="font-family:${[img.text.fontFamily, ...img.text.fallbackFontFamilies].map((f) => `'${esc(f)}'`).join(",")}">${esc(img.text.content).replace(/\n/g, "<br>")}</span>${lines > 1 ? ` <span class="muted">(${lines} lines, as the customer broke them)</span>` : ""}<br>${dense ? `${font} · ` : ""}<span class="muted">${layoutNote}</span>`]);
    if (!dense) libRow.push(["FONT", `${font}${img.text.fallbackFontIds.length ? `<br><span class="muted">other script in: ${img.text.fallbackFontIds.map(esc).join(", ")}</span>` : ""}`]);
    else if (img.text.fallbackFontIds.length) libRow.push(["OTHER SCRIPT", `<span class="mono">${img.text.fallbackFontIds.map(esc).join(", ")}</span>`]);
  }
  // Colourway designs: the thread chosen for each colour region.
  // One line per colour layer (FILL, OUTLINE…): each is stitched in its own thread.
  if (img.colourway) libRow.push(["COLOUR LAYERS", img.colourway.slots.map((s) => `<b>${esc(s.label.toUpperCase())}</b> ${s.thread ? `${sw(s.thread.hex)}<b>${esc(s.thread.name)}</b> <span class="mono">${esc(s.thread.hex)}</span>${s.asDesigned ? ` <span class="muted">as designed</span>` : ""}` : `${sw(s.defaultColor)}<span class="muted">original</span>`}`).join("<br>")]);
  // Front Letters designs: the style (template) and the customer's two letters.
  // (Dense cards: the template id is left out when the library row already shows it.)
  if (img.frontLetters) {
    const templateShown = dense && img.library?.id.includes(img.frontLetters.templateId);
    libRow.push(["FRONT LETTERS", `STYLE: <b>${esc(img.frontLetters.style)}</b>${dense ? " · " : "<br>"}LETTERS: <b>${esc(img.frontLetters.letter1)} ${esc(img.frontLetters.letter2)}</b>${templateShown ? "" : `<br><span class="mono">template ${esc(img.frontLetters.templateId)}</span>`}`]);
  }
  if (dense) denseRows.unshift(...libRow);
  const rows = dense ? denseRows : [
    ...digiRows,
    ...libRow,
    ["LOCATION", `<b>${esc(img.zoneName.toUpperCase())}</b> · ${SIDE_NAMES[img.side] ?? img.side}`],
    ...zoneRow,
    ["SIZE (W × H)", `<b>${n1(img.widthCm)} × ${n1(img.heightCm)} cm</b> <span class="muted">(${Math.round(img.widthCm * 10)} × ${Math.round(img.heightCm * 10)} mm)</span>${img.sizeSource === "aspect" ? `<br><span class="muted">${img.text ? "fitted to the drawn text" : "recalculated — older order"}</span>` : ""}`],
    ["ROTATION", `<b>${img.rotation}°</b> <span class="muted">${img.rotation ? "counter-clockwise, as viewed" : ""}</span>`],
    ...placeRows,
    ...seamRows,
    // Orders placed before the fixed zones: their free placement.
    ...(dense || dg || img.zoneBoxCm ? [] : [["CONFIGURATOR", `zone offset x ${img.offsetCm[0] >= 0 ? "+" : "−"}${n1(Math.abs(img.offsetCm[0]))} / y ${img.offsetCm[1] >= 0 ? "+" : "−"}${n1(Math.abs(img.offsetCm[1]))} cm · scale ×${img.scale.toFixed(2)}`]]),
    ...(dg ? [] : [["THREAD", img.thread ? `${sw(img.thread.hex)}${esc(img.thread.name)} <span class="mono">${esc(img.thread.hex.toUpperCase())}</span>` : "Design's own colours"]]),
    ...(fileRows ?? [
      ["SOURCE FILE", img.original ? `<span class="mono">${esc(img.original.file)}</span><br><span class="muted">customer file “${esc(img.original.customerFileName)}” · ${typeName(img.original.mimeType)} · ${px(img.original.widthPx, img.original.heightPx)}</span>` : `<span class="tbc">ORIGINAL NOT STORED</span> <span class="muted">(order placed before originals were kept)</span>`],
      ["PROCESSED", img.text ? "none — drawn from the order's text and font" : img.asUploaded ? "none — the upload is used as-is" : `<span class="mono">${esc(img.processed.file)}</span><br><span class="muted">transparent PNG · ${px(img.processed.widthPx, img.processed.heightPx)}</span>`],
    ]),
  ];
  // The diagram keeps its region's proportions (no empty bands), within the space it has:
  // the torso, or the whole flat for a sleeve.
  const region = sleeve ? regionAll : regionTorso;
  const diagH = Math.min(layout.diagH, fitH(region, diagW));
  const diagWide = Math.min(diagW, (diagH * (region.x1 - region.x0)) / (region.y1 - region.y0));
  const srcLabel = img.text
    ? `SOURCE ARTWORK — text in ${img.text.fontName}`
    : img.frontLetters
    ? `SOURCE ARTWORK — front letters ${img.frontLetters.letter1} ${img.frontLetters.letter2}`
    : img.library
    ? "SOURCE ARTWORK — ready-made library design"
    : img.original ? "SOURCE ARTWORK — customer upload" : "SOURCE ARTWORK — processed (original not stored)";
  let artBox, sourceBox;
  if (img.digitized) {
    // The digitized stitches are the production embroidery; the upload is reference only.
    artBox = `${stitchPreviewBox(img, artMm)}<div class="artcap">DIGITIZED EMBROIDERY PREVIEW${dense ? "" : " — the stitch file, as sewn"}</div>`;
    const t = thumb ?? Math.max(12, artMm * 0.42);
    sourceBox = `<div class="thumbrow"><div class="art" style="width:${t}mm;height:${t}mm"><img src="${src}" alt=""></div><div class="artcap left">${srcLabel}<br><span class="muted">reference only — not the production file</span></div></div>`;
  } else {
    artBox = `<div class="art" style="width:${artMm}mm;height:${artMm}mm"><img src="${src}" alt=""></div><div class="artcap">${srcLabel}</div>`;
    sourceBox = "";
  }
  const diagram = `<figure class="diag">${placementSvg(img, diagWide, diagH)}<figcaption>PLACEMENT${dense ? "" : ` — ${esc(img.zoneName.toUpperCase())}`} · ${(SIDE_NAMES[img.side] ?? img.side).toUpperCase()}</figcaption></figure>`;
  const status = img.digitized ? `<span class="digi-status">${esc(img.digitized.status.toUpperCase())}</span>` : "";
  const head = `<div class="ah"><b>ARTWORK ${String(img.n).padStart(2, "0")}${dense ? ` · ${esc(img.zoneName.toUpperCase())}` : ""}</b>${dense ? "" : status}</div>${dense && status ? `<div class="statusrow">${status}</div>` : ""}`;
  return `<div class="card${dense ? " dense" : ""}${horizontal ? " horiz" : ""}">${head}<div class="cbody">${horizontal ? `<div class="cleft">${artBox}${sourceBox}${kv(rows)}</div>${diagram}` : `<div class="ctop"><div>${artBox}${sourceBox}</div>${diagram}</div>${kv(rows)}`}</div></div>`;
}

function page4() {
  const images = sheet.images;
  const texts = sheet.texts.length
    ? `<div class="texts"><b>TEXT EMBROIDERY</b> <span class="muted">(not specified on this sheet)</span>: ${sheet.texts.map((t) => `${esc(t.zoneName)} “${esc(t.text)}”${t.thread ? ` — ${esc(t.thread.name)} ${esc(t.thread.hex.toUpperCase())}` : ""}`).join(" · ")}</div>`
    : "";
  const digitized = images.some((i) => i.digitized);
  const foot = `<div class="note">REF = measured on the configurator's reference jacket (same for every size), from CF/CB and the HPS. Seam-based positions per size: ${CAL}.${
    digitized ? ` Embroidery files (DST): <b>auto-digitized prototype — requires professional digitizing review; not approved for production.</b>` : ` Embroidery digitizing (DST / PES): ${TBC}.`
  }</div>`;
  if (!images.length) return page(4, `<div class="none">NO CUSTOMER-UPLOADED ARTWORK ON THIS JACKET</div>${texts}${foot}`);
  const n = images.length;
  const usableH = 238 - (texts ? 9 : 0);
  const cols = n <= 2 ? 1 : n <= 4 ? 2 : 3;
  const rowsN = Math.ceil(n / cols);
  const cardW = (190 - (cols - 1) * 4) / cols, cardH = (usableH - (rowsN - 1) * 4) / rowsN;
  let layout;
  if (n === 1) layout = { horizontal: true, artMm: 52, diagW: 112, diagH: cardH - 16, dense: false, thumb: 18 };
  else if (cols === 1) layout = { horizontal: true, artMm: Math.min(52, cardH - 70), diagW: 92, diagH: cardH - 14, dense: true };
  else {
    // Artwork and placement side by side on top, the data below.
    const artMm = Math.min(cardW * 0.36, 32);
    const diagW = cardW - artMm - 17;
    layout = { horizontal: false, artMm, diagW, diagH: Math.min(cardH * 0.44, fitH(regionTorso, diagW)), dense: true };
  }
  return page(4, `<div class="cards" style="grid-template-columns:repeat(${cols}, ${cardW}mm);grid-auto-rows:${cardH}mm">${images.map((i) => artworkCard(i, layout)).join("")}</div>${texts}${foot}`);
}

// ---------------------------------------------------------------------------
// PAGE 5+ — EMBROIDERY DIGITIZING: STITCH MAP (one page per digitized artwork)
// Everything drawn here comes from the stored stitch list the DST was written
// from (src/features/embroidery/stitchMap.ts); the upload is a reference thumbnail.
const TYPE_LABEL = { fill: "TATAMI FILL", satin: "SATIN", running: "RUNNING", underlay: "UNDERLAY" };
function stitchMapPage(img, n) {
  const dg = img.digitized, sm = dg.stitchMap, m = dg.metadata, v = sm.verification;
  const svgIn = (file, wMm, hMm) => readFileSync(join(artDir, file), "utf8").replace(/^<svg /, `<svg style="width:${wMm}mm;height:${hMm}mm;display:block" `);
  // main map: true scale when it fits, otherwise reduced (the grid stays in true mm)
  const boxW = 146, boxH = 108;
  const s = Math.min(1, boxW / sm.mapMm[0], boxH / sm.mapMm[1]);
  const scale = s >= 0.999 ? "1 : 1" : `1 : ${(1 / s).toFixed(2)}`;
  const detW = 88, mag = detW / sm.detailMm[0], detH = sm.detailMm[1] * mag;
  // colour separation: one small map per thread, stacked beside the main map
  const sepW = 34, sepH = Math.min(26, (112 - 30) / Math.max(1, sm.separations.length) - 6);
  const separations = sm.separations
    .map((sp, k) => {
      const t = sm.sections[k];
      const sc = Math.min(sepW / sp.mm[0], sepH / sp.mm[1]);
      return `<figure class="smsep">${svgIn(sp.file, sp.mm[0] * sc, sp.mm[1] * sc)}<figcaption>${sw(t.hex)}<b>${String(t.seq).padStart(2, "0")}</b> ${esc(t.hex)} · ${t.types.filter((x) => x !== "underlay").map((x) => TYPE_LABEL[x]).join(" + ")}</figcaption></figure>`;
    })
    .join("");
  const tbcV = (x) => (x === undefined || x === null || x === "" ? TBC : x);
  const fmtN = (x) => Number(x).toLocaleString("en-US");
  const src = img.original ? dataUrl(img.original.file) : dataUrl(img.processed.file);
  const sections = sm.sections;

  const threadRows = sections
    .map((t) => `<tr><td class="code">${String(t.seq).padStart(2, "0")}</td><td>${sw(t.hex)}<span class="mono">${esc(t.hex)}</span></td><td>${esc(t.name)}</td><td>${t.types.map((k) => TYPE_LABEL[k] ?? k.toUpperCase()).join(" + ")}</td><td class="num">${fmtN(t.stitches)}</td><td class="num">${t.blocks}</td></tr>`)
    .join("");
  const sequence = [
    `<span class="seqm"><i class="mk start"></i>START</span>`,
    ...sections.flatMap((t, i) => [
      ...(i ? [`<span class="seqm"><i class="mk color"></i>COLOUR CHANGE</span>`] : []),
      `<span class="seqs">${sw(t.hex)}<b>${String(t.seq).padStart(2, "0")}</b> ${esc(t.hex)} · ${t.types.map((k) => TYPE_LABEL[k] ?? k).join(" + ")} · ${fmtN(t.stitches)} st</span>`,
    ]),
    `<span class="seqm"><i class="mk end"></i>END</span>`,
  ].join('<span class="arr">→</span>');

  const typeList = (["fill", "satin", "running", "underlay"]).filter((t) => m.stitchTypes[t]).map((t) => `${TYPE_LABEL[t]} ${fmtN(m.stitchTypes[t])}`).join(" · ");
  const machine = kv([
    ["DESIGN ID", `<b class="mono">${esc(m.designId)}</b>`],
    ["STITCH FIELD", `<b>${m.widthMm.toFixed(1)} × ${m.heightMm.toFixed(1)} mm</b> <span class="muted">(W × H, as sewn)</span>`],
    ["DESIGN SIZE", `${m.designWidthMm.toFixed(1)} × ${m.designHeightMm.toFixed(1)} mm <span class="muted">before rotation</span>`],
    ["STITCHES", `<b>${fmtN(m.stitchCount)}</b>`],
    ["THREADS / CHANGES", `${m.threads.length} colours · ${m.colourChanges} colour change${m.colourChanges === 1 ? "" : "s"}`],
    ["JUMPS / TRIMS", `${fmtN(m.jumps)} jumps · ${fmtN(m.trims)} trims`],
    ["ROTATION", `${m.rotationDeg}° <span class="muted">${m.rotationApplied ? "applied in the stitch file" : ""}</span>`],
    ["STITCH TYPES", typeList],
    ["DENSITY", `fill rows ${tbcV(m.density?.fillSpacingMm)} mm · fill stitch ${tbcV(m.density?.fillStitchMm)} mm · satin ${tbcV(m.density?.satinSpacingMm)} mm · running ${tbcV(m.density?.runStitchMm)} mm`],
    ["UNDERLAY", `fill: ${esc(tbcV(m.underlay?.fill))}<br>satin: ${esc(tbcV(m.underlay?.satin))}`],
    ["PULL COMPENSATION", m.density?.pullCompMm !== undefined ? `${m.density.pullCompMm} mm (satin)` : TBC],
    ["MAX STITCH LENGTH", m.density?.maxStitchMm !== undefined ? `${m.density.maxStitchMm} mm` : TBC],
    ["DST FILE", `<span class="mono">${esc(dg.dstFile)}</span>`],
    ["DST CHECK", v.ok
      ? `<b>MATCH</b> — ${fmtN(v.dstStitches)} of ${fmtN(v.stitches)} stitch positions identical; ${v.dstColourChanges} colour change${v.dstColourChanges === 1 ? "" : "s"}; ${fmtN(v.dstJumps)} jump records (= ${fmtN(v.jumps)} jumps + 3 × ${fmtN(v.trims)} trims)`
      : `<span class="tbc">MISMATCH</span> ${fmtN(v.mismatches)} stitch differences`],
    ["ENGINE", `<span class="mono">${esc(m.engine)}</span>`],
    ["STATUS", `<b>${esc(m.status)}</b>`],
  ]);

  const legend = `<div class="smlegend">
    <div><svg viewBox="0 0 12 6"><rect x="0.5" y="0.5" width="5" height="5" fill="#1C2A5A"/><rect x="6.5" y="0.5" width="5" height="5" fill="#D7B15A"/></svg>STITCH CELL <span class="muted">(colour = thread sewn there)</span></div>
    <div><svg viewBox="0 0 12 6"><rect x="0" y="0" width="12" height="6" fill="#1C2A5A"/><path d="M1 1.5H11M11 3H1M1 4.5H11" stroke="#a4abc0" stroke-width="0.6"/></svg>STITCH PATH</div>
    <div><svg viewBox="0 0 12 6"><path d="M0 3H12" stroke="#555" stroke-width="0.6" stroke-dasharray="2 1.3"/></svg>UNDERLAY</div>
    <div><svg viewBox="0 0 12 6"><path d="M0 3H12" stroke="#C2185B" stroke-width="0.5" stroke-dasharray="1.6 1"/></svg>JUMP</div>
    <div><span class="dir">▶</span>DIRECTION</div>
    <div><i class="mk needle"></i>NEEDLE POINT</div>
    <div><i class="mk start"></i>START</div><div><i class="mk end"></i>END</div>
    <div><i class="mk color"></i>COLOUR CHANGE</div><div><span class="trim">&#9986;</span>TRIM</div>
  </div>`;

  const body = `
    <div class="smwarn">PROTOTYPE — PROFESSIONAL REVIEW REQUIRED</div>
    <div class="smtitle">ARTWORK ${String(img.n).padStart(2, "0")} — ${esc(img.zoneName.toUpperCase())} <span class="muted">· ${esc(m.designId)} · same stitch list as the DST</span></div>
    <div class="smrow1">
      <div class="smside">
        <div class="smsrcrow"><div class="art smsrc"><img src="${src}" alt=""></div><div class="artcap left">SOURCE ARTWORK<br>REFERENCE ONLY<br><span class="muted">not stitch data</span></div></div>
        <div class="sec">COLOUR SEPARATION</div>
        ${separations}
      </div>
      <figure class="smmap">${svgIn(sm.mapFile, sm.mapMm[0] * s, sm.mapMm[1] * s)}
        <figcaption>DIGITIZED STITCH MAP · ${sm.cellMm} mm STITCH CELLS · SCALE ${scale} · 10 mm GRID (true mm) · ${fmtN(m.stitchCount)} STITCHES</figcaption></figure>
    </div>
    ${legend}
    <div class="smrow2">
      <figure class="smdetail">${svgIn(sm.detailFile, detW, detH)}
        <figcaption>DETAIL A · ${mag.toFixed(1)}× · ${sm.detailMm[0].toFixed(0)} × ${sm.detailMm[1].toFixed(0)} mm · 0.5 mm cells · every needle point</figcaption></figure>
      <div class="smdata"><div class="sec">MACHINE / EMBROIDERY DATA</div>${machine}</div>
    </div>
    <div class="smrow3">
      <div class="sec">THREADS / COLOUR SECTIONS <span class="muted">— hex from our metadata; DST stores no thread colours; thread brand ${TBC}</span></div>
      <table class="spec smthreads"><thead><tr><th>SEQ</th><th>COLOUR</th><th>THREAD</th><th>STITCH TYPES</th><th class="num">STITCHES</th><th class="num">BLOCKS</th></tr></thead><tbody>${threadRows}</tbody></table>
      <div class="sec seqh">SEWING SEQUENCE <span class="muted">(from the stitch commands)</span></div>
      <div class="smseq">${sequence}</div>
    </div>`;
  return page(n, body, "EMBROIDERY DIGITIZING MAP", "UNITS: MM · VECTOR STITCH DATA");
}

// ---------------------------------------------------------------------------
const CSS = readFileSync(join(ROOT, "template/techpack.css"), "utf8");
// Text embroidery: its library fonts, embedded, so the sheet shows the text in the customer's font.
const textFonts = new Map(
  sheet.images.flatMap((i) => (i.text ? [[i.text.fontId, i.text.fontFamily], ...i.text.fallbackFontIds.map((id, k) => [id, i.text.fallbackFontFamilies[k]])] : []))
);
const FONT_CSS = [...textFonts]
  .map(([id, family]) => {
    const file = join(ROOT, "..", "public", "fonts", "embroidery", `${id}.ttf`);
    if (!existsSync(file) || !family) return "";
    return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${readFileSync(file).toString("base64")}) format('truetype');font-weight:1 1000;}`;
  })
  .join("") + ".stitchtext{font-size:5.2mm;line-height:1.35;color:#000;}.stitchtext.sm{font-size:3.4mm;line-height:1.25;}";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tech pack ${esc(sheet.productionId)}</title><style>${CSS}${FONT_CSS}</style></head><body>
${page1()}${page2()}${page3()}${page4()}${MAPPED.map((img, i) => stitchMapPage(img, 5 + i)).join("")}
<script>${FIT_CARDS}</script>
</body></html>`;

const work = mkdtempSync(join(tmpdir(), "fidelio-techpack-"));
const htmlOut = join(work, "techpack.html");
writeFileSync(htmlOut, html, "utf8");
if (htmlOnly) {
  const keep = outPdf.replace(/\.pdf$/i, ".html");
  writeFileSync(keep, html, "utf8");
  rmSync(work, { recursive: true, force: true });
  console.log("html:", keep);
  process.exit(0);
}
const browsers = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error("no Chrome/Edge found for PDF printing");
try {
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=10000", `--user-data-dir=${join(work, "profile")}`, `--print-to-pdf=${outPdf}`, pathToFileURL(htmlOut).href], { stdio: "ignore" });
} finally {
  rmSync(work, { recursive: true, force: true });
}

// The document is exactly four pages.
const pdf = readFileSync(outPdf).toString("latin1");
const counts = [...pdf.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
const pages = counts.length ? Math.max(...counts) : (pdf.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
if (pages !== TOTAL) throw new Error(`tech pack has ${pages} pages, expected ${TOTAL} (4 + ${MAPPED.length} stitch map${MAPPED.length === 1 ? "" : "s"})`);
console.log("pdf:", outPdf, `(${pages} pages)`);
console.log("tbc:", JSON.stringify([...new Set(tbcList)]));
