// Colourway generator — page side (headless Edge): segments one design into its colour
// slots + keep-original, validates, self-tests the runtime recolouring (window.CW from
// src/features/configurator/library/colourwayRecolour.ts), and draws a proof sheet.
/* global window, document, Image */
"use strict";

window.BUILD = async (input) => {
  const { recolourPixels, labOf, lumaOf } = window.CW;
  const img = new Image();
  img.src = input.src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const src = cx.getImageData(0, 0, W, H).data;
  const LW = 0.45, T = input.threshold ?? 16; // chroma-weighted Lab distance limit to a slot's colours
  const slots = input.spec.slots;
  const protos = slots.map((s) => s.protos.map((h) => labOf(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))));
  const d2 = (p, q) => (LW * (p[0] - q[0])) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

  // 1. Each visible pixel: the nearest slot, if close enough to one of its colours.
  const lab = new Float32Array(N * 3), slot = new Uint8Array(N); // 0 = none / keep
  for (let i = 0; i < N; i++) {
    if (!src[i * 4 + 3]) continue;
    const p = labOf(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    lab[i * 3] = p[0]; lab[i * 3 + 1] = p[1]; lab[i * 3 + 2] = p[2];
    let bk = 0, bd = Infinity;
    protos.forEach((ps, k) => ps.forEach((q) => { const dd = d2(p, q); if (dd < bd) { bd = dd; bk = k + 1; } }));
    if (bd <= T * T) slot[i] = bk;
  }
  // 2. Region references (median of the region's core pixels).
  const nb = (i, r) => { const x = i % W, y = (i / W) | 0, out = {}; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const s = slot[Y * W + X]; if (s) out[s] = (out[s] || 0) + 1; } return out; };
  const refs = [null];
  for (let k = 1; k <= slots.length; k++) {
    const ys = [], ls = [[], [], []];
    for (let i = 0; i < N; i += 2) {
      if (slot[i] !== k || src[i * 4 + 3] < 250) continue;
      const n = nb(i, 2); if (Object.keys(n).length > 1) continue;
      ys.push(lumaOf(src[i * 4], src[i * 4 + 1], src[i * 4 + 2])); ls[0].push(lab[i * 3]); ls[1].push(lab[i * 3 + 1]); ls[2].push(lab[i * 3 + 2]);
    }
    if (!ys.length) throw new Error(`slot ${slots[k - 1].id} matched no pixels`);
    const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    refs.push({ y: med(ys), lab: ls.map(med) });
  }
  // 3. Boundaries: a pixel next to two slots (or between them, unmatched) is split between
  //    them by its position on the line between their colours — only if it lies close to
  //    that line (an antialiasing blend). Anything else stays as it is (keep original).
  const reg = new Uint8ClampedArray(N * 4);
  let blended = 0;
  for (let i = 0; i < N; i++) {
    if (!src[i * 4 + 3]) continue;
    const n = nb(i, 2), ks = Object.keys(n).map(Number).sort((a, b) => n[b] - n[a]);
    const s = slot[i];
    const p = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
    let k1 = s, k2 = 0, a = 1;
    const others = ks.filter((k) => k !== s);
    const pair = s ? (others.length ? [s, others[0]] : null) : ks.length >= 2 ? [ks[0], ks[1]] : ks.length === 1 ? [ks[0], 0] : null;
    if (pair && pair[1]) {
      const P1 = refs[pair[0]].lab, P2 = refs[pair[1]].lab;
      const v = [LW * (P1[0] - P2[0]), P1[1] - P2[1], P1[2] - P2[2]], w = [LW * (p[0] - P2[0]), p[1] - P2[1], p[2] - P2[2]];
      const vv = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
      const t = vv > 0 ? Math.max(0, Math.min(1, (v[0] * w[0] + v[1] * w[1] + v[2] * w[2]) / vv)) : 1;
      const res = Math.sqrt((w[0] - t * v[0]) ** 2 + (w[1] - t * v[1]) ** 2 + (w[2] - t * v[2]) ** 2);
      if (res <= T * 1.5 || s) {
        k1 = t >= 0.5 ? pair[0] : pair[1]; k2 = t >= 0.5 ? pair[1] : pair[0]; a = t >= 0.5 ? t : 1 - t;
        if (!s && res > T * 1.5) { k1 = 0; k2 = 0; }
        if (a < 0.999) blended++;
      }
    }
    reg[i * 4] = k1; reg[i * 4 + 1] = a < 0.999 ? k2 : 0; reg[i * 4 + 2] = Math.round(a * 255); reg[i * 4 + 3] = 255;
  }
  // 4. Validation: significant colours that belong to no slot (kept as they are, reported).
  const keep = new Uint8Array(N);
  let keepOpaque = 0, opaque = 0;
  for (let i = 0; i < N; i++) { if (src[i * 4 + 3] < 200) continue; opaque++; if (!reg[i * 4]) { keep[i] = 1; keepOpaque++; } }
  const comps = []; const seen = new Uint8Array(N), stack = [];
  for (let i = 0; i < N; i++) {
    if (!keep[i] || seen[i]) continue;
    let n = 0, r = 0, g = 0, b = 0; stack.push(i); seen[i] = 1;
    while (stack.length) { const p = stack.pop(); n++; r += src[p * 4]; g += src[p * 4 + 1]; b += src[p * 4 + 2]; const x = p % W; for (const q of [p - 1, p + 1, p - W, p + W]) if (q >= 0 && q < N && keep[q] && !seen[q] && Math.abs((q % W) - x) <= 1) { seen[q] = 1; stack.push(q); } }
    if (n >= 40) comps.push({ px: n, share: Math.round((n / opaque) * 10000) / 10000, colour: "#" + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("") });
  }
  comps.sort((a, b) => b.px - a.px);
  const keepShare = keepOpaque / opaque;
  const unmapped = comps.filter((c) => c.share >= 0.0005);
  // Reviewed details that are meant to stay as they are: [{ colour (approx), maxShare }].
  const acknowledged = input.spec.acknowledgedKeep ?? [];
  const near = (a, b) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16))) < 40;
  const ackShare = comps.filter((c) => acknowledged.some((k) => near(k.colour, c.colour))).reduce((s, c) => s + c.share, 0);
  const allowance = acknowledged.reduce((s, k) => s + k.maxShare, 0);
  const problems = [];
  for (const c of unmapped) if (!acknowledged.some((k) => near(k.colour, c.colour))) problems.push(c);
  // Many small unmapped pieces add up too: the total kept share must stay tiny (beyond what was acknowledged).
  if (keepShare - Math.min(ackShare, allowance) > 0.003) problems.push({ totalKeepShare: Math.round(keepShare * 10000) / 10000, acknowledged: Math.round(ackShare * 10000) / 10000, largest: comps.slice(0, 5) });

  // 5. Self-tests with the runtime recolouring.
  const TEST = ["#1B2A57", "#EFE3C2", "#2E9E4F"];
  const none = slots.map(() => null);
  const ident = recolourPixels(src, reg, refs, none);
  let identDiff = 0; for (let i = 0; i < src.length; i++) if (ident[i] !== src[i]) identDiff++;
  const leaks = [], shading = [];
  for (let k = 1; k <= slots.length; k++) {
    const t = none.slice(); t[k - 1] = TEST[k - 1];
    const out = recolourPixels(src, reg, refs, t);
    let outside = 0, alpha = 0, changed = 0;
    const xs = [], ys = [];
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (out[o + 3] !== src[o + 3]) alpha++;
      const diff = out[o] !== src[o] || out[o + 1] !== src[o + 1] || out[o + 2] !== src[o + 2];
      if (diff) changed++;
      const touches = reg[o] === k || reg[o + 1] === k;
      if (diff && !touches) outside++;
      if (reg[o] === k && !reg[o + 1] && src[o + 3] > 250 && i % 3 === 0) { xs.push(lumaOf(src[o], src[o + 1], src[o + 2])); ys.push(lumaOf(out[o], out[o + 1], out[o + 2])); }
    }
    const m = (v) => v.reduce((p, q) => p + q, 0) / v.length, mx = m(xs), my = m(ys);
    let sxy = 0, sxx = 0, syy = 0; for (let j = 0; j < xs.length; j++) { sxy += (xs[j] - mx) * (ys[j] - my); sxx += (xs[j] - mx) ** 2; syy += (ys[j] - my) ** 2; }
    leaks.push({ slot: slots[k - 1].id, changedPx: changed, changedOutsideSlot: outside, alphaChanged: alpha });
    shading.push({ slot: slots[k - 1].id, flat: sxx / xs.length < 1e-6, corr: sxx > 1e-9 && syy > 1e-9 ? Math.round((sxy / Math.sqrt(sxx * syy)) * 1000) / 1000 : null });
  }
  const all = recolourPixels(src, reg, refs, TEST.slice(0, slots.length));

  // 6. Files: region map + definition + proof sheet.
  const files = {};
  const toPng = (data) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); const d = x.createImageData(W, H); d.data.set(data); x.putImageData(d, 0, 0); return c; };
  // Region map: stored without alpha premultiplication issues (alpha 255 everywhere).
  files[`${input.base}/regions.png`] = toPng(reg).toDataURL("image/png");
  const hexOf = (labv) => { const [R, G, B] = window.CW.labToHexParts(labv); return "#" + [R, G, B].map((v) => v.toString(16).padStart(2, "0")).join(""); };
  const definition = {
    version: 1,
    type: "colourway",
    designId: input.designId,
    libraryId: input.libraryId,
    originalFileName: input.originalFileName,
    asset: input.asset,
    width: W,
    height: H,
    regionMap: "regions.png",
    keepOriginal: true,
    slots: slots.map((s, k) => ({ id: s.id, index: k + 1, label: s.label, role: s.role, defaultColor: hexOf(refs[k + 1].lab), method: "shading-preserving", ref: { y: Math.round(refs[k + 1].y * 1e6) / 1e6, lab: refs[k + 1].lab.map((v) => Math.round(v * 1000) / 1000) } })),
    validation: { keepOriginalShare: Math.round(keepShare * 10000) / 10000, keepComponents: comps.slice(0, 8), blendedPx: blended },
  };
  files[`${input.base}/colourway.json`] = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(definition, null, 1))));
  // Proof sheet: original | each slot alone | all | region map.
  const panels = [["ORIGINAL", src], ...slots.map((s, k) => { const t = none.slice(); t[k] = TEST[k]; return [`${s.label.toUpperCase()} ONLY → ${TEST[k]}`, recolourPixels(src, reg, refs, t)]; }), ["ALL CHANGED", all]];
  const mapPx = new Uint8ClampedArray(N * 4), PAL = [[128, 128, 128], [230, 25, 75], [60, 180, 75], [0, 130, 200]];
  for (let i = 0; i < N; i++) { if (!src[i * 4 + 3]) continue; const p = PAL[reg[i * 4]]; mapPx[i * 4] = p[0]; mapPx[i * 4 + 1] = p[1]; mapPx[i * 4 + 2] = p[2]; mapPx[i * 4 + 3] = reg[i * 4 + 1] ? 140 : 255; }
  panels.push(["REGIONS (grey = keep original)", mapPx]);
  const cell = 300, sheet = document.createElement("canvas"); sheet.width = cell * panels.length; sheet.height = cell + 60;
  const sx = sheet.getContext("2d"); sx.fillStyle = "#fff"; sx.fillRect(0, 0, sheet.width, sheet.height);
  sx.fillStyle = "#0F3B59"; sx.font = "bold 15px sans-serif"; sx.fillText(`${input.originalFileName} · ${input.designId.slice(0, 8)} · ${slots.map((s) => `${s.id}=${s.label}`).join(" · ")}`, 8, 18);
  panels.forEach(([label, data], j) => {
    for (let y = 26; y < 26 + cell; y += 12) for (let x = j * cell; x < (j + 1) * cell; x += 12) { sx.fillStyle = ((x / 12 + y / 12) | 0) % 2 ? "#e6e6e6" : "#fafafa"; sx.fillRect(x, y, 12, 12); }
    const c = toPng(data), k = Math.min((cell - 8) / W, (cell - 8) / H);
    sx.drawImage(c, j * cell + (cell - W * k) / 2, 26 + (cell - H * k) / 2, W * k, H * k);
    sx.fillStyle = "#0F3B59"; sx.font = "12px sans-serif"; sx.fillText(label, j * cell + 6, 26 + cell + 16);
  });
  files[`${input.preview}/proof.png`] = sheet.toDataURL("image/png");
  return JSON.stringify({ files, report: { slots: slots.length, refs: definition.slots.map((s) => `${s.id}:${s.defaultColor}`), keepOriginalShare: definition.validation.keepOriginalShare, unmapped: problems, identityChangedValues: identDiff, leaks, shading } });
};
