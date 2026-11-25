// MEASUREMENT-METHOD DRAWINGS for development tech packs, on the canonical S.i.-based flat:
//   keyMethodDrawings(L)    B01 / B01-A on the front, B06 / B06-T / B09 on the back
//   sleeveMethodDrawings(L) S02 → cuff seam (primary) and S02-E → finished cuff edge (secondary) on
//                           the sleeve; S01 / S01-E (centre back, comparison only) on the back
//   backPomSheet(D, L), sleevePomSheet(D, L)  POM location sheets with the four sleeve methods drawn
//                           separately (the shared canonical sheets end S01 / S02 at the cuff edge)
// L: labels for the key POMs; D: labels for every POM ({ code, short, value, status, target }).
// The drawing is placement only: no value is read from it, nothing is converted to cm.
// (The same geometry as the MSR-01 generator, scripts/sample-development/generate.mjs.)
import { canonicalFlat } from "../rfq/flats.mjs";
import { compose, T } from "../rfq/techflat/canonical.mjs";

const P = (p) => T(p);
const EXT_LINE = 'stroke="#0b4f8a" stroke-width="0.5" stroke-dasharray="2 1.4" vector-effect="non-scaling-stroke" fill="none"';
const pts = (a) => a.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(" ");
const shiftX = (a, d) => a.map(([x, y]) => [x - d, y]);
export const lab = (code, short, value, status) => ({ code, short, value, status, target: null });

let G = null;
function geo() {
  if (G) return G;
  const flat = canonicalFlat();
  const fr = flat.views.front, bk = flat.views.back, LF = fr.landmarks, LB = bk.landmarks;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nearestIdx = (p2, p) => p2.reduce((bi, q, i) => (dist(q, p) < dist(p2[bi], p) ? i : bi), 0);
  const xAtY = (p2, y) => {
    for (let i = 1; i < p2.length; i++) {
      const [x1, y1] = p2[i - 1], [x2, y2] = p2[i];
      if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) return x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
    }
    return null;
  };
  const outlineArc = (L, a, b, side) => {
    const o = L.outline, i = nearestIdx(o, a), j = nearestIdx(o, b);
    const lo = Math.min(i, j), hi = Math.max(i, j);
    const inner = o.slice(lo, hi + 1), outer = [...o.slice(hi), ...o.slice(0, lo + 1)];
    const mean = (arr) => arr.reduce((s, p) => s + p[0], 0) / arr.length;
    let arc = side < 0 ? (mean(inner) < mean(outer) ? inner : outer) : mean(inner) > mean(outer) ? inner : outer;
    if (dist(arc[0], a) > dist(arc.at(-1), a)) arc = [...arc].reverse();
    return arc;
  };
  const corners = (p2) => {
    const by = (g) => p2.reduce((b, p) => (g(p) < g(b) ? p : b), p2[0]);
    return { TL: by((p) => p[0] + p[1]), TR: by((p) => -p[0] + p[1]), BR: by((p) => -p[0] - p[1]), BL: by((p) => p[0] - p[1]) };
  };
  const outlineX = (L, y, side) => {
    const xs = [];
    const o = L.outline;
    for (let i = 1; i < o.length; i++) {
      const [x1, y1] = o[i - 1], [x2, y2] = o[i];
      if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    return side < 0 ? Math.min(...xs) : Math.max(...xs);
  };
  G = { flat, fr, bk, LF, LB, dist, nearestIdx, xAtY, outlineArc, corners, outlineX };
  return G;
}

function sleeveOverlays(K, S, L, { labelX, s02y, s02ey }) {
  const cuff = S.cuff;
  const a = shiftX(S.overarm, K.u(2.5)), b = shiftX([...S.overarm, cuff.BL], K.u(6));
  return [
    `<polyline points="${pts([cuff.TL, a.at(-1)])}" ${EXT_LINE}/>`, `<polyline points="${pts([cuff.BL, b.at(-1)])}" ${EXT_LINE}/>`,
    K.path(a.map(P), L.S02, { labelPos: P([labelX, s02y]), align: "end", leaderAt: 0.3 }),
    K.path(b.map(P), L["S02-E"], { labelPos: P([labelX, s02ey]), align: "end", leaderAt: 0.85 }),
  ].join("");
}

