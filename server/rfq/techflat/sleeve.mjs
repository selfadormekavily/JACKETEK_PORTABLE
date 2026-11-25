// STANDALONE SLEEVE FLAT — one detached sleeve, reconstructed from the licensed S.i. Graphics
// front flat (garment-spec/working-varsity-flat/front.svg + flat.json).
//
// VISUAL TECHNICAL-FLAT GEOMETRY ONLY. Not a pattern piece, not to scale, and never a source of
// measurements: every manufacturing dimension comes from the JACKETEK Master Spec.
//
// In the front flat the sleeve hangs beside the body and part of it is hidden: the upper
// sleeve cap and the underarm edge run behind the body, between the armhole seam and the
// waistband corner. Everything visible is used as drawn; only the hidden part is inferred.
//
//   from the purchased flat (as drawn): overarm edge (shoulder point → cuff), the visible start
//     of the armhole seam at the shoulder point, the visible underarm edge below the body
//     (waistband corner → cuff), the whole rib cuff (shape, stripes, rib lines, stitching).
//   inferred (hidden by the body): the rest of the cap curve and the upper underarm edge. The
//     underarm edge follows the overarm at the sleeve width where it comes out from behind the
//     body, so the sleeve keeps the drawing's own taper and elbow curve (no new taper).
//   not added: no seam, panel, topstitch, dart or gusset that the flat does not show.
//
// One sleeve is built (the front view's left-hand sleeve = wearer's RIGHT); the wearer's LEFT
// is its exact mirror image, so the two can never differ.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const nearestIdx = (pts, p) => pts.reduce((bi, q, i) => (dist(q, p) < dist(pts[bi], p) ? i : bi), 0);
const f = (n) => (Math.round(n * 100) / 100).toString();

/** Shorter-or-chosen arc of a closed polyline between two of its points. */
function arc(poly, a, b, pick) {
  const i = nearestIdx(poly, a), j = nearestIdx(poly, b);
  const lo = Math.min(i, j), hi = Math.max(i, j);
  const one = poly.slice(lo, hi + 1), two = [...poly.slice(hi), ...poly.slice(0, lo + 1)];
  let r = pick(one, two);
  if (dist(r[0], a) > dist(r.at(-1), a)) r = [...r].reverse();
  return r;
}
const meanX = (pts) => pts.reduce((s, p) => s + p[0], 0) / pts.length;
const corners = (pts) => {
  const by = (fn) => pts.reduce((b, p) => (fn(p) < fn(b) ? p : b), pts[0]);
  return { TL: by((p) => p[0] + p[1]), TR: by((p) => -p[0] + p[1]), BR: by((p) => -p[0] - p[1]), BL: by((p) => p[0] - p[1]) };
};
/** Polyline resampled at a fixed step (arc length). */
function resample(pts, step = 1) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = dist(a, b);
    let t = step - carry;
    while (t <= L) { out.push(add(a, mul(sub(b, a), t / L))); t += step; }
    carry = L - (t - step);
  }
  if (dist(out.at(-1), pts.at(-1)) > 1e-6) out.push(pts.at(-1));
  return out;
}
const smooth = (pts, r, passes = 1) => {
  let p = pts;
  for (let k = 0; k < passes; k++) p = p.map((q, i) => (i === 0 || i === p.length - 1 ? q : (() => { let sx = 0, sy = 0, n = 0; for (let j = Math.max(0, i - r); j <= Math.min(p.length - 1, i + r); j++) { sx += p[j][0]; sy += p[j][1]; n++; } return [sx / n, sy / n]; })()));
  return p;
};
const bez = (p0, p1, p2, p3, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); });
const layerMarkup = (svg, id) => new RegExp(`<g id="layer-${id}"[^>]*>([\\s\\S]*?)</g>`).exec(svg)?.[1] ?? "";

/**
 * Builds the detached sleeve. Returns { base, viewBox, landmarks, segments } in the sleeve's own
 * upright frame (y down, drawing units, not to scale).
 */
