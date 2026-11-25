#!/usr/bin/env node
// Fidelio Varsity — 2D TECHNICAL FLAT (front + back), vector, reusable.
//
// The flat is built for a size from the three OFFICIAL measurements
// (data/official_size_chart.json): chest width flat, jacket length (HPS to
// hem) and sleeve length (shoulder point to cuff end) are drawn TO SCALE.
// Every other proportion below is a DRAWING proportion, read from the
// approved model renders (images/view01_front.png, view02_back.png) so the
// flat looks like the real jacket. They are NOT specifications: any
// dimension not on the size chart is printed "TO BE CONFIRMED".
//
// Coordinates: centimetres, x = 0 at centre front / back, y = 0 at the hem,
// y up. In the FRONT view +x is the viewer's right (= wearer's left); in the
// BACK view +x is the viewer's right (= wearer's right).
//
//   import { flatGeometry, flatSvg } from "./varsityFlat.mjs";
//   CLI: node flats/varsityFlat.mjs [--size M]  -> writes flats/varsity_front.svg, varsity_back.svg

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Drawing proportions (× half chest W, × length L, × sleeve S). Not specifications. */
export const DRAWING = {
  neckHalf: 0.32, // × W   neck edge at the HPS
  shoulderHalf: 0.78, // × W   shoulder point
  shoulderDrop: 0.06, // × L
  frontNeckDrop: 0.1, // × L   render: CF neck 0.10 L below HPS
  backNeckDrop: 0.025, // × L
  armholeDepth: 0.42, // × L   HPS to underarm
  collarHeight: 0.056, // × L  render: back collar 0.056 L
  collarBand: 0.045, // × L    front collar band width
  waistband: 0.092, // × L     render: rib 0.092 L
  ribInset: 0.035, // × W
  sleeveAngle: 48, // degrees from vertical (flat laid with arms out)
  sleeveEnd: 0.36, // × W  sleeve width at the cuff seam
  cuffWidth: 0.3, // × W
  cuffHeight: 0.1, // × S
  placketOverlap: 0.044, // × W  render: front edge 1.3 cm left of the snaps
  snaps: [0.876, 0.694, 0.529, 0.362, 0.192], // × L above hem (render)
  tabSnaps: [0.07, 0.023], // × L above hem, on the waistband tab (render)
  tabHalf: 0.24, // × W
  snapRadius: 0.028, // × W
  pocket: { x: 0.66, y0: 0.18, y1: 0.41, width: 0.09, lean: 0.02 }, // welt: × W / × L
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

/** Cubic Bézier sampled as a polyline. */
function bezier(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** A polyline offset sideways by `d` (positive = left of travel). */
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / len) * d, p[1] + (dx / len) * d];
  });
}

/**
 * The flat for one size. `chestFlat`, `length`, `sleeve` in cm (official
 * chart A, B, C). Returns parts (polylines, cm) and landmarks.
 */
