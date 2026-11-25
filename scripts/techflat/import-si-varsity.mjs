#!/usr/bin/env node
// IMPORT the licensed S.i. Graphics varsity flat into the JACKETEK working area.
//
//   node scripts/techflat/import-si-varsity.mjs
//
// Source (purchased, never modified; checked by SHA-256):
//   garment-spec/si-graphics-varsity-techpack/Blank/Single/SVG/…_Page 1.svg  (cover sheet: front + back flats)
// Output (internal derivative; git-ignored — see garment-spec/README.md):
//   garment-spec/working-varsity-flat/
//     source-copy/page-1.svg                 verbatim copy of the source page
//     front.svg, back.svg                    the garment, element-for-element, sorted into named layers
//     sleeve-right.svg, sleeve-left.svg, sleeve.json   standalone sleeves (reconstructed, server/rfq/techflat/sleeve.mjs)
//     flat.json                              view boxes, body/sleeve split, landmarks (template coordinates)
//
// The geometry is the template's own; this script only crops, groups and measures it.
// It runs the SVG in headless Chrome / Edge (DOM geometry), with no extra dependency.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeSleeveFiles } from "../../server/rfq/techflat/sleeve.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "garment-spec/si-graphics-varsity-techpack/Blank/Single/SVG/S.i. Graphics - Varsity Jacket Techpack Template_Page 1.svg");
const OUT = join(ROOT, "garment-spec/working-varsity-flat");
const BROWSER = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

if (!existsSync(SRC)) throw new Error(`Licensed source not found: ${SRC}`);
const raw = readFileSync(SRC);
const sha = createHash("sha256").update(raw).digest("hex");
const expected = process.env.SI_SOURCE_SHA256 ?? readFileSync(join(dirname(fileURLToPath(import.meta.url)), "si-source.sha256"), "utf8").trim();
if (sha !== expected) throw new Error(`Source SVG checksum ${sha} ≠ recorded ${expected}: the purchased file changed; not importing.`);
const svgText = raw.toString("latin1").replace(/<\?xml[^>]*\?>/, "");

