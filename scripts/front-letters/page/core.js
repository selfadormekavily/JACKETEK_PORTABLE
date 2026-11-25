// Front Letters glyph generator — shared page code (runs in headless Edge, canvas only).
// Reads a Front Letters design's original artwork and finds its two letter slots.
/* global window, document, Image */
"use strict";

const FL = (window.FL = {});

FL.load = async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  return { canvas: c, W: c.width, H: c.height, data: x.getImageData(0, 0, c.width, c.height) };
};

FL.canvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Alpha mask (Uint8 0/1) of pixels with alpha > t. */
FL.mask = (img, t = 0) => {
  const m = new Uint8Array(img.W * img.H), d = img.data.data;
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > t ? 1 : 0;
  return m;
};

/** Box downsample of a mask: a cell is set when any pixel in it is. */
FL.down = (m, W, H, s) => {
  const w = Math.ceil(W / s), h = Math.ceil(H / s), o = new Uint8Array(w * h);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) o[((y / s) | 0) * w + ((x / s) | 0)] = 1;
  return { m: o, w, h };
};

/** Square dilation by r (separable). */
FL.dilate = (m, W, H, r) => {
  if (r <= 0) return m.slice();
  const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let last = -1e9;
    for (let x = 0; x < W; x++) { if (m[y * W + x]) last = x; if (x - last <= r) t[y * W + x] = 1; }
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) { if (m[y * W + x]) last = x; if (last - x <= r) t[y * W + x] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let last = -1e9;
    for (let y = 0; y < H; y++) { if (t[y * W + x]) last = y; if (y - last <= r) o[y * W + x] = 1; }
    last = 1e9;
    for (let y = H - 1; y >= 0; y--) { if (t[y * W + x]) last = y; if (last - y <= r) o[y * W + x] = 1; }
  }
  return o;
};