export function flatGeometry({ chestFlat, length, sleeve }) {
  const W = chestFlat / 2, L = length, S = sleeve, D = DRAWING;
  const nh = D.neckHalf * W, colh = D.collarHeight * L, wb = D.waistband * L;
  const HPS = [nh, L];
  const SP = [D.shoulderHalf * W, L - D.shoulderDrop * L];
  const UA = [W, L - D.armholeDepth * L];
  const th = (D.sleeveAngle * Math.PI) / 180;
  const d = [Math.sin(th), -Math.cos(th)]; // down the sleeve (right sleeve)
  const p = [-Math.cos(th), -Math.sin(th)]; // across the sleeve, toward the body
  const ch = D.cuffHeight * S, endW = D.sleeveEnd * W, cuffW = D.cuffWidth * W;
  const cuffTopOuter = add(SP, mul(d, S - ch));
  const cuffEndOuter = add(SP, mul(d, S));
  const sleeveEndInner = add(cuffTopOuter, mul(p, endW));
  const inset = (endW - cuffW) / 2;
  const cuff = [
    add(cuffTopOuter, mul(p, inset)), add(cuffEndOuter, mul(p, inset)),
    add(cuffEndOuter, mul(p, inset + cuffW)), add(cuffTopOuter, mul(p, inset + cuffW)),
  ];
  // Armhole: shoulder point → underarm, nearly straight, easing into the underarm.
  const armhole = bezier(SP, [SP[0] + 0.15 * (UA[0] - SP[0]), SP[1] - 0.4 * (SP[1] - UA[1])], [UA[0] - 0.25 * (UA[0] - SP[0]), UA[1] + 0.12 * (SP[1] - UA[1])], UA, 12);
  // Sleeve (right): cap along the armhole, outer edge, sleeve end, inner seam.
  const sleeveR = [...armhole, sleeveEndInner, cuffTopOuter];
  const ribW = W - D.ribInset * W;

  // Necklines.
  const frontNeck = bezier([nh, L], [nh * 0.85, L - D.frontNeckDrop * L * 0.75], [nh * 0.3, L - D.frontNeckDrop * L], [0, L - D.frontNeckDrop * L], 14);
  const backNeck = bezier([nh, L], [nh * 0.7, L - D.backNeckDrop * L], [nh * 0.3, L - D.backNeckDrop * L], [0, L - D.backNeckDrop * L], 12);

  // Body half (right), clockwise from the CF neck: neckline → shoulder → armhole → side → waistband top.
  const bodyHalf = (neck) => [...[...neck].reverse(), SP, ...armhole.slice(1), [W, wb], [0, wb]];
  // Whole outline of a view (one closed shape; the CF overlap edge is drawn separately).
  const whole = (half) => [...half.slice(0, -1), ...mirror(half.slice(1, -1)).reverse()];
  const front = { right: bodyHalf(frontNeck) };
  front.left = mirror(front.right);
  front.whole = whole(front.right);
  const back = { right: bodyHalf(backNeck) };
  back.left = mirror(back.right);
  back.whole = whole(back.right);

  // Collar. Back collar: a standing rib band above the back neckline.
  const collarTopY = L + colh;
  const backNeckLR = [...mirror(backNeck).slice(0, -1), ...[...backNeck].reverse()]; // (-nh,L) → CB → (nh,L)
  const collarBack = [...backNeckLR, [nh * 0.96, collarTopY], [-nh * 0.96, collarTopY]];
  // Front view: the neck opening (inside of the jacket) and, across its
  // top, the inside face of the back collar — both show between the bands.
  const frontInside = [[-nh * 0.96, collarTopY], [nh * 0.96, collarTopY], ...frontNeck, ...mirror([...frontNeck].reverse())];
  const collarInside = [[-nh * 0.96, collarTopY], [nh * 0.96, collarTopY], [nh * 0.98, L - 0.004 * L], [-nh * 0.98, L - 0.004 * L]];
  // Front collar bands: along the front neckline, band width inward/up.
  const bw = D.collarBand * L;
  const bandEdge = [[nh, collarTopY], ...frontNeck]; // top corner → HPS → CF
  // Right of travel (down, then toward CF) = into the neck opening.
  const bandInner = offset(bandEdge, -bw).map(([x, y]) => [Math.max(x, 0), y]);
  const frontBandR = [...bandEdge, ...[...bandInner].reverse()];
  const frontBandL = mirror(frontBandR);

  // Waistband (rib) and its stripes.
  const waistband = [[-ribW, 0], [ribW, 0], [ribW, wb], [-ribW, wb]];
  const stripesH = (y0, y1) => [y0 + (y1 - y0) * 0.36, y0 + (y1 - y0) * 0.62];

  // Pockets (front only): slanted welts.
  const P = D.pocket;
  const welt = (sgn) => {
    const xc = sgn * P.x * W, w = P.width * W, lean = sgn * P.lean * W;
    return [[xc - sgn * w / 2 + lean, P.y1 * L], [xc + sgn * w / 2 + lean, P.y1 * L], [xc + sgn * w / 2, P.y0 * L], [xc - sgn * w / 2, P.y0 * L]];
  };

  const snaps = D.snaps.map((f) => [0, f * L]);
  const tabSnaps = D.tabSnaps.map((f) => [0, f * L]);
  const tab = [[-D.tabHalf * W, 0], [D.tabHalf * W, 0], [D.tabHalf * W, wb], [-D.tabHalf * W, wb]];
  const placketX = -D.placketOverlap * W;

  return {
    W, L, S, colh, wb, ribW, ch, cuffW, endW, th,
    landmarks: {
      HPS, SP, UA, cuffEndOuter, cuffTopOuter, sleeveEndInner, collarTopY,
      frontNeckCF: [0, L - D.frontNeckDrop * L], backNeckCB: [0, L - D.backNeckDrop * L], placketX,
      sleeveDir: d, sleeveAcross: p,
    },
    parts: {
      sleeveR, sleeveL: mirror(sleeveR), cuffR: cuff, cuffL: mirror(cuff),
      front, back, waistband, tab, collarBack, frontInside, collarInside, frontBandR, frontBandL,
      weltR: welt(1), weltL: welt(-1), snaps, tabSnaps, stripesH,
    },
  };
}