// ---- The page script: classify, group, measure (runs in the browser) ----
const PAGE = String.raw`
(() => {
  const root = document.querySelector("svg");
  root.setAttribute("width", "841.89px"); root.setAttribute("height", "595.276px");
  const leaves = [...root.querySelectorAll("path,polygon,polyline,rect,line,circle,ellipse,image,use")].filter((e) => !e.closest("defs,clipPath,mask,font"));
  const num = (v) => parseFloat(v) || 0;
  const info = leaves.map((e, i) => {
    const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return { e, i, tag: e.tagName, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom, w: b.width, h: b.height, fill: cs.fill, stroke: cs.stroke, sw: num(cs.strokeWidth), dash: cs.strokeDasharray !== "none" };
  });
  const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
  const grey = (f) => f === "rgb(179, 179, 179)";
  const views = { front: { x0: 40, x1: 421 }, back: { x0: 421, x1: 802 } };
  const result = {};
  for (const [name, V] of Object.entries(views)) {
    const els = info.filter((o) => (o.x0 + o.x1) / 2 >= V.x0 && (o.x0 + o.x1) / 2 < V.x1 && o.y0 > 185);
    const sil = els.filter((o) => o.fill !== "none" && near(o.sw, 2.1932)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const X0 = sil.x0, W = sil.w; // view frame
    const X = (x) => x - X0;
    const layer = new Map();
    const put = (o, l) => (layer.has(l) ? layer.get(l) : layer.set(l, []).get(l)).push(o);
    // Region bands from the silhouette (proportions of this template's flat).
    const collarBottom = sil.y0 + 0.2 * sil.h, waistTop = sil.y0 + 0.83 * sil.h;
    for (const o of els) {
      const cx = X((o.x0 + o.x1) / 2);
      if (o === sil) { put(o, "silhouette"); continue; }
      if (o.tag === "circle") { put(o, "snaps"); continue; }
      if (o.fill === "rgb(167, 169, 172)" && o.w < 20) { put(o, "shading"); continue; }
      if (o.fill !== "none" && o.fill === "rgb(0, 0, 0)" && o.h > 35 && o.h < 75 && o.w < 15) { put(o, "underarm-fold"); continue; }
      // Body–sleeve seam (drop seam + body side down to the waistband); may be drawn in several pieces.
      if (o.fill === "none" && near(o.sw, 1.0966) && o.h > 60 && o.y0 < sil.y0 + 0.75 * sil.h && (X(o.x1) < 0.36 * W || X(o.x0) > 0.64 * W) && o.w < 45) { put(o, "body-sleeve-seam"); continue; }
      if (o.fill === "none" && near(o.sw, 1.0966) && o.h > 200 && o.w < 30 && cx > 0.4 * W && cx < 0.6 * W) { put(o, "front-edge"); continue; }
      if (o.fill === "none" && o.h > 200 && cx > 0.4 * W && cx < 0.7 * W) { put(o, "front-edge-stitch"); continue; }
      if (o.fill === "none" && near(o.sw, 0.5483) && o.h > 50 && o.h < 90 && (X(o.x0) < 0.25 * W || X(o.x1) > 0.75 * W)) { put(o, "shoulder-topstitch"); continue; }
      if (o.y1 > waistTop - 6 && (X(o.x1) < 0.16 * W || X(o.x0) > 0.84 * W)) { put(o, grey(o.fill) ? "cuff-stripes" : o.dash ? "cuff-stitch" : o.sw < 0.4 ? "cuff-rib-lines" : "cuffs"); continue; }
      if (o.y0 > waistTop - 6) { put(o, grey(o.fill) ? "waistband-stripes" : o.dash ? "waistband-stitch" : o.sw < 0.4 ? "waistband-rib-lines" : o.tag === "line" ? "waistband-tab" : "waistband"); continue; }
      if (o.y1 < collarBottom + 26 && o.y0 < collarBottom + 4 && cx > 0.3 * W && cx < 0.7 * W) {
        if (o.fill === "rgb(165, 168, 169)" || (o.fill === "rgb(0, 0, 0)" && o.h < 12)) put(o, "neck-label");
        else put(o, grey(o.fill) ? "collar-stripes" : o.dash ? "collar-stitch" : o.sw < 0.4 ? "collar-rib-lines" : o.fill === "none" ? "collar-seam" : "collar");
        continue;
      }
      if (o.y0 > sil.y0 + 0.5 * sil.h && o.y1 < waistTop) { put(o, o.dash ? "pocket-stitch" : "pockets"); continue; }
      put(o, "other");
    }
    // Serialise each layer; an element under transformed groups gets its full matrix.
    const ser = (o) => {
      const m = o.e.getCTM(), rm = root.getCTM();
      const rel = rm.inverse().multiply(m);
      const id = rel.a === 1 && rel.b === 0 && rel.c === 0 && rel.d === 1 && rel.e === 0 && rel.f === 0;
      const c = o.e.cloneNode(true);
      c.removeAttribute("id");
      return id ? c.outerHTML : '<g transform="matrix(' + [rel.a, rel.b, rel.c, rel.d, rel.e, rel.f].map((v) => +v.toFixed(5)).join(",") + ')">' + c.outerHTML + "</g>";
    };
    const order = ["silhouette", "shading", "underarm-fold", "body-sleeve-seam", "shoulder-topstitch", "waistband", "waistband-rib-lines", "waistband-stripes", "waistband-tab", "waistband-stitch", "cuffs", "cuff-rib-lines", "cuff-stripes", "cuff-stitch", "collar", "collar-rib-lines", "collar-stripes", "collar-seam", "collar-stitch", "neck-label", "pockets", "pocket-stitch", "front-edge", "front-edge-stitch", "snaps", "other"];
    const layers = order.filter((l) => layer.has(l)).map((l) => ({ id: l, count: layer.get(l).length, svg: layer.get(l).map(ser).join("") }));
    // Body / sleeve split from the body–sleeve seam paths (sampled).
    const sample = (o, n = 80) => { const L = o.e.getTotalLength(), m = root.getCTM().inverse().multiply(o.e.getCTM()); const pts = []; for (let k = 0; k <= n; k++) { const p = o.e.getPointAtLength((L * k) / n).matrixTransform(m); pts.push([+p.x.toFixed(2), +p.y.toFixed(2)]); } return pts; };
    // Per side, the seam pieces joined top to bottom.
    const pieces = (layer.get("body-sleeve-seam") ?? []).map((o) => { const pts = sample(o); return pts[0][1] > pts.at(-1)[1] ? pts.reverse() : pts; });
    const sideOf = (pts) => (X(pts.reduce((a, p) => a + p[0], 0) / pts.length) < W / 2 ? "L" : "R");
    const join = (side) => pieces.filter((p) => sideOf(p) === side).sort((a, b) => a[0][1] - b[0][1]).flat();
    const sl = join("L"), sr = join("R");
    if (!sl.length || !sr.length) throw new Error(name + ": body–sleeve seam not found on both sides");
    const top = sil.y0 - 20, bottom = sil.y1 + 20;
    const bodyClip = [[sl[0][0], top], ...sl, [sl.at(-1)[0], bottom], [sr.at(-1)[0], bottom], ...[...sr].reverse(), [sr[0][0], top]];
    const leftSleeve = [[sil.x0 - 10, top], [sl[0][0], top], ...sl, [sl.at(-1)[0], bottom], [sil.x0 - 10, bottom]];
    const rightSleeve = [[sil.x1 + 10, top], [sr[0][0], top], ...sr, [sr.at(-1)[0], bottom], [sil.x1 + 10, bottom]];
    // Landmarks, measured on this template's drawing (template coordinates, y down).
    const silPts = sample(sil, 900);
    const tops = (layer.get("shoulder-topstitch") ?? []).map((o) => sample(o, 40)).map((p) => (p[0][1] < p.at(-1)[1] ? p : p.reverse()));
    const lm = {};
    // Underarm: on each seam, the inner-most point of its upper part (where the drop seam turns down the side).
    const ua = (s, dir) => s.slice(0, Math.round(s.length * 0.35)).reduce((b, p) => (dir * (p[0] - b[0]) > 0 ? p : b), s[0]);
    lm.SP_L = sl[0]; lm.SP_R = sr[0]; // dropped shoulder: where the body–sleeve seam meets the outline
    lm.UA_L = ua(sl, 1); lm.UA_R = ua(sr, -1);
    lm.sideBottom_L = sl.at(-1); lm.sideBottom_R = sr.at(-1);
    const tsl = tops.sort((a, b) => a[0][0] - b[0][0]);
    if (tsl.length === 2) { lm.HPS_L = tsl[0][0]; lm.HPS_R = tsl[1][0]; }
    else {
      const cs = (layer.get("collar-seam") ?? []).map((o) => sample(o, 60)).flat().sort((a, b) => a[0] - b[0]);
      if (cs.length) { lm.HPS_L = cs[0]; lm.HPS_R = cs.at(-1); lm.cbNeck = cs.reduce((b, p) => (Math.abs(p[0] - (cs[0][0] + cs.at(-1)[0]) / 2) < Math.abs(b[0] - (cs[0][0] + cs.at(-1)[0]) / 2) ? p : b), cs[0]); }
    }
    const fe = layer.get("front-edge")?.[0];
    if (fe) { const p = sample(fe, 40).sort((a, b) => a[1] - b[1]); lm.frontEdgeTop = p[0]; lm.frontEdgeBottom = p.at(-1); }
    const wb = (layer.get("waistband") ?? []).filter((o) => o.fill !== "none");
    if (wb.length) { lm.waistbandTop = Math.min(...wb.map((o) => o.y0)); lm.hem = Math.max(...wb.map((o) => o.y1)); lm.waistbandX0 = Math.min(...wb.map((o) => o.x0)); lm.waistbandX1 = Math.max(...wb.map((o) => o.x1)); }
    const col = layer.get("collar") ?? [];
    if (col.length) { lm.collarTop = Math.min(...col.map((o) => o.y0)); lm.collarX0 = Math.min(...col.map((o) => o.x0)); lm.collarX1 = Math.max(...col.map((o) => o.x1)); lm.collarBottom = Math.max(...col.map((o) => o.y1)); }
    // Collar outlines (sampled) and the collar seam lines, for collar dimensions.
    lm.collarShapes = col.filter((o) => o.fill !== "none").map((o) => sample(o, 120));
    lm.collarSeams = (layer.get("collar-seam") ?? []).map((o) => sample(o, 60));
    lm.snaps = (layer.get("snaps") ?? []).map((o) => [+(((o.x0 + o.x1) / 2)).toFixed(2), +(((o.y0 + o.y1) / 2)).toFixed(2), +(o.w / 2).toFixed(2)]).sort((a, b) => a[1] - b[1]);
    lm.pockets = (layer.get("pockets") ?? []).filter((o) => o.tag === "polygon").map((o) => o.e.getAttribute("points").trim().split(/[\s,]+/).map(Number).reduce((a, v, k, arr) => (k % 2 ? a : [...a, [arr[k], arr[k + 1]]]), [])).sort((a, b) => a[0][0] - b[0][0]);
    lm.cuffs = (layer.get("cuffs") ?? []).filter((o) => o.fill !== "none").map((o) => ({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, pts: sample(o, 60) })).sort((a, b) => a.x0 - b.x0);
    // The outline's outer edge, left / right (overarm), for sleeve dimensions.
    lm.outline = silPts;
    result[name] = { frame: { x0: sil.x0, y0: sil.y0, x1: sil.x1, y1: sil.y1 }, layers, bodyClip, sleeveClips: { left: leftSleeve, right: rightSleeve }, seams: { left: sl, right: sr }, landmarks: lm, unclassified: (layer.get("other") ?? []).length, otherInfo: (layer.get("other") ?? []).map((o) => ({ tag: o.tag, box: [o.x0, o.y0, o.x1, o.y1].map((n) => +n.toFixed(1)), fill: o.fill, stroke: o.stroke, sw: o.sw, dash: o.dash })) };
  }
  document.getElementById("out").textContent = JSON.stringify(result);
  document.body.setAttribute("data-done", "1");
})();`;