function backSleeveOverlays(K, L, { labelX, s01y, s01ey }) {
  const { LB, outlineArc, corners } = geo();
  const cuffL = corners(LB.cuffs[0].pts), cb = LB.cbNeck;
  const shoulder = outlineArc(LB, LB.HPS_L, LB.SP_L, -1);
  const toSeam = outlineArc(LB, LB.SP_L, cuffL.TL, -1);
  const toEdge = outlineArc(LB, LB.SP_L, cuffL.BL, -1);
  const a = [cb, ...shoulder, ...shiftX(toSeam.slice(1), K.u(2.5))];
  const b = [cb, ...shoulder, ...shiftX(toEdge.slice(1), K.u(6))];
  return [
    `<polyline points="${pts([cuffL.TL, a.at(-1)])}" ${EXT_LINE}/>`, `<polyline points="${pts([cuffL.BL, b.at(-1)])}" ${EXT_LINE}/>`,
    K.path(a.map(P), L.S01, { labelPos: P([labelX, s01y]), align: "end", leaderAt: 0.55 }),
    K.path(b.map(P), L["S01-E"], { labelPos: P([labelX, s01ey]), align: "end", leaderAt: 0.9 }),
  ].join("");
}

export function keyMethodDrawings(L) {
  const { fr, bk, LF, LB, xAtY } = geo();
  const HPSyF = (LF.HPS_L[1] + LF.HPS_R[1]) / 2;
  const IN = (2.54 * (LF.hem - HPSyF)) / 67.65; // placement of the "1 inch below" line only — not a measurement
  const chestY = LF.UA_L[1] + IN, sl = fr.seams.left, sr = fr.seams.right;
  const f0 = fr.frame;
  const front = compose(fr, { x0: f0.x0 - 40, x1: f0.x1 + 40, y0: f0.y0 - 20, y1: f0.y1 + 16 }, 128, 118, {
    marker: "kf",
    overlay: (K) => [
      K.linear(P([xAtY(sl, chestY), chestY]), P([xAtY(sr, chestY), chestY]), L.B01, { labelAt: 0.5, labelNudge: [0, -K.u(7)] }),
      K.linear(P([xAtY(sl, LF.UA_L[1] + 0.3) ?? LF.UA_L[0], LF.UA_L[1] + 0.3]), P([xAtY(sr, LF.UA_R[1] + 0.3) ?? LF.UA_R[0], LF.UA_R[1] + 0.3]), L["B01-A"], { labelAt: 0.5, labelNudge: [0, K.u(9)] }),
    ].join(""),
  });
  const cxB = LB.cbNeck[0], cb = LB.cbNeck, b0 = bk.frame;
  const backTop = Math.min(...LB.collarShapes.flat().filter((p) => Math.abs(p[0] - cxB) < 3).map((p) => p[1]));
  const back = compose(bk, { x0: b0.x0 - 40, x1: b0.x1 + 40, y0: b0.y0 - 62, y1: b0.y1 + 16 }, 128, 118, {
    marker: "kb",
    overlay: (K) => [
      K.linear(P(cb), P([cxB, LB.hem]), L.B06, { labelAt: 0.55, labelNudge: [K.u(30), 0] }),
      K.linear(P([cxB, backTop]), P([cxB, LB.hem]), L["B06-T"], { off: K.u(14), labelAt: 0.8, labelNudge: [-K.u(30), 0] }),
      K.linear(P(LB.SP_L), P(LB.SP_R), L.B09, { off: LB.SP_L[1] - LB.collarTop + 14, labelAt: 0.5, labelNudge: [0, K.u(4.4)] }),
    ].join(""),
  });
  return { front, back };
}