// ---------------------------------------------------------------------------
// SVG

const f = (n) => (Math.round(n * 100) / 100).toString();
const pt = ([x, y]) => `${f(x)},${f(-y)}`;
export const poly = (pts, attrs = "") => `<polygon points="${pts.map(pt).join(" ")}" ${attrs}/>`;
export const line = (pts, attrs = "") => `<polyline points="${pts.map(pt).join(" ")}" fill="none" ${attrs}/>`;

/** Bounds of a view (cm), for viewBoxes. */
export function flatBounds(g) {
  const x = Math.max(...[...g.parts.sleeveR, ...g.parts.cuffR].map((p) => p[0]));
  const yMin = Math.min(0, ...g.parts.cuffR.map((p) => p[1]));
  return { x0: -x, x1: x, y0: yMin, y1: g.landmarks.collarTopY };
}

/** viewBox string for the region (cm, y up) plus a margin. */
export function viewBox({ x0, x1, y0, y1 }, m = 2) {
  return `${f(x0 - m)} ${f(-y1 - m)} ${f(x1 - x0 + 2 * m)} ${f(y1 - y0 + 2 * m)}`;
}

/**
 * The flat as SVG markup (no <svg> wrapper), in cm units.
 * fills: null → line drawing; otherwise { body, sleeves, rib, stripe, welt, snap, inside, tab }.
 */
export function flatSvg(g, view, { fills = null, ribLines = true } = {}) {
  const { parts: P, landmarks: Lm } = g;
  const S = 'stroke="#000" vector-effect="non-scaling-stroke"';
  const outline = `${S} stroke-width="0.9" stroke-linejoin="round"`;
  const detail = `${S} stroke-width="0.5"`;
  const fill = (k) => (fills ? `fill="${fills[k] ?? "#fff"}"` : 'fill="#fff"');
  const out = [];
  const front = view === "front";

  // Sleeves and cuffs (drawn first: the body sits on top at the armhole).
  for (const side of ["R", "L"]) {
    out.push(poly(P[`sleeve${side}`], `${fill("sleeves")} ${outline}`));
    const c = P[`cuff${side}`];
    out.push(poly(c, `${fill("rib")} ${outline}`));
    // Two knitted stripes across the cuff (parallel to the cuff end).
    for (const t of [0.36, 0.62]) {
      const a = [c[0][0] + (c[1][0] - c[0][0]) * t, c[0][1] + (c[1][1] - c[0][1]) * t];
      const b = [c[3][0] + (c[2][0] - c[3][0]) * t, c[3][1] + (c[2][1] - c[3][1]) * t];
      const a2 = [c[0][0] + (c[1][0] - c[0][0]) * (t + 0.12), c[0][1] + (c[1][1] - c[0][1]) * (t + 0.12)];
      const b2 = [c[3][0] + (c[2][0] - c[3][0]) * (t + 0.12), c[3][1] + (c[2][1] - c[3][1]) * (t + 0.12)];
      out.push(poly([a, b, b2, a2], fills ? `fill="${fills.stripe}" ${detail}` : `fill="none" ${detail}`));
    }
    if (ribLines && !fills) out.push(ribHatch(c, 10, detail));
  }

  // Body panels.
  const body = front ? P.front : P.back;
  out.push(poly(body.whole, `${fill("body")} ${outline}`));

  // Waistband rib + stripes.
  out.push(poly(P.waistband, `${fill("rib")} ${outline}`));
  for (const y of g.parts.stripesH(0, g.wb)) {
    const h = g.wb * 0.11;
    out.push(poly([[-g.ribW, y], [g.ribW, y], [g.ribW, y + h], [-g.ribW, y + h]], fills ? `fill="${fills.stripe}" ${detail}` : `fill="none" ${detail}`));
  }
  if (ribLines && !fills) {
    const [a, b, c, dd] = P.waistband; // vertical wales: bottom edge → top edge
    out.push(ribHatch([a, dd, c, b], 44, detail));
  }

  // Collar.
  if (front) {
    out.push(poly(P.frontInside, `${fills ? `fill="${fills.inside}"` : 'fill="#fff"'} ${outline}`));
    out.push(poly(P.collarInside, `${fill("rib")} ${detail}`));
    for (const band of [P.frontBandR, P.frontBandL]) {
      out.push(poly(band, `${fill("rib")} ${outline}`));
      out.push(bandStripes(band, fills, detail));
    }
  } else {
    out.push(poly(P.collarBack, `${fill("rib")} ${outline}`));
    const y0 = g.landmarks.collarTopY - g.colh * 0.62, y1 = g.landmarks.collarTopY - g.colh * 0.38;
    for (const y of [y0, y1]) {
      const h = g.colh * 0.12, x = g.parts.collarBack[g.parts.collarBack.length - 2][0];
      out.push(poly([[-x, y], [x, y], [x, y + h], [-x, y + h]], fills ? `fill="${fills.stripe}" ${detail}` : `fill="none" ${detail}`));
    }
  }

  if (front) {
    // Front edge (overlap) and snaps; waistband tab with its snaps.
    out.push(line([[Lm.placketX, Lm.frontNeckCF[1]], [Lm.placketX, g.wb]], outline));
    out.push(poly(P.tab, `${fill("tab")} ${outline}`));
    out.push(line([[Lm.placketX, 0], [Lm.placketX, g.wb]], detail));
    const r = DRAWING.snapRadius * g.W;
    for (const s of [...P.snaps, ...P.tabSnaps])
      out.push(`<circle cx="${f(s[0])}" cy="${f(-s[1])}" r="${f(r)}" ${fills ? `fill="${fills.snap}"` : 'fill="#fff"'} ${detail}/>`);
    for (const w of [P.weltR, P.weltL]) out.push(poly(w, `${fill("welt")} ${outline}`));
  }
  return out.join("\n");
}