const work = mkdtempSync(join(tmpdir(), "si-import-"));
try {
  const html = join(work, "page.html");
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${svgText}<pre id="out"></pre><script>${PAGE}</script></body></html>`, "latin1");
  const dom = execFileSync(BROWSER, ["--headless=new", "--disable-gpu", "--virtual-time-budget=10000", `--user-data-dir=${join(work, "p")}`, "--dump-dom", pathToFileURL(html).href], { maxBuffer: 512 * 1024 * 1024 }).toString("utf8");
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
  if (!m || !/data-done="1"/.test(dom)) throw new Error("Import page did not finish.");
  const txt = m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const R = JSON.parse(txt);

  mkdirSync(join(OUT, "source-copy"), { recursive: true });
  copyFileSync(SRC, join(OUT, "source-copy", "page-1.svg"));
  const pts = (a) => a.map((p) => p.join(",")).join(" ");
  const head = (vb, title) => `<?xml version="1.0" encoding="UTF-8"?>\n<!-- JACKETEK working copy — ${title}. Geometry: S.i. Graphics "Varsity Jacket Techpack Template" (licensed purchase; internal use; do not redistribute). Not to scale. -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}">`;
  const flat = { source: { file: "garment-spec/si-graphics-varsity-techpack/Blank/Single/SVG/S.i. Graphics - Varsity Jacket Techpack Template_Page 1.svg", sha256: sha, licence: "S.i. Graphics — personal and commercial use; no resale / sharing / distribution of the files as-is" }, units: "template points (1/72 in), y down; drawing not to scale", views: {} };
  for (const [name, v] of Object.entries(R)) {
    const pad = 14, f = v.frame;
    const vb = [f.x0 - pad, f.y0 - pad, f.x1 - f.x0 + 2 * pad, f.y1 - f.y0 + 2 * pad].map((n) => +n.toFixed(2));
    const body = v.layers.map((l) => `<g id="layer-${l.id}" data-count="${l.count}">${l.svg}</g>`).join("\n");
    writeFileSync(join(OUT, `${name}.svg`), `${head(vb.join(" "), `${name} flat`)}\n${body}\n</svg>\n`);
    flat.views[name] = { viewBox: vb, frame: f, bodyClip: v.bodyClip, sleeveClips: v.sleeveClips, seams: v.seams, landmarks: v.landmarks, layers: v.layers.map((l) => ({ id: l.id, count: l.count })), unclassified: v.unclassified };
  }
  writeFileSync(join(OUT, "flat.json"), `${JSON.stringify(flat, null, 1)}\n`);
  writeSleeveFiles(OUT, head);
  for (const [name, v] of Object.entries(R)) console.log(`${name}: ${v.layers.map((l) => `${l.id}(${l.count})`).join(" ")}  unclassified: ${v.unclassified}${v.otherInfo.length ? " " + JSON.stringify(v.otherInfo) : ""}`);
  console.log(`→ ${OUT}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