export function sleeveMethodDrawings(L) {
  const { flat, bk, LB } = geo();
  const sv = flat.views.sleeveRight, S = sv.landmarks, cuff = S.cuff, vb = sv.viewBox;
  const sleeve = compose(sv, { x0: vb[0] - 125, x1: vb[0] + vb[2] + 125, y0: vb[1] - 8, y1: vb[1] + vb[3] + 10 }, 118, 128, {
    marker: "ks",
    overlay: (K) => [
      sleeveOverlays(K, S, L, { labelX: vb[0] - 14, s02y: S.SP[1] + 40, s02ey: cuff.BL[1] - 30 }),
      K.callout(P(cuff.TL), lab("", "CUFF SEAM (rib attached)", "end of S02 / S01", "REF"), { labelPos: P([vb[0] + vb[2] + 2, cuff.TL[1] - 40]), align: "start" }),
      K.callout(P(cuff.BL), lab("", "FINISHED CUFF EDGE", "end of S02-E / S01-E", "REF"), { labelPos: P([vb[0] + vb[2] + 2, cuff.BL[1] + 6]), align: "start" }),
      K.callout(P(S.SP), lab("SP", "SHOULDER POINT (dropped)", "start", "REF"), { labelPos: P([vb[0] + vb[2] + 2, S.SP[1] - 10]), align: "start" }),
    ].join(""),
  });
  const b0 = bk.frame;
  const back = compose(bk, { x0: b0.x0 - 250, x1: b0.x1 + 10, y0: b0.y0 - 20, y1: b0.y1 + 16 }, 128, 128, {
    marker: "kc",
    overlay: (K) => backSleeveOverlays(K, L, { labelX: b0.x0 - 14, s01y: LB.HPS_L[1] + 60, s01ey: LB.hem - 10 }),
  });
  return { sleeve, back };
}

export function backPomSheet(D, L) {
  const { bk, LB, outlineX, nearestIdx } = geo();
  const f0 = bk.frame, sr = bk.seams.right, cb = LB.cbNeck, cxB = cb[0];
  const HPSyB = (LB.HPS_L[1] + LB.HPS_R[1]) / 2;
  const backTop = Math.min(...LB.collarShapes.flat().filter((p) => Math.abs(p[0] - cxB) < 3).map((p) => p[1]));
  const yAB = LB.SP_L[1] - 8;
  const uaIdx = nearestIdx(sr, LB.UA_R);
  const xl = f0.x0 - 8, xr = f0.x1 + 8;
  const ref = (a) => a.map(P);
  const svg = compose(bk, { x0: f0.x0 - 240, x1: f0.x1 + 128, y0: f0.y0 - 34, y1: f0.y1 + 14 }, 182, 158, {
    marker: "mb",
    overlay: (K) => [
      K.linear(P(cb), P([cxB, LB.hem]), D.B06, { labelAt: 0.45, labelNudge: [K.u(16), 0] }),
      K.linear(P(cb), P([cxB, backTop]), D.C01, { off: K.u(3), labelPos: P([xl + 70, LB.collarTop - 18]), align: "end", labelAt: 0.5 }),
      K.linear(P([LB.HPS_R[0] + 10, HPSyB]), P([LB.HPS_R[0] + 10, cb[1]]), D.C07, { labelPos: P([xr - 70, LB.collarTop - 18]), align: "start", labelAt: 0.5, refs: [ref([LB.HPS_R, [LB.HPS_R[0] + 13, HPSyB]]), ref([[cxB + 2, cb[1]], [LB.HPS_R[0] + 13, cb[1]]])] }),
      K.linear(P([LB.HPS_L[0] - 14, HPSyB]), P([LB.HPS_L[0] - 14, LB.hem]), D.B07, { labelPos: P([xl - 4, LB.hem + 2]), align: "end", labelAt: 0.75, refs: [ref([LB.HPS_L, [LB.HPS_L[0] - 17, HPSyB]])] }),
      K.linear(P(LB.SP_L), P(LB.SP_R), D.B09, { off: LB.SP_L[1] - LB.collarTop + 12, labelAt: 0.5, labelNudge: [0, K.u(4.2)] }),
      K.linear(P(LB.HPS_R), P(LB.SP_R), D.B10, { off: K.u(2.6), labelPos: P([xr, HPSyB - 8]), align: "start", labelAt: 0.5 }),
      K.linear(P([LB.SP_R[0] + 9, HPSyB]), P([LB.SP_R[0] + 9, LB.SP_R[1]]), D.B11, { labelPos: P([xr, HPSyB + 20]), align: "start", labelAt: 0.5, refs: [ref([LB.HPS_R, [LB.SP_R[0] + 12, HPSyB]])] }),
      K.linear(P([outlineX(LB, yAB, -1), yAB]), P([outlineX(LB, yAB, 1), yAB]), D.B13, { labelAt: 0.7, labelNudge: [0, -K.u(4.2)] }),
      K.along(sr.slice(0, uaIdx + 1).map(P), D.B16, { labelPos: P([xr, LB.UA_R[1] + 30]), align: "start", leaderAt: 0.6 }),
      backSleeveOverlays(K, L, { labelX: xl - 4, s01y: HPSyB + 40, s01ey: LB.UA_L[1] + 90 }),
    ].join(""),
  });
  return { name: "back", drawings: [svg], ids: ["B06", "B07", "B09", "B10", "B11", "B13", "B16", "C01", "C07", "S01", "S01-E"] };
}