/** Euclidean distance transform (squared distances) of a mask's set pixels to the nearest unset one (inside), or to the nearest set one (outside). */
FL.edt = (m, W, H, inside) => {
  // Felzenszwalb–Huttenlocher: exact squared Euclidean distance, two 1-D passes.
  const INF = 1e20, n = Math.max(W, H);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = (inside ? m[i] : !m[i]) ? INF : 0;
  const dt1 = (len) => {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; dt1(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; dt1(W); for (let x = 0; x < W; x++) g[y * W + x] = d[x]; }
  return g;
};

/**
 * The two letter slots. The design is two copies of one A, the second shifted by d.
 * d is found by matching the artwork with itself; each pixel then belongs to the
 * copy whose partner pixel (±d) exists. Returns the shift, and per slot the
 * original pixels (unchanged) and their box.
 */
FL.slots = (img) => {
  const { W, H } = img;
  const m = FL.mask(img, 0), solid = FL.mask(img, 128);
  // Matched on outlines (edges only line up at the true shift; solid areas of wide
  // letters also overlap at small shifts). Coarse on an 8× grid, then refined.
  const edges = (mm, w, h) => {
    const e = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (mm[i] && (!mm[i - 1] || !mm[i + 1] || !mm[i - w] || !mm[i + w])) e[i] = 1; }
    return e;
  };
  const s = 8, g = FL.down(solid, W, H, s), ge = FL.dilate(edges(g.m, g.w, g.h), g.w, g.h, 1), pts = [];
  const gEdge = edges(g.m, g.w, g.h);
  for (let i = 0; i < gEdge.length; i++) if (gEdge[i]) pts.push([i % g.w, (i / g.w) | 0]);
  let best = [0, 0], bestScore = -1;
  const minDx = Math.ceil(240 / s);
  for (let dx = minDx; dx < g.w; dx++) for (let dy = -g.h + 1; dy < g.h; dy++) {
    let n = 0;
    for (const [x, y] of pts) { const X = x + dx, Y = y + dy; if (X < g.w && Y >= 0 && Y < g.h && ge[Y * g.w + X]) n++; }
    if (n > bestScore) { bestScore = n; best = [dx * s, dy * s]; }
  }
  const fullEdge = FL.dilate(edges(solid, W, H), W, H, 1), sample = [];
  for (let i = 0; i < solid.length; i++) if (fullEdge[i] && i % 3 === 0) sample.push(i);
  const score = (dx, dy) => {
    if (dx < 240) return -1;
    let n = 0;
    for (const i of sample) { const x = (i % W) + dx, y = ((i / W) | 0) + dy; if (x >= 0 && x < W && y >= 0 && y < H && fullEdge[y * W + x]) n++; }
    return n;
  };
  for (const step of [8, 2, 1]) {
    let [bx, by] = best, bs = score(bx, by);
    for (let dx = -step * 4; dx <= step * 4; dx += step) for (let dy = -step * 4; dy <= step * 4; dy += step) {
      const v = score(best[0] + dx, best[1] + dy);
      if (v > bs) { bs = v; bx = best[0] + dx; by = best[1] + dy; }
    }
    best = [bx, by];
  }
  const [dx, dy] = best;
  const D = FL.dilate(m, W, H, 4);
  const at = (x, y) => x >= 0 && x < W && y >= 0 && y < H && D[y * W + x];
  const side = new Int8Array(W * H); // 1 left, 2 right
  let sx = [0, 0], sy = [0, 0], sn = [0, 0];
  const amb = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    const x = i % W, y = (i / W) | 0;
    const L = at(x + dx, y + dy), R = at(x - dx, y - dy);
    if (L && !R) side[i] = 1; else if (R && !L) side[i] = 2; else { amb.push(i); continue; }
    const k = side[i] - 1; sx[k] += x; sy[k] += y; sn[k]++;
  }
  const c = [0, 1].map((k) => [sx[k] / sn[k], sy[k] / sn[k]]);
  for (const i of amb) {
    const x = i % W, y = (i / W) | 0;
    side[i] = Math.hypot(x - c[0][0], y - c[0][1]) <= Math.hypot(x - c[1][0], y - c[1][1]) ? 1 : 2;
  }
  const slots = [1, 2].map((k) => {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < side.length; i++) if (side[i] === k) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    const cv = FL.canvas(box.w, box.h), cx = cv.getContext("2d"), out = cx.createImageData(box.w, box.h), src = img.data.data;
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
      const i = (y + y0) * W + x + x0;
      if (side[i] !== k) continue;
      const o = (y * box.w + x) * 4;
      for (let j = 0; j < 4; j++) out.data[o + j] = src[i * 4 + j];
    }
    cx.putImageData(out, 0, 0);
    return { box, canvas: cv };
  });
  return { shift: [dx, dy], ambiguous: amb.length, slots };
};

/** Colour clusters of the opaque pixels (k-means), most common first: [{rgb, share}]. */
FL.colours = (canvas, k = 3) => {
  const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data, px = [];
  for (let i = 0; i < d.length; i += 4 * 5) if (d[i + 3] > 250) px.push([d[i], d[i + 1], d[i + 2]]);
  let cs = [px[0], px[(px.length / 2) | 0], px[px.length - 1]].slice(0, k).map((p) => p.slice());
  for (let it = 0; it < 12; it++) {
    const acc = cs.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let bi = 0, bd = 1e9;
      cs.forEach((c, j) => { const dd = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } });
      acc[bi][0] += p[0]; acc[bi][1] += p[1]; acc[bi][2] += p[2]; acc[bi][3]++;
    }
    cs = acc.map((a, j) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cs[j]));
    cs.share = acc.map((a) => a[3] / px.length);
  }
  return cs.map((c, j) => ({ rgb: c.map(Math.round), share: Math.round(cs.share[j] * 1000) / 1000 })).sort((a, b) => b.share - a.share);
};

FL.png = (canvas) => canvas.toDataURL("image/png");