/** Fine rib lines across a quadrilateral (rib knit), from edge 0-3 to 1-2. */
function ribHatch(q, n, attrs) {
  const lines = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const a = [q[0][0] + (q[3][0] - q[0][0]) * t, q[0][1] + (q[3][1] - q[0][1]) * t];
    const b = [q[1][0] + (q[2][0] - q[1][0]) * t, q[1][1] + (q[2][1] - q[1][1]) * t];
    lines.push(`<line x1="${f(a[0])}" y1="${f(-a[1])}" x2="${f(b[0])}" y2="${f(-b[1])}" ${attrs.replace('stroke="#000"', 'stroke="#666"').replace('stroke-width="0.5"', 'stroke-width="0.25"')}/>`);
  }
  return lines.join("");
}

/** Two stripes running along a front collar band. */
function bandStripes(band, fills, attrs) {
  const n = band.length / 2;
  const outer = band.slice(0, n), inner = band.slice(n).reverse();
  const at = (t) => outer.map((p, i) => [p[0] + (inner[i][0] - p[0]) * t, p[1] + (inner[i][1] - p[1]) * t]);
  return [0.36, 0.62]
    .map((t) => {
      const a = at(t), b = at(t + 0.12);
      return fills ? poly([...a, ...[...b].reverse()], `fill="${fills.stripe}" ${attrs}`) : line(a, attrs) + line(b, attrs);
    })
    .join("");
}

// ---- CLI: export the reusable SVG assets (line drawings) for a size ----
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const i = process.argv.indexOf("--size");
  const size = i > 0 ? process.argv[i + 1] : "M";
  const chart = JSON.parse(readFileSync(join(ROOT, "data/official_size_chart.json"), "utf8").replace(/^﻿/, ""));
  const row = chart.rows.find((r) => r.size === size);
  if (!row) throw new Error(`size ${size} is not on the official size chart`);
  const cm = (s) => parseFloat(s);
  const g = flatGeometry({ chestFlat: cm(row.chest_width_flat), length: cm(row.jacket_length), sleeve: cm(row.sleeve_length) });
  for (const view of ["front", "back"]) {
    const file = join(ROOT, "flats", `varsity_${view}.svg`);
    writeFileSync(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(flatBounds(g))}" width="${Math.round((flatBounds(g).x1 * 2 + 4) * 10)}mm">\n<!-- Fidelio Varsity technical flat, ${view}, size ${size} (chart A/B/C to scale). Generated by flats/varsityFlat.mjs -->\n${flatSvg(g, view)}\n</svg>\n`,
      "utf8"
    );
    console.log("wrote", file);
  }
}
