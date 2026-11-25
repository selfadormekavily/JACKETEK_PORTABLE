// CANONICAL SHEETS — every drawing of the canonical flat (S.i. Graphics licensed flat +
// reconstructed standalone sleeves) with its separate POM overlay. One builder for the
// review package (scripts/techflat-review-v2.mjs) and the RFQ Tech Pack (server/rfq/render.mjs),
// so both always show the same lines with the same POM ids.
//
//   canonicalSheets(F, D, { colourDemo }) → [{ name, title, ids, drawings: [{ svg, overlay, collisions, caption? }], tableW? }]
//
// F = loadFlat(); D = POM labels (pomlabels.mjs: pomDisplay(master) or pomDisplayFromSpec(spec)).
// Drawing positions are placement only; no value is ever read from the drawing.
import { compose, T } from "./canonical.mjs";

export function canonicalSheets(F, D, { colourDemo = null } = {}) {
  const sheets = [];
  const emit = (name, title, drawings, ids = [], opts = {}) => sheets.push({ name, title, drawings, ids, ...opts });

  // ---------------------------------------------------------------- geometry
  const fr = F.views.front, bk = F.views.back;
  const LF = fr.landmarks, LB = bk.landmarks;
  const cxF = (fr.frame.x0 + fr.frame.x1) / 2, cxB = LB.cbNeck?.[0] ?? (bk.frame.x0 + bk.frame.x1) / 2;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nearestIdx = (pts, p) => pts.reduce((bi, q, i) => (dist(q, p) < dist(pts[bi], p) ? i : bi), 0);
  /** x of a polyline (seam) at height y (template y down). */
  const xAtY = (pts, y) => {
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) return x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
    }
    return null;
  };
  /** The silhouette's outer boundary at height y on one side (min / max x of outline crossings). */
  const outlineX = (L, y, side) => {
    const xs = [];
    const o = L.outline;
    for (let i = 1; i < o.length; i++) {
      const [x1, y1] = o[i - 1], [x2, y2] = o[i];
      if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    return side < 0 ? Math.min(...xs) : Math.max(...xs);
  };
  /** The outline arc between two points, on the outer (sleeve) side. */
  const outlineArc = (L, a, b, side) => {
    const o = L.outline, i = nearestIdx(o, a), j = nearestIdx(o, b);
    const lo = Math.min(i, j), hi = Math.max(i, j);
    const inner = o.slice(lo, hi + 1), outer = [...o.slice(hi), ...o.slice(0, lo + 1)];
    const mean = (arr) => arr.reduce((s, p) => s + p[0], 0) / arr.length;
    let arc = side < 0 ? (mean(inner) < mean(outer) ? inner : outer) : mean(inner) > mean(outer) ? inner : outer;
    if (dist(arc[0], a) > dist(arc.at(-1), a)) arc = [...arc].reverse();
    return arc;
  };
  /** Corners of a (rotated) quad-like shape: TL, TR, BR, BL by extremes. */
  const corners = (pts) => {
    const by = (f) => pts.reduce((b, p) => (f(p) < f(b) ? p : b), pts[0]);
    return { TL: by((p) => p[0] + p[1]), TR: by((p) => -p[0] + p[1]), BR: by((p) => -p[0] - p[1]), BL: by((p) => p[0] - p[1]) };
  };
  const HPSyF = (LF.HPS_L[1] + LF.HPS_R[1]) / 2, HPSyB = (LB.HPS_L[1] + LB.HPS_R[1]) / 2;
  const SCALE = (LF.hem - HPSyF) / 67.65; // drawing points per cm (provisional M length) — for placing lines only
  const IN = 2.54 * SCALE;
  const P = (p) => T(p); // template → dimension kit
  const ref = (pts) => pts.map(P);


  const pad = (fr0, l, r, t, b) => ({ x0: fr0.x0 - l, x1: fr0.x1 + r, y0: fr0.y0 - t, y1: fr0.y1 + b });

  // ---------------------------------------------------------------- 01–04 plain flats
  const plain = (view, region, w, h) => compose(view, region, w, h);
  const vbR = (vb) => ({ x0: vb[0], y0: vb[1], x1: vb[0] + vb[2], y1: vb[1] + vb[3] });
  emit("01-front", "FRONT — TECHNICAL FLAT", [plain(fr, vbR(fr.viewBox), 255, 160)]);
  emit("02-back", "BACK — TECHNICAL FLAT", [plain(bk, vbR(bk.viewBox), 255, 160)]);
  emit("03-left-sleeve", "LEFT SLEEVE AS WORN — complete sleeve flat (mirror image of the right sleeve)", [plain(F.views.sleeveLeft, vbR(F.views.sleeveLeft.viewBox), 120, 160)]);
  emit("04-right-sleeve", "RIGHT SLEEVE AS WORN — complete sleeve flat (reconstructed from the purchased front flat, see 07b)", [plain(F.views.sleeveRight, vbR(F.views.sleeveRight.viewBox), 120, 160)]);

  // ---------------------------------------------------------------- 05 front POM (body)
  const xl = (fr0) => fr0.x0 - 8, xr = (fr0) => fr0.x1 + 8;
  {
    const f0 = fr.frame, sl = fr.seams.left, sr = fr.seams.right;
    const chestY = LF.UA_L[1] + IN;
    const yWaist = LF.UA_L[1] + 0.55 * (LF.waistbandTop - LF.UA_L[1]);
    const yAF = LF.SP_L[1] - 8;
    const ids = ["B01", "B12", "B02", "B03", "B04", "B05", "B08", "B14", "B15", "R01"];
    const d = compose(fr, pad(f0, 136, 146, 22, 26), 182, 158, {
      marker: "fp",
      overlay: (K) => [
        K.linear(P([xAtY(sl, chestY), chestY]), P([xAtY(sr, chestY), chestY]), D.B01, { labelAt: 0.3, labelNudge: [0, K.u(4.2)] }),
        K.linear(P([outlineX(LF, yAF, -1), yAF]), P([outlineX(LF, yAF, 1), yAF]), D.B12, { labelPos: P([xl(f0), yAF - 12]), align: "end", labelAt: 0.02 }),
        K.linear(P([xAtY(sl, yWaist), yWaist]), P([xAtY(sr, yWaist), yWaist]), D.B02, { labelAt: 0.3, labelNudge: [0, -K.u(4.2)] }),
        K.linear(P([LF.sideBottom_L[0], LF.waistbandTop - 2.5]), P([LF.sideBottom_R[0], LF.waistbandTop - 2.5]), D.B03, { labelPos: P([xl(f0), LF.waistbandTop - 18]), align: "end", labelAt: 0.02 }),
        K.linear(P([LF.waistbandX0, LF.hem]), P([LF.waistbandX1, LF.hem]), { ...D.B04, code: "B04/B05", short: "BOTTOM OPENING relaxed / extended" }, { off: -K.u(5), labelAt: 0.5, labelNudge: [0, -K.u(4.6)] }),
        K.linear(P([LF.HPS_R[0] + 14, HPSyF]), P([LF.HPS_R[0] + 14, LF.hem]), D.B08, { labelPos: P([xr(f0), LF.hem - 70]), align: "start", labelAt: 0.75, refs: [ref([LF.HPS_R, [LF.HPS_R[0] + 17, HPSyF]])] }),
        K.linear(P([LF.UA_R[0] - 12, HPSyF]), P([LF.UA_R[0] - 12, LF.UA_R[1]]), D.B14, { labelPos: P([xr(f0), HPSyF - 6]), align: "start", labelAt: 0.3, refs: [ref([[LF.HPS_R[0] + 2, HPSyF], [LF.UA_R[0] - 9, HPSyF]]), ref([LF.UA_R, [LF.UA_R[0] - 15, LF.UA_R[1]]])] }),
        K.linear(P(LF.SP_L), P(LF.UA_L), D.B15, { off: K.u(3), labelPos: P([xl(f0), HPSyF - 6]), align: "end", labelAt: 0.5 }),
        K.linear(P([LF.waistbandX1 + 7, LF.waistbandTop]), P([LF.waistbandX1 + 7, LF.hem]), D.R01, { labelPos: P([xr(f0), LF.hem + 4]), align: "start", labelAt: 0.5 }),
      ].join(""),
    });
    emit("05-front-pom", "FRONT — BODY POINTS OF MEASURE", [d], ids);
  }

  // ---------------------------------------------------------------- 05b front POM (neck, collar, opening, snaps, pockets)
  {
    const f0 = fr.frame;
    const cfNeckY = LF.frontEdgeTop[1];
    const bands = LF.collarShapes.filter((s) => Math.min(...s.map((p) => p[1])) < cfNeckY - 30 && Math.max(...s.map((p) => p[1])) > cfNeckY - 3);
    const vTip = Math.min(...bands.flat().filter((p) => Math.abs(p[0] - cxF) < 3 && p[1] > LF.collarTop + 25).map((p) => p[1]));
    const snaps = LF.snaps;
    const pk = LF.pockets[1]; // viewer's right
    const ys = [...pk].sort((a, b) => a[1] - b[1]);
    const top2 = ys.slice(0, 2).sort((a, b) => a[0] - b[0]), bot2 = ys.slice(2).sort((a, b) => a[0] - b[0]);
    const openTop = top2[0], openBot = bot2[0]; // CF-side long edge = opening
    const pTop = { x: (top2[0][0] + top2[1][0]) / 2, y: (top2[0][1] + top2[1][1]) / 2 };
    const pBot = [(bot2[0][0] + bot2[1][0]) / 2, (bot2[0][1] + bot2[1][1]) / 2];
    const ids = ["C02", "C05", "C06", "F01", "F02", "F03", "F04", "F05", "F06", "F07", "P01", "P02", "P03", "P04", "P05"];
    const region = { x0: f0.x0 - 136, x1: f0.x1 + 146, y0: f0.y0 - 50, y1: LF.hem + 50 };
    const d = compose(fr, region, 182, 158, {
      marker: "fd",
      overlay: (K) => [
        K.linear(P(LF.HPS_L), P(LF.HPS_R), D.C05, { off: HPSyF - LF.collarTop + 9, labelAt: 0.5, labelNudge: [0, K.u(4.2)] }),
        K.linear(P([LF.HPS_R[0] + 12, HPSyF]), P([LF.HPS_R[0] + 12, cfNeckY]), D.C06, { labelPos: P([xr(f0), HPSyF - 14]), align: "start", labelAt: 0.5, refs: [ref([LF.HPS_R, [LF.HPS_R[0] + 15, HPSyF]]), ref([[cxF + 2, cfNeckY], [LF.HPS_R[0] + 15, cfNeckY]])] }),
        K.linear(P([cxF - 4, cfNeckY]), P([cxF - 4, vTip]), D.C02, { off: K.u(2.5), labelPos: P([xl(f0), HPSyF - 14]), align: "end", labelAt: 0.5 }),
        K.callout(P([cxF + 1, cfNeckY + 40]), { ...D.F01, value: "TBD (inside, not on flat)" }, { labelPos: P([xl(f0), cfNeckY + 14]), align: "end" }),
        K.callout(P([LF.frontEdgeTop[0], cfNeckY + 70]), { ...D.F02, value: "TBD (edge drawn on CF)" }, { labelPos: P([xl(f0), cfNeckY + 36]), align: "end" }),
        K.linear(P([cxF + 9, cfNeckY]), P([cxF + 9, snaps[0][1]]), D.F04, { labelPos: P([xr(f0), cfNeckY + 4]), align: "start", labelAt: 0.5, refs: [ref([[snaps[0][0] + 2, snaps[0][1]], [cxF + 12, snaps[0][1]]])] }),
        K.linear(P([cxF + 9, snaps[0][1]]), P([cxF + 9, snaps[1][1]]), D.F06, { labelPos: P([xr(f0), cfNeckY + 26]), align: "start", labelAt: 0.5, refs: [ref([[snaps[1][0] + 2, snaps[1][1]], [cxF + 12, snaps[1][1]]])] }),
        K.callout(P([snaps[2][0], snaps[2][1]]), { ...D.F03, value: "TBD (as drawn)" }, { labelPos: P([xr(f0), cfNeckY + 48]), align: "start" }),
        K.callout(P([snaps[1][0] + snaps[1][2], snaps[1][1]]), D.F07, { labelPos: P([xl(f0), cfNeckY + 58]), align: "end" }),
        K.linear(P([cxF - 9, LF.hem]), P([cxF - 9, snaps.at(-1)[1]]), D.F05, { labelPos: P([xr(f0), LF.hem + 4]), align: "start", labelAt: 0.5, refs: [ref([[snaps.at(-1)[0] - 2, snaps.at(-1)[1]], [cxF - 12, snaps.at(-1)[1]]])] }),
        K.linear(P(openTop), P(openBot), D.P01, { off: K.u(3), labelPos: P([xr(f0), pTop.y + 18]), align: "start", labelAt: 0.5 }),
        K.linear(P(bot2[0]), P(bot2[1]), D.P02, { off: -K.u(3), labelPos: P([xr(f0), pBot[1] + 14]), align: "start", labelAt: 0.5 }),
        K.linear(P([top2[1][0] + 9, HPSyF]), P([top2[1][0] + 9, pTop.y]), D.P03, { labelPos: P([xr(f0), pTop.y - 14]), align: "start", labelAt: 0.85, refs: [ref([LF.HPS_R, [top2[1][0] + 12, HPSyF]]), ref([top2[1], [top2[1][0] + 12, top2[1][1]]])] }),
        K.linear(P([cxF, pTop.y - 7]), P([pTop.x, pTop.y - 7]), D.P04, { labelAt: 0.4, labelNudge: [0, K.u(4.2)], refs: [ref([[pTop.x, pTop.y - 2], [pTop.x, pTop.y - 10]])] }),
        K.angle(P(pBot), [0, 1], [pTop.x - pBot[0], -(pTop.y - pBot[1])], 22, D.P05, { labelPos: P([xr(f0), pBot[1] - 10]), align: "start" }),
      ].join(""),
    });
    emit("05b-front-detail-pom", "FRONT — NECK, COLLAR, OPENING, SNAPS, POCKETS", [d], ids);
  }

  // ---------------------------------------------------------------- 06 back POM
  {
    const f0 = bk.frame, sr = bk.seams.right;
    const cb = LB.cbNeck;
    const backTop = Math.min(...LB.collarShapes.flat().filter((p) => Math.abs(p[0] - cxB) < 3).map((p) => p[1]));
    const yAB = LB.SP_L[1] - 8;
    // S01: CB neck → shoulder line to SP (outline top) → overarm (outline) → cuff end.
    const cuffL = corners(LB.cuffs[0].pts);
    const shoulder = outlineArc(LB, LB.HPS_L, LB.SP_L, -1);
    const overarm = outlineArc(LB, LB.SP_L, cuffL.BL, -1);
    const uaIdx = nearestIdx(sr, LB.UA_R);
    const ids = ["B06", "B07", "B09", "B10", "B11", "B13", "B16", "C01", "C07", "S01"];
    const d = compose(bk, pad(f0, 128, 128, 34, 14), 182, 158, {
      marker: "bp",
      overlay: (K) => [
        K.linear(P(cb), P([cxB, LB.hem]), D.B06, { labelAt: 0.45, labelNudge: [K.u(16), 0] }),
        K.linear(P(cb), P([cxB, backTop]), D.C01, { off: K.u(3), labelPos: P([xl(f0) + 70, LB.collarTop - 18]), align: "end", labelAt: 0.5 }),
        K.linear(P([LB.HPS_R[0] + 10, HPSyB]), P([LB.HPS_R[0] + 10, cb[1]]), D.C07, { labelPos: P([xr(f0) - 70, LB.collarTop - 18]), align: "start", labelAt: 0.5, refs: [ref([LB.HPS_R, [LB.HPS_R[0] + 13, HPSyB]]), ref([[cxB + 2, cb[1]], [LB.HPS_R[0] + 13, cb[1]]])] }),
        K.linear(P([LB.HPS_L[0] - 14, HPSyB]), P([LB.HPS_L[0] - 14, LB.hem]), D.B07, { labelPos: P([xl(f0), LB.hem - 70]), align: "end", labelAt: 0.75, refs: [ref([LB.HPS_L, [LB.HPS_L[0] - 17, HPSyB]])] }),
        K.linear(P(LB.SP_L), P(LB.SP_R), D.B09, { off: LB.SP_L[1] - LB.collarTop + 12, labelAt: 0.5, labelNudge: [0, K.u(4.2)] }),
        K.linear(P(LB.HPS_R), P(LB.SP_R), D.B10, { off: K.u(2.6), labelPos: P([xr(f0), HPSyB - 8]), align: "start", labelAt: 0.5 }),
        K.linear(P([LB.SP_R[0] + 9, HPSyB]), P([LB.SP_R[0] + 9, LB.SP_R[1]]), D.B11, { labelPos: P([xr(f0), HPSyB + 20]), align: "start", labelAt: 0.5, refs: [ref([LB.HPS_R, [LB.SP_R[0] + 12, HPSyB]])] }),
        K.linear(P([outlineX(LB, yAB, -1), yAB]), P([outlineX(LB, yAB, 1), yAB]), D.B13, { labelAt: 0.7, labelNudge: [0, -K.u(4.2)] }),
        K.along(sr.slice(0, uaIdx + 1).map(P), D.B16, { labelPos: P([xr(f0), LB.UA_R[1] + 30]), align: "start", leaderAt: 0.6 }),
        K.path([cb, ...shoulder, ...overarm.slice(1), cuffL.BL].map(P), D.S01, { labelPos: P([xl(f0), HPSyB + 40]), align: "end", leaderAt: 0.55 }),
      ].join(""),
    });
    emit("06-back-pom", "BACK — POINTS OF MEASURE", [d], ids);
  }

  // ---------------------------------------------------------------- 07 sleeve POM (complete standalone sleeve, wearer's right; left = mirror)
  {
    const sv = F.views.sleeveRight, S = sv.landmarks, cuff = S.cuff;
    // Sleeve centre line: from the middle of the cap (SP → underarm point) to the middle of the cuff seam.
    const top = [(S.SP[0] + S.UA[0]) / 2, (S.SP[1] + S.UA[1]) / 2], bot = [(cuff.TL[0] + cuff.TR[0]) / 2, (cuff.TL[1] + cuff.TR[1]) / 2];
    const len = dist(top, bot), u = [(bot[0] - top[0]) / len, (bot[1] - top[1]) / len], n = [-u[1], u[0]];
    const cross = (c, poly) => {
      // Intersection of the line c + t·n with a polyline, nearest to c.
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
    const uaFrac = Math.max(0, ((S.UA[0] - top[0]) * u[0] + (S.UA[1] - top[1]) * u[1]) / len);
    const [bA, bB] = across(uaFrac + IN / len); // placement only ("1 inch below" per the POM definition) — not a measurement
    const [eA, eB] = across(0.5);
    const vb = sv.viewBox;
    const region = { x0: vb[0] - 120, x1: vb[0] + vb[2] + 120, y0: vb[1] - 8, y1: vb[1] + vb[3] + 14 };
    const ids = ["S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"];
    const xL = vb[0] - 4, xR = vb[0] + vb[2] + 4;
    const capMid = S.cap[Math.round(S.cap.length * 0.6)];
    const d = compose(sv, region, 160, 160, {
      marker: "sp",
      overlay: (K) => [
        K.path([...S.overarm, cuff.BL].map(P), D.S02, { labelPos: P([xL, S.SP[1] + 70]), align: "end", leaderAt: 0.35 }),
        K.path([...S.underarm, cuff.BR].map(P), D.S03, { labelPos: P([xR, S.sideCorner[1] + 6]), align: "start", leaderAt: 0.62 }),
        K.linear(P(bA), P(bB), D.S04, { labelPos: P([xR, bB[1] - 4]), align: "start", labelAt: 0.92 }),
        K.linear(P(eA), P(eB), D.S05, { labelPos: P([xR, eB[1] + 6]), align: "start", labelAt: 0.92 }),
        K.linear(P(cuff.TL), P(cuff.TR), D.S06, { off: K.u(3), labelPos: P([xR, cuff.TR[1] - 2]), align: "start", labelAt: 0.8 }),
        K.linear(P(cuff.BL), P(cuff.BR), { ...D.S07, code: "S07/S08", short: "CUFF OPENING rel. / ext." }, { off: -K.u(3.5), labelPos: P([xR, cuff.BR[1] + 12]), align: "start", labelAt: 0.8 }),
        K.linear(P(cuff.TL), P(cuff.BL), D.S09, { off: -K.u(3.5), labelPos: P([xL, cuff.BL[1] - 2]), align: "end", labelAt: 0.5 }),
        K.callout(P(capMid), { ...D.S10, value: "TBD (pattern measurement)" }, { labelPos: P([xR, S.SP[1] + 4]), align: "start" }),
      ].join(""),
    });
    emit("07-sleeve-pom", "SLEEVE — POINTS OF MEASURE (complete sleeve flat, wearer's right; left = mirror image)", [d], ids, { tableW: 100 });
  }

  // ---------------------------------------------------------------- 07b how the standalone sleeve was built (review aid)
  {
    const sv = F.views.sleeveRight, vb = sv.viewBox;
    const col = { "purchased flat": "#1a8f3a", inferred: "#d0202a" };
    const lines = sv.segments.map((s) => `<polyline points="${s.pts.map((p) => p.map((q) => q.toFixed(2)).join(",")).join(" ")}" fill="none" stroke="${col[s.from]}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"${s.from === "inferred" ? ' stroke-dasharray="5 3"' : ""}/>`).join("");
    const srcRegion = { x0: fr.frame.x0 - 8, x1: cxF - 20, y0: LF.SP_L[1] - 80, y1: LF.hem + 30 };
    emit("07b-sleeve-reconstruction", "SLEEVE RECONSTRUCTION — what comes from the purchased flat, what is inferred", [
      { ...compose(fr, srcRegion, 120, 150), caption: "AS DRAWN in the purchased front flat — the cap and the underarm edge run behind the body" },
      { ...compose(sv, { x0: vb[0] - 10, x1: vb[0] + vb[2] + 10, y0: vb[1], y1: vb[1] + vb[3] }, 120, 150, { extra: `<g id="provenance">${lines}</g>` }), caption: "STANDALONE SLEEVE — green solid: purchased flat as drawn · red dashed: inferred (hidden in the source)" },
    ], []);
  }

  // ---------------------------------------------------------------- 08 rib details (enlarged crops of the same flat)
  {
    const c = (pom) => ({ ...pom, short: "" }); // compact label: code + value · status (names in the table)
    const cfNeckY = LF.frontEdgeTop[1];
    const bands = LF.collarShapes.filter((sh) => Math.min(...sh.map((q) => q[1])) < cfNeckY - 30 && Math.max(...sh.map((q) => q[1])) > cfNeckY - 3);
    const vTip = Math.min(...bands.flat().filter((q) => Math.abs(q[0] - cxF) < 3 && q[1] > LF.collarTop + 25).map((q) => q[1]));
    const backFace = LF.collarShapes.find((sh) => Math.max(...sh.map((q) => q[1])) < cfNeckY - 30) ?? LF.collarShapes[0];
    const faceTopY = Math.min(...backFace.map((q) => q[1]));
    const faceTop = backFace.filter((q) => q[1] < faceTopY + 4).sort((a, b) => a[0] - b[0]);
    // Collar seam (attached edge): each seam piece in its own order, left piece then right piece, HPS → CF → HPS.
    const seams = LF.collarSeams.map((sp) => (sp[0][1] < sp.at(-1)[1] ? sp : [...sp].reverse())).sort((a, b) => a[0][0] - b[0][0]);
    const seamPath = seams.length === 2 ? [...seams[0], ...[...seams[1]].reverse()] : seams.flat();
    const RC = { x0: LF.HPS_L[0] - 40, x1: LF.HPS_R[0] + 40, y0: LF.collarTop - 16, y1: cfNeckY + 18 };
    const collar = compose(fr, RC, 106, 70, {
      marker: "rc",
      overlay: (K) => [
        K.linear(P([cxF - 3, cfNeckY]), P([cxF - 3, vTip]), c(D.C02), { off: K.u(2.5), labelPos: P([RC.x0 + 2, cfNeckY + 8]), align: "start" }),
        K.along(seamPath.map(P), c(D.C03), { labelPos: P([RC.x1 - 2, cfNeckY + 8]), align: "end", leaderAt: 0.85 }),
        K.along(faceTop.map(P), c(D.C04), { labelPos: P([RC.x1 - 2, RC.y0 + 8]), align: "end", leaderAt: 0.9 }),
        K.callout(P([LF.HPS_L[0] + 10, LF.collarTop + 14]), c(D.R05), { labelPos: P([RC.x0 + 2, RC.y0 + 8]), align: "start" }),
        K.callout(P(seamPath[Math.round(seamPath.length * 0.2)]), c(D.R04), { labelPos: P([RC.x0 + 2, HPSyF + 14]), align: "start" }),
      ].join(""),
    });
    const backTop = Math.min(...LB.collarShapes.flat().filter((q) => Math.abs(q[0] - cxB) < 3).map((q) => q[1]));
    const cb = LB.cbNeck;
    const RB = { x0: LB.HPS_L[0] - 28, x1: LB.HPS_R[0] + 28, y0: LB.collarTop - 14, y1: cb[1] + 16 };
    const backCollar = compose(bk, RB, 70, 70, {
      marker: "rb",
      overlay: (K) => K.linear(P(cb), P([cxB, backTop]), c(D.C01), { off: K.u(3), labelPos: P([RB.x1 - 2, cb[1] + 10]), align: "end" }),
    });
    const ck = corners(LF.cuffs[1].pts); // viewer's right cuff (front view)
    const cf = LF.cuffs[1];
    const RK = { x0: cf.x0 - 40, x1: cf.x1 + 16, y0: cf.y0 - 18, y1: cf.y1 + 16 };
    const cuffD = compose(fr, RK, 76, 70, {
      marker: "rk",
      overlay: (K) => [
        K.linear(P(ck.TR), P(ck.BR), c(D.S09), { off: K.u(3), labelPos: P([RK.x0 + 2, RK.y0 + 6]), align: "start" }),
        K.linear(P(ck.BL), P(ck.BR), { ...c(D.S07), code: "S07/S08" }, { off: -K.u(3), labelPos: P([RK.x0 + 2, RK.y1 - 4]), align: "start" }),
        K.callout(P([(ck.TL[0] + ck.TR[0]) / 2, (ck.TL[1] + ck.TR[1]) / 2 + 2]), c(D.R03), { labelPos: P([RK.x0 + 2, (RK.y0 + RK.y1) / 2]), align: "start" }),
      ].join(""),
    });
    const wb = { x1: LF.waistbandX1 };
    const RW = { x0: wb.x1 - 78, x1: wb.x1 + 30, y0: LF.waistbandTop - 22, y1: LF.hem + 20 };
    const wbD = compose(fr, RW, 100, 70, {
      marker: "rw",
      overlay: (K) => [
        K.linear(P([wb.x1 + 4, LF.waistbandTop]), P([wb.x1 + 4, LF.hem]), c(D.R01), { labelPos: P([RW.x1 - 2, RW.y0 + 6]), align: "end" }),
        K.linear(P([wb.x1 - 72, LF.hem]), P([wb.x1, LF.hem]), { ...c(D.B04), code: "B04/B05 (half shown)" }, { off: -K.u(3), labelPos: P([RW.x0 + 2, RW.y1 - 3]), align: "start" }),
        K.callout(P([wb.x1 - 30, LF.waistbandTop + 0.62 * (LF.hem - LF.waistbandTop)]), c(D.R05), { labelPos: P([RW.x0 + 2, RW.y0 + 6]), align: "start" }),
        K.callout(P([wb.x1 - 52, LF.waistbandTop + 1]), c(D.R02), { labelPos: P([RW.x1 - 2, RW.y1 - 3]), align: "end" }),
      ].join(""),
    });
    const ids = ["C01", "C02", "C03", "C04", "R04", "R05", "S09", "S07", "S08", "R03", "R01", "B04", "B05", "R02"];
    emit("08-rib-detail", "RIB DETAILS — COLLAR, CUFF, WAISTBAND (enlarged from the same flat)", [
      { ...collar, caption: "COLLAR RIB — front" },
      { ...backCollar, caption: "COLLAR RIB — back, at CB" },
      { ...cuffD, caption: "CUFF RIB" },
      { ...wbD, caption: "WAISTBAND RIB" },
    ], ids, { tableW: 92 });
  }

  // ---------------------------------------------------------------- 09 colourway overlay (no geometry change)
  if (colourDemo) {
    const { fills, title } = colourDemo;
    emit("09-colourway-overlay-demo", title, [
      compose(fr, vbR(fr.viewBox), 125, 110, { fills, id: "cwf" }),
      compose(bk, vbR(bk.viewBox), 125, 110, { fills, id: "cwb" }),
    ]);
  }

  return sheets;
}