export function buildSleeve(dir) {
  const meta = JSON.parse(readFileSync(join(dir, "flat.json"), "utf8"));
  const frontSvg = readFileSync(join(dir, "front.svg"), "utf8");
  const v = meta.views.front, L = v.landmarks;
  const leftSide = (one, two) => (meanX(one) < meanX(two) ? one : two);

  // --- as drawn in the purchased flat
  const cuffPts = L.cuffs[0].pts;
  const C = corners(cuffPts); // TL/TR = cuff seam (outer / inner end), BL/BR = cuff opening
  const overarm = resample(arc(L.outline, L.SP_L, C.TL, leftSide), 1); // SP → cuff seam, outer edge
  const underVis = arc(L.outline, L.sideBottom_L, C.TR, leftSide); // waistband corner → cuff seam, inner edge
  const seam = v.seams.left; // armhole seam as drawn, from SP; it turns down where the body hides the sleeve
  const t0 = unit(sub(seam[3], seam[0]));
  let turn = seam.findIndex((p, i) => i > 2 && Math.acos(Math.max(-1, Math.min(1, unit(sub(p, seam[i - 1]))[0] * t0[0] + unit(sub(p, seam[i - 1]))[1] * t0[1]))) > Math.PI / 4);
  if (turn < 0) turn = 4;
  const capVis = seam.slice(0, turn); // SP → last point before the turn
  const cuffArc = arc(cuffPts, C.TR, C.TL, (one, two) => (one.some((p) => p === C.BR) ? one : two.some((p) => p === C.BR) ? two : meanX(one) < meanX(two) ? one : two));

  // --- inferred: the underarm edge behind the body, offset from the overarm at the sleeve
  // width where the underarm edge comes out from behind the body (the waistband corner).
  const n = overarm.length;
  const tang = overarm.map((_, i) => unit(sub(overarm[Math.min(n - 1, i + 6)], overarm[Math.max(0, i - 6)])));
  let nor = tang.map((t) => [t[1], -t[0]]); // inward (towards the sleeve's inside)
  const W = dist(overarm[nearestIdx(overarm, L.sideBottom_L)], L.sideBottom_L);
  const R = Math.round(W * 0.6); // normals smoothed over ~the sleeve width so the offset cannot fold
  nor = smooth(nor, R, 3).map(unit);
  const iSB = nearestIdx(overarm, L.sideBottom_L);
  let offset = overarm.map((p, i) => add(p, mul(nor[i], W)));
  offset = smooth(offset, Math.round(W * 0.25), 2);
  // Cap: continue the drawn seam start into the underarm edge (smooth, tangent-continuous).
  const iUA = Math.round(W * 0.55);
  const p0 = capVis.at(-1), d0 = unit(sub(capVis.at(-1), capVis.at(-2)));
  const p3 = offset[iUA], d3 = unit(sub(offset[iUA + 4], offset[iUA]));
  const k = dist(p0, p3) * 0.45;
  const capInf = bez(p0, add(p0, mul(d0, k)), sub(p3, mul(d3, k)), p3);
  // Underarm behind the body: one smooth curve from the underarm point (heading parallel to the
  // overarm there) to where the drawn underarm edge comes out below the body (keeping its tangent).
  const dv = unit(sub(underVis[0], underVis[Math.min(underVis.length - 1, 3)])); // drawn edge, pointing up
  const kj = dist(p3, L.sideBottom_L) * 0.36;
  const joinPts = bez(p3, add(p3, mul(d3, kj)), add(L.sideBottom_L, mul(dv, kj)), L.sideBottom_L, 80);
  const underInf = [p3];

  // Outline: SP → cap (drawn, then inferred) → underarm (inferred, then drawn) → cuff → overarm back to SP.
  const ring = [...capVis, ...capInf.slice(1), ...underInf.slice(1), ...joinPts.slice(1), ...underVis.slice(1), ...cuffArc.slice(1), ...[...overarm].reverse().slice(1)];

  // --- upright frame: the line from the shoulder point to the middle of the cuff opening points straight down.
  const open = mul(add(C.BL, C.BR), 0.5);
  const ax = unit(sub(open, L.SP_L));
  const ang = Math.atan2(ax[0], ax[1]); // rotate by +ang so ax → (0, 1)
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const rot = (p) => [cs * p[0] - sn * p[1], sn * p[0] + cs * p[1]];
  const rr = ring.map(rot);
  const xs = rr.map((p) => p[0]), ys = rr.map((p) => p[1]);
  const pad = 14, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const viewBox = [x0, y0, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad].map((q) => +q.toFixed(2));
  const matrix = [cs, sn, -sn, cs, 0, 0]; // SVG matrix(a b c d e f) for rot()
  const M = (pts) => pts.map(rot);

  const silStyle = /<path style="([^"]*)"/.exec(layerMarkup(frontSvg, "silhouette"))?.[1] ?? "fill:#F1F2F2;stroke:#000000;stroke-width:2.1932;stroke-linejoin:round;";
  const d = `M${ring.map((p) => `${f(p[0])},${f(p[1])}`).join("L")}Z`;
  const cb = { x0: Math.min(...cuffPts.map((p) => p[0])) - 3, x1: Math.max(...cuffPts.map((p) => p[0])) + 3, y0: Math.min(...cuffPts.map((p) => p[1])) - 3, y1: Math.max(...cuffPts.map((p) => p[1])) + 3 };
  const cuffLayers = ["cuffs", "cuff-rib-lines", "cuff-stripes", "cuff-stitch"].map((id) => `<g id="layer-${id}">${layerMarkup(frontSvg, id)}</g>`).join("");
  const sleeveGroup = (cid) => `<g transform="matrix(${matrix.map(f).join(" ")})"><g id="layer-silhouette"><path style="${silStyle}" d="${d}"/></g><defs><clipPath id="${cid}"><rect x="${f(cb.x0)}" y="${f(cb.y0)}" width="${f(cb.x1 - cb.x0)}" height="${f(cb.y1 - cb.y0)}"/></clipPath></defs><g clip-path="url(#${cid})">${cuffLayers}</g></g>`;
  const midX = viewBox[0] + viewBox[2] / 2;

  const lm = {
    SP: rot(L.SP_L), capVisEnd: rot(p0), UA: rot(p3), sideCorner: rot(L.sideBottom_L),
    cuff: { TL: rot(C.TL), TR: rot(C.TR), BR: rot(C.BR), BL: rot(C.BL) },
    overarm: M(overarm), cap: M([...capVis, ...capInf.slice(1)]), underarm: M([p3, ...underInf.slice(1), ...joinPts.slice(1), ...underVis.slice(1)]),
    outline: M(ring),
  };
  const segments = [
    { id: "overarm", from: "purchased flat", pts: lm.overarm },
    { id: "cap (visible seam start)", from: "purchased flat", pts: M(capVis) },
    { id: "cap (continuation)", from: "inferred", pts: M(capInf) },
    { id: "underarm (behind the body)", from: "inferred", pts: M([...underInf, ...joinPts.slice(1)]) },
    { id: "underarm (below the body)", from: "purchased flat", pts: M(underVis) },
    { id: "cuff (shape, stripes, rib lines, stitch)", from: "purchased flat", pts: M(cuffArc) },
  ];
  return {
    viewBox, segments, landmarks: lm, width: W,
    /** Wearer's RIGHT sleeve (front view's left-hand sleeve), upright. */
    right: sleeveGroup("cuff-clip-r"),
    /** Wearer's LEFT sleeve: the exact mirror image. */
    left: `<g transform="translate(${f(2 * midX)} 0) scale(-1 1)">${sleeveGroup("cuff-clip-l")}</g>`,
    mirrorX: (p) => [2 * midX - p[0], p[1]],
  };
}

/** Writes the standalone sleeves into the working area (sleeve-right.svg, sleeve-left.svg, sleeve.json). */
export function writeSleeveFiles(dir, head) {
  const S = buildSleeve(dir);
  const vb = S.viewBox.join(" ");
  const note = "standalone sleeve, RECONSTRUCTED from the front flat (visual technical-flat geometry only — not a pattern, not to scale, no measurements)";
  writeFileSync(join(dir, "sleeve-right.svg"), `${head(vb, `wearer's RIGHT ${note}`)}\n${S.right}\n</svg>\n`);
  writeFileSync(join(dir, "sleeve-left.svg"), `${head(vb, `wearer's LEFT ${note}; exact mirror of sleeve-right.svg`)}\n${S.left}\n</svg>\n`);
  const r2 = (pts) => pts.map((p) => p.map((q) => +q.toFixed(2)));
  writeFileSync(join(dir, "sleeve.json"), `${JSON.stringify({
    note: "Wearer's right sleeve, upright frame (drawing units, y down, NOT to scale). Visual geometry only: never a source of measurements.",
    viewBox: S.viewBox,
    segments: S.segments.map((s) => ({ id: s.id, from: s.from, pts: r2(s.pts) })),
  }, null, 1)}\n`);
}