export function sleevePomSheet(D, L) {
  const { flat, LF } = geo();
  const sv = flat.views.sleeveRight, S = sv.landmarks, cuff = S.cuff, vb = sv.viewBox;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const top = [(S.SP[0] + S.UA[0]) / 2, (S.SP[1] + S.UA[1]) / 2], bot = [(cuff.TL[0] + cuff.TR[0]) / 2, (cuff.TL[1] + cuff.TR[1]) / 2];
  const len = dist(top, bot), u = [(bot[0] - top[0]) / len, (bot[1] - top[1]) / len], n = [-u[1], u[0]];
  const cross = (c, poly) => {
    let best = null;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i], d = [b[0] - a[0], b[1] - a[1]];
      const den = n[0] * d[1] - n[1] * d[0];
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - c[0]) * d[1] - (a[1] - c[1]) * d[0]) / den, s2 = ((a[0] - c[0]) * n[1] - (a[1] - c[1]) * n[0]) / den;
      if (s2 >= 0 && s2 <= 1 && (!best || Math.abs(t) < Math.abs(best.t))) best = { t, p: [c[0] + n[0] * t, c[1] + n[1] * t] };
    }
    return best?.p;
  };
  const across = (frac) => { const c = [top[0] + u[0] * len * frac, top[1] + u[1] * len * frac]; return [cross(c, S.overarm), cross(c, S.underarm)]; };
  const HPSyF = (LF.HPS_L[1] + LF.HPS_R[1]) / 2;
  const IN = (2.54 * (LF.hem - HPSyF)) / 67.65; // placement only ("1 inch below" per the POM definition)
  const uaFrac = Math.max(0, ((S.UA[0] - top[0]) * u[0] + (S.UA[1] - top[1]) * u[1]) / len);
  const [bA, bB] = across(uaFrac + IN / len);
  const [eA, eB] = across(0.5);
  const xL = vb[0] - 12, xR = vb[0] + vb[2] + 4;
  const capMid = S.cap[Math.round(S.cap.length * 0.6)];
  const svg = compose(sv, { x0: vb[0] - 150, x1: vb[0] + vb[2] + 120, y0: vb[1] - 8, y1: vb[1] + vb[3] + 14 }, 160, 160, {
    marker: "ms",
    overlay: (K) => [
      sleeveOverlays(K, S, L, { labelX: xL, s02y: S.SP[1] + 70, s02ey: cuff.BL[1] - 40 }),
      K.path([...S.underarm, cuff.BR].map(P), D.S03, { labelPos: P([xR, S.sideCorner[1] + 6]), align: "start", leaderAt: 0.62 }),
      K.linear(P(bA), P(bB), D.S04, { labelPos: P([xR, bB[1] - 4]), align: "start", labelAt: 0.92 }),
      K.linear(P(eA), P(eB), D.S05, { labelPos: P([xR, eB[1] + 6]), align: "start", labelAt: 0.92 }),
      K.linear(P(cuff.TL), P(cuff.TR), D.S06, { off: K.u(3), labelPos: P([xR, cuff.TR[1] - 2]), align: "start", labelAt: 0.8 }),
      K.linear(P(cuff.BL), P(cuff.BR), { ...D.S07, code: "S07/S08", short: "CUFF OPENING rel. / ext." }, { off: -K.u(3.5), labelPos: P([xR, cuff.BR[1] + 12]), align: "start", labelAt: 0.8 }),
      K.linear(P(cuff.TR), P(cuff.BR), D.S09, { off: K.u(3.5), labelPos: P([xR, cuff.BR[1] + 30]), align: "start", labelAt: 0.5 }),
      K.callout(P(capMid), { ...D.S10, value: "TBD (pattern measurement)" }, { labelPos: P([xR, S.SP[1] + 4]), align: "start" }),
    ].join(""),
  });
  return { name: "sleeve", drawings: [svg], ids: ["S02", "S02-E", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"] };
}
