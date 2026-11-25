// Front Letters — per-template generation: the A's slots, the style's B–Z bodies
// scaled and placed exactly like the template's A, the A's own colour / outline /
// texture treatment measured from its pixels and applied to them, test sheets.
/* global window, document */
"use strict";

(() => {
  const FL = window.FL;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // ---------------------------------------------------------------- masks / measures

  const alphaOf = (canvas) => {
    const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data, a = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    return a;
  };
  const threshold = (a, t = 128) => { const m = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) m[i] = a[i] >= t ? 1 : 0; return m; };

  const stats = (m, W, H) => {
    let x0 = W, y0 = H, x1 = -1, y1 = -1, sx = 0, sy = 0, n = 0;
    for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; sy += y; n++; }
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: sx / n, cy: sy / n, n };
  };

  /** Connected components (4-neighbour) of a mask → label array and sizes. */
  const components = (m, W, H) => {
    const lab = new Int32Array(W * H), sizes = [0];
    let n = 0;
    const st = new Int32Array(W * H);
    for (let i = 0; i < m.length; i++) {
      if (!m[i] || lab[i]) continue;
      n++; let sp = 0, size = 0; st[sp++] = i; lab[i] = n;
      while (sp) {
        const p = st[--sp]; size++;
        const x = p % W;
        if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = n; st[sp++] = p - 1; }
        if (x < W - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = n; st[sp++] = p + 1; }
        if (p >= W && m[p - W] && !lab[p - W]) { lab[p - W] = n; st[sp++] = p - W; }
        if (p < W * (H - 1) && m[p + W] && !lab[p + W]) { lab[p + W] = n; st[sp++] = p + W; }
      }
      sizes.push(size);
    }
    return { lab, sizes };
  };

  /** Interior holes of a mask (background parts not touching the border), largest first. */
  const holes = (m, W, H) => {
    const inv = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 1;
    const { lab, sizes } = components(inv, W, H), border = new Set();
    for (let x = 0; x < W; x++) { border.add(lab[x]); border.add(lab[(H - 1) * W + x]); }
    for (let y = 0; y < H; y++) { border.add(lab[y * W]); border.add(lab[y * W + W - 1]); }
    const ids = sizes.map((s, i) => [i, s]).filter(([i]) => i && !border.has(i)).sort((a, b) => b[1] - a[1]);
    return { lab, ids };
  };

  /** A mask on a canvas of size W×H shifted by (dx, dy) into another of size W2×H2. */
  const place = (m, W, H, dx, dy, W2, H2) => {
    const o = new Uint8Array(W2 * H2);
    for (let y = 0; y < H; y++) { const Y = y + dy; if (Y < 0 || Y >= H2) continue; for (let x = 0; x < W; x++) { const X = x + dx; if (X >= 0 && X < W2 && m[y * W + x]) o[Y * W2 + X] = 1; } }
    return o;
  };
  const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return u ? i / u : 0; };

  // ---------------------------------------------------------------- the A's treatment

  /**
   * The A's look as a function of depth inside its body (distance from its edge):
   * colour and opacity per half pixel of depth — its outlines, rings, bevels and fill.
   */
  const measureProfile = (crop, body, W, H) => {
    const d = crop.getContext("2d").getImageData(0, 0, W, H).data, dist = FL.edt(body, W, H, true);
    // Per depth: opacity = mean; colour = the median (by brightness) of the visible
    // pixels — a mean would blur thin rings into their neighbours.
    const BINS = 600, acc = Array.from({ length: BINS }, () => [0, 0]), samples = Array.from({ length: BINS }, () => []);
    for (let i = 0; i < body.length; i++) {
      if (!body[i]) continue;
      const b = Math.min(BINS - 1, Math.round(Math.sqrt(dist[i]) * 2)), a = d[i * 4 + 3] / 255;
      acc[b][0] += a; acc[b][1]++;
      const S = samples[b];
      if (a > 0.5 && (S.length < 600 || (i * 2654435761) % 7 === 0)) { if (S.length >= 600) S[(i >>> 3) % 600] = i; else S.push(i); }
    }
    const prof = [];
    let last = null;
    for (let b = 0; b < BINS; b++) {
      const [a, n] = acc[b], S = samples[b];
      if (n >= 8) {
        let rgb = last?.rgb ?? [0, 0, 0];
        if (S.length) {
          S.sort((p, q) => d[p * 4] + d[p * 4 + 1] + d[p * 4 + 2] - (d[q * 4] + d[q * 4 + 1] + d[q * 4 + 2]));
          const m = S[S.length >> 1];
          rgb = [d[m * 4], d[m * 4 + 1], d[m * 4 + 2]];
        }
        last = { rgb, a: a / n };
      }
      prof.push(last);
    }
    for (let b = 0; b < BINS && !prof[b]; b++) prof[b] = prof.find(Boolean);
    // Opacity is crisp in the artwork (rings end sharply); averaging blurs it, so
    // past the edge pixel each depth is either opaque or clear.
    for (let b = 2; b < BINS; b++) prof[b] = { rgb: prof[b].rgb, a: prof[b].a >= 0.5 ? 1 : 0 };
    let maxBin = 0; for (let b = 0; b < BINS; b++) if (acc[b][1] >= 8) maxBin = b;
    return { prof, maxBin };
  };

  /** A texture tile from the A's deepest area (its fill, away from outlines). */
  const measureTexture = (crop, body, W, H, minDepth, fill) => {
    // Pixels of the fill proper: deep inside the body and of the fill's colour
    // (no ring, no stray stitch marks); the tile is the largest square inside them.
    const depth = FL.edt(body, W, H, true), px = crop.getContext("2d").getImageData(0, 0, W, H).data, bad = new Uint8Array(W * H);
    for (let i = 0; i < bad.length; i++) {
      const lum = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3, fl = (fill[0] + fill[1] + fill[2]) / 3;
      bad[i] = Math.abs(lum - fl) >= 115 ? 1 : 0; // strong outliers only (the satin grain varies less)
    }
    const near = FL.dilate(bad, W, H, 8), F = new Uint8Array(W * H);
    for (let i = 0; i < F.length; i++) F[i] = body[i] && depth[i] >= minDepth * minDepth && !near[i] ? 1 : 0;
    const dist = FL.edt(F, W, H, true);
    let best = -1, bi = 0;
    for (let i = 0; i < dist.length; i++) if (dist[i] > best) { best = dist[i]; bi = i; }
    const R = Math.sqrt(best), side = Math.floor(R * 1.38);
    if (side < 40) return null;
    const cx = bi % W, cy = (bi / W) | 0, x0 = Math.round(cx - side / 2), y0 = Math.round(cy - side / 2);
    const data = crop.getContext("2d").getImageData(x0, y0, side, side).data;
    return { side, data, from: [x0, y0] };
  };

  /** Applies the A's profile (and texture) to a body (canvas of black alpha) → RGBA canvas. */
  /** Fills holes smaller than minArea (seams where strokes meet), in mask and alpha. */
  const fillSmallHoles = (m, a, W, H, minArea) => {
    const { lab, ids } = holes(m, W, H);
    const small = new Set(ids.filter(([, n]) => n < minArea).map(([i]) => i));
    if (!small.size) return;
    for (let i = 0; i < lab.length; i++) if (small.has(lab[i])) { m[i] = 1; a[i] = 255; }
  };

  const applyProfile = (bodyCanvas, look) => {
    const W = bodyCanvas.width, H = bodyCanvas.height, a = alphaOf(bodyCanvas), m = threshold(a);
    fillSmallHoles(m, a, W, H, look.minHole);
    const dist = FL.edt(m, W, H, true), out = FL.canvas(W, H), x = out.getContext("2d"), img = x.createImageData(W, H), o = img.data;
    const { prof, maxBin } = look.profile, tex = look.texture;
    for (let i = 0; i < a.length; i++) {
      if (!a[i]) continue;
      const depth = m[i] ? Math.sqrt(dist[i]) : 0, f = Math.min(maxBin, depth * 2), b0 = Math.floor(f), b1 = Math.min(maxBin, b0 + 1), k = f - b0;
      const p0 = prof[b0], p1 = prof[b1];
      let r = p0.rgb[0] * (1 - k) + p1.rgb[0] * k, g = p0.rgb[1] * (1 - k) + p1.rgb[1] * k, bl = p0.rgb[2] * (1 - k) + p1.rgb[2] * k;
      const al = (p0.a * (1 - k) + p1.a * k) * (a[i] / 255);
      if (tex && depth >= look.textureDepth) {
        const X = ((i % W) + look.texShift[0]) % tex.side, Y = (((i / W) | 0) + look.texShift[1]) % tex.side, t = (Y * tex.side + X) * 4;
        const blend = Math.min(1, (depth - look.textureDepth) / 3);
        r = r * (1 - blend) + tex.data[t] * blend; g = g * (1 - blend) + tex.data[t + 1] * blend; bl = bl * (1 - blend) + tex.data[t + 2] * blend;
      }
      o[i * 4] = r; o[i * 4 + 1] = g; o[i * 4 + 2] = bl; o[i * 4 + 3] = Math.round(al * 255);
    }
    x.putImageData(img, 0, 0);
    return out;
  };

  /** Western style: the A's offset outline shadow — fitted (shift, gap) from its pixels. */
  /**
   * The shadow model: the letter's outline (`lw` wide), shifted by (dx, dy), shown
   * only where it is more than `gap` away from the letter.
   */
  const shadowScore = (B, dIn, dOut, S, w, h, dx, dy, lw, gap) => {
    let i = 0, u = 0;
    const lw2 = lw * lw, g2 = gap * gap;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x, sx = x - dx, sy = y - dy;
      let p = 0;
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) { const q = sy * w + sx; p = B[q] && dIn[q] <= lw2 && dOut[k] > g2 ? 1 : 0; }
      if (p && S[k]) i++; if (p || S[k]) u++;
    }
    return u ? i / u : 0;
  };
  const fitShadow = (body, shadow, W, H) => {
    let best = { score: -1, dx: 0, dy: 0, lw: 1, gap: 1 };
    for (const s of [4, 2]) {
      const w = Math.ceil(W / s), h = Math.ceil(H / s), B = FL.down(body, W, H, s).m, S = FL.down(shadow, W, H, s).m;
      const dIn = FL.edt(B, w, h, true), dOut = FL.edt(B, w, h, false);
      const range = (v, lo, hi) => { const out = []; for (let k = lo; k <= hi; k++) out.push(k); return s === 4 ? out : out.filter((k) => Math.abs(k - v) <= 2); };
      const prev = { dx: best.dx / s, dy: best.dy / s, lw: best.lw / s, gap: best.gap / s };
      const span = s === 4 ? [0, 16, 1, 5] : [-40, 40, 1, 12];
      for (const dx of range(Math.round(prev.dx), span[0], span[1])) for (const dy of range(Math.round(prev.dy), span[0], span[1]))
        for (const lw of range(Math.round(prev.lw), span[2], span[3])) for (const gap of range(Math.round(prev.gap), span[2], span[3])) {
          const score = shadowScore(B, dIn, dOut, S, w, h, dx, dy, lw, gap);
          if (score > best.score) best = { score, dx: dx * s, dy: dy * s, lw: lw * s, gap: gap * s };
        }
      // Refined at 2× around the coarse winner.
      if (s === 4) best = { ...best, score: -1 };
    }
    return best;
  };
  const applyShadow = (bodyCanvas, look) => {
    const W = bodyCanvas.width, H = bodyCanvas.height, m = threshold(alphaOf(bodyCanvas)), dOut = FL.edt(m, W, H, false), dIn = FL.edt(m, W, H, true);
    const c = FL.canvas(W, H), x = c.getContext("2d"), img = x.createImageData(W, H), o = img.data, { dx, dy, gap, lw } = look.shadow, [r, g, b] = look.shadowRgb;
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
      const k = y * W + X, sx = X - dx, sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H || !m[sy * W + sx] || m[k]) continue;
      const q = sy * W + sx, inner = Math.sqrt(dIn[q]), d = Math.sqrt(dOut[k]);
      if (inner > lw + 0.5 || d <= gap - 0.5) continue;
      const a = Math.min(1, d - gap + 0.5, lw + 0.5 - inner);
      o[k * 4] = r; o[k * 4 + 1] = g; o[k * 4 + 2] = b; o[k * 4 + 3] = Math.round(255 * a);
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  // ---------------------------------------------------------------- bodies

  /** A letter's body, black on transparent, at `s` px per design unit; design (0,0) at (ox, oy). */
  const renderBody = (style, ch, s, condense = 1) => {
    const fam = FL.FAMILIES[style.family];
    const margin = fam.margin ?? 380, wDesign = fam.width(ch, style.P) + margin * 2;
    const W = Math.ceil(wDesign * s), H = Math.ceil((1000 + margin * 2) * s);
    const c = FL.canvas(W, H), x = c.getContext("2d");
    x.setTransform(s * condense, 0, 0, s, margin * s, margin * s);
    x.fillStyle = "#000";
    fam.draw(x, ch, style.P);
    return { canvas: c, ox: margin * s, oy: margin * s };
  };

  // ---------------------------------------------------------------- per template

  /**
   * Fits a style's parameters (those listed in style.fit, with their step sizes) so
   * its model A covers the template's A as closely as possible (IoU, half resolution).
   */
  const fitParams = (style, body, AW, AH, band) => {
    const half = FL.down(body, AW, AH, 2), w = half.w, h = half.h, target = half.m;
    if (band) for (let y = band.y0 >> 1; y <= band.y1 >> 1; y++) target.fill(0, y * w, y * w + w);
    const ts = stats(target, w, h), full = stats(body, AW, AH);
    const score = (P) => {
      const st = { ...style, P };
      let s = full.h / 2 / 1000, r, m, ms;
      for (let it = 0; it < 2; it++) {
        r = renderBody(st, "A", s);
        m = threshold(alphaOf(r.canvas)); ms = stats(m, r.canvas.width, r.canvas.height);
        if (it === 0) s *= full.h / 2 / ms.h;
      }
      const placed = place(m, r.canvas.width, r.canvas.height, Math.round(ts.cx - ms.cx), Math.round(full.y1 / 2 - ms.y1), w, h);
      if (band) for (let y = band.y0 >> 1; y <= band.y1 >> 1; y++) placed.fill(0, y * w, y * w + w);
      return iou(placed, target);
    };
    let P = { ...style.P }, best = score(P);
    const steps = { ...style.fit };
    for (let round = 0; round < 4; round++) {
      for (const k of Object.keys(steps)) {
        for (let tries = 0; tries < 4; tries++) {
          let moved = false;
          for (const sgn of [1, -1]) {
            const Q = { ...P, [k]: Math.max(k === "apexShift" ? -400 : 0, P[k] + sgn * steps[k]) };
            const v = score(Q);
            if (v > best + 1e-4) { best = v; P = Q; moved = true; break; }
          }
          if (!moved) break;
        }
      }
      for (const k of Object.keys(steps)) steps[k] /= 2;
    }
    return P;
  };

  window.RUN = async (input) => {
    let style = FL.TEMPLATE_STYLES[input.originalFileName];
    if (!style) throw new Error(`no style for ${input.originalFileName}`);
    const img = await FL.load(input.src);
    const found = FL.slots(img);
    const [S1, S2] = found.slots;
    const origin = [{ x: S1.box.x, y: S1.box.y }, { x: S1.box.x + found.shift[0], y: S1.box.y + found.shift[1] }];
    const A = S1.canvas, AW = A.width, AH = A.height;
    const aAlpha = alphaOf(A), aSolid = threshold(aAlpha);
    const files = {}, report = { style: style.id, shift: found.shift };
    const base = input.base, previewBase = `prototypes/front-letters/${input.designId}`;

    // --- the A's body (what the letter shapes are matched to) and its look.
    let body = aSolid, band = null;
    if (style.treatment === "ring") {
      const { lab, ids } = holes(aSolid, AW, AH);
      body = aSolid.slice();
      if (ids.length) for (let i = 0; i < lab.length; i++) if (lab[i] === ids[0][0]) body[i] = 1;
    }
    let shadowMask = null;
    if (style.treatment === "shadow") {
      const { lab, sizes } = components(aSolid, AW, AH);
      const big = sizes.indexOf(Math.max(...sizes.slice(1)));
      body = new Uint8Array(aSolid.length); shadowMask = new Uint8Array(aSolid.length);
      for (let i = 0; i < lab.length; i++) if (lab[i] === big) body[i] = 1; else if (aSolid[i]) shadowMask[i] = 1;
    }
    if (style.band) {
      // The name band: the empty rows above and below the name, and the rows between.
      const rows = [];
      for (let y = 0; y < AH; y++) { let n = 0; for (let x = 0; x < AW; x++) n += aSolid[y * AW + x]; rows.push(n); }
      const gaps = [];
      for (let y = 0; y < AH; y++) if (!rows[y]) { const g0 = y; while (y < AH && !rows[y]) y++; if (g0 > 0 && y < AH && y - g0 >= 3) gaps.push([g0, y - 1]); }
      report.gaps = gaps;
      if (gaps.length < 2) throw new Error("name band not found");
      band = { y0: gaps[0][0], y1: gaps[gaps.length - 1][1] };
      body = aSolid.slice();
      report.band = band;
    }

    // Holes smaller than this are seams, not counters (the A's own counter is far larger).
    const look = { profile: measureProfile(A, body, AW, AH), minHole: Math.round(AW * AH * 0.0015) };
    if (style.texture) {
      // Where the A's outline rings end: the last depth whose colour differs from its fill.
      const { prof, maxBin } = look.profile, deep = prof.slice(Math.round(maxBin * 0.6), maxBin + 1);
      const fill = [0, 1, 2].map((j) => deep.reduce((n, p) => n + p.rgb[j], 0) / deep.length);
      let ring = 0;
      // (Brightness, so the satin's own shading isn't mistaken for a ring.)
      const lum = (c) => (c[0] + c[1] + c[2]) / 3;
      for (let b = 0; b <= maxBin * 0.6; b++) if (Math.abs(lum(prof[b].rgb) - lum(fill)) > 60) ring = b / 2;
      look.textureDepth = ring + 4;
      look.texture = measureTexture(A, body, AW, AH, look.textureDepth + 6, fill);
      look.texShift = [0, 0];
      report.texture = { tile: look.texture?.side ?? null, ringDepthPx: ring, fill: fill.map(Math.round), maxDepthPx: maxBin / 2 };
    }
    if (style.treatment === "shadow") {
      look.shadow = fitShadow(body, shadowMask, AW, AH);
      const cs = FL.colours(A);
      look.shadowRgb = cs[0].rgb;
      report.shadow = { dx: look.shadow.dx, dy: look.shadow.dy, lw: look.shadow.lw, gap: look.shadow.gap, iou: Math.round(look.shadow.score * 1000) / 1000 };
    }
    if (style.treatment === "ring") {
      // Ring width: the depth where the profile turns transparent.
      const r = look.profile.prof.findIndex((p) => p && p.a < 0.5);
      report.ringPx = r / 2;
    }

    // --- the style's stroke parameters fitted to this A (coordinate descent on overlap).
    const fam = FL.FAMILIES[style.family];
    if (style.fit) {
      style = { ...style, P: fitParams(style, body, AW, AH, band) };
      report.fitted = Object.fromEntries(Object.keys(style.fit).map((k) => [k, Math.round(style.P[k] * 1000) / 1000]));
    }

    // --- scale and placement from a model A drawn in the style, matched to the A.
    const bodyStats = stats(body, AW, AH);
    let s = fam.fixedScale ?? 1, model = null, mStats = null;
    const bandMask = (m, W, rowOffset) => { if (!band) return m; const o = m.slice(); for (let y = band.y0; y <= band.y1; y++) { const Y = y + rowOffset; if (Y < 0) continue; o.fill(0, Y * W, Y * W + W); } return o; };
    if (!fam.fixedScale) {
      for (let it = 0; it < 3; it++) {
        model = renderBody(style, "A", s);
        mStats = stats(threshold(alphaOf(model.canvas)), model.canvas.width, model.canvas.height);
        s *= bodyStats.h / mStats.h;
      }
    }
    const aCx = bodyStats.cx;
    let ty;
    if (fam.fixedScale) ty = fam.slotY();
    else {
      model = renderBody(style, "A", s);
      const mMask = threshold(alphaOf(model.canvas));
      mStats = stats(mMask, model.canvas.width, model.canvas.height);
      // canvas → slot: y by the body's bottom (baseline), x by centre of mass.
      ty = bodyStats.y1 - mStats.y1;
      const tx = Math.round(aCx - mStats.cx);
      const placed = place(mMask, model.canvas.width, model.canvas.height, tx, Math.round(ty), AW, AH);
      report.modelA = { scale: Math.round(s * 10000) / 10000, iou: Math.round(iou(bandMask(placed, AW, 0), bandMask(body, AW, 0)) * 1000) / 1000 };
      // Debug overlay: original body red, model blue.
      if (input.debug) {
        const c = FL.canvas(AW, AH), x = c.getContext("2d"), im = x.createImageData(AW, AH);
        for (let i = 0; i < placed.length; i++) { im.data[i * 4] = body[i] ? 220 : 255; im.data[i * 4 + 1] = body[i] || placed[i] ? (body[i] && placed[i] ? 60 : 160) : 255; im.data[i * 4 + 2] = placed[i] ? 220 : 255; im.data[i * 4 + 3] = 255; if (body[i] && !placed[i]) { im.data[i * 4] = 230; im.data[i * 4 + 1] = 40; im.data[i * 4 + 2] = 40; } }
        x.putImageData(im, 0, 0);
        files[`debug/${input.originalFileName}-modelA.png`] = FL.png(c);
      }
    }

    // --- the glyphs.
    const glyphs = {};
    const meta = {};
    for (const ch of LETTERS) {
      if (ch === "A") continue;
      let b = renderBody(style, ch, s);
      let bm = threshold(alphaOf(b.canvas)), bs = stats(bm, b.canvas.width, b.canvas.height);
      // Kept inside the canvas in both slots: a letter that would run off the
      // artwork's edge is narrowed (never moved off its slot or shrunk in height).
      const pad = 2 + (look.shadow ? look.shadow.dx + 2 : 0);
      let room = Infinity;
      // (Pixel letters are never narrowed: they keep the A's grid and are never wider than it.)
      if (!fam.snap) for (const o of origin) {
        const cx = o.x + aCx;
        room = Math.min(room, (cx - pad) / (bs.cx - bs.x0), (img.W - pad - cx) / (bs.x1 - bs.cx));
      }
      if (room < 1) {
        b = renderBody(style, ch, s, room * 0.99);
        bm = threshold(alphaOf(b.canvas)); bs = stats(bm, b.canvas.width, b.canvas.height);
        (report.condensed ??= {})[ch] = Math.round(room * 0.99 * 1000) / 1000;
      }
      if (input.debug && ch === "M") files[`debug/${input.originalFileName}-M-body.png`] = FL.png(b.canvas);
      let art = style.treatment === "shadow" ? null : applyProfile(b.canvas, look);
      if (style.treatment === "shadow") {
        const shadow = applyShadow(b.canvas, look);
        art = applyProfile(b.canvas, look);
        const c = FL.canvas(art.width, art.height), x = c.getContext("2d");
        x.drawImage(shadow, 0, 0); x.drawImage(art, 0, 0);
        art = c;
      }
      // Position in the slot: same baseline as the A, centre of mass on the A's.
      let dx = fam.fixedScale ? fam.slotX(bs, aCx) : Math.round(aCx - bs.cx);
      const dy = Math.round(ty);
      if (fam.snap) {
        // Pixel letters sit on the A's grid: whole cells from its left edge, centred.
        const cellPx = style.P.cell * s * (b.condense ?? 1), k = Math.round((bodyStats.w - bs.w) / 2 / cellPx);
        dx = Math.round(bodyStats.x0 + k * cellPx - bs.x0);
      }
      // Name band: the rows the name occupies are left to the name.
      if (band) { const x = art.getContext("2d"); x.clearRect(0, band.y0 - dy, art.width, band.y1 - band.y0 + 1); }
      const crop = cropCanvas(art);
      if (!crop) throw new Error(`empty glyph ${ch}: ${JSON.stringify({ band, dy, bs, art: [art.width, art.height], s, P: style.P })}`);
      glyphs[ch] = { canvas: crop.canvas, dx: dx + crop.x, dy: dy + crop.y };
      files[`${base}/glyphs/${ch}.png`] = FL.png(crop.canvas);
      meta[ch] = { file: `glyphs/${ch}.png`, dx: dx + crop.x, dy: dy + crop.y, width: crop.canvas.width, height: crop.canvas.height };
    }

    // --- the A: the template's own pixels, per slot (unchanged).
    const aFiles = [S1, S2].map((sl, i) => {
      const f = `glyphs/A-${i + 1}.png`;
      files[`${base}/${f}`] = FL.png(sl.canvas);
      return { file: f, x: sl.box.x, y: sl.box.y, width: sl.box.w, height: sl.box.h };
    });
    files[`${base}/glyphs/A.png`] = FL.png(S1.canvas);
    meta.A = { file: "glyphs/A.png", dx: 0, dy: 0, width: AW, height: AH, original: true };
    glyphs.A = { canvas: S1.canvas, dx: 0, dy: 0 };

    // Name band overlays: each slot's own name (its rows of the original).
    const overlays = [null, null];
    if (band) {
      [S1, S2].forEach((sl, i) => {
        const c = FL.canvas(sl.box.w, band.y1 - band.y0 + 1);
        c.getContext("2d").drawImage(sl.canvas, 0, band.y0, sl.box.w, c.height, 0, 0, sl.box.w, c.height);
        const crop = cropCanvas(c);
        const f = `glyphs/band-${i + 1}.png`;
        files[`${base}/${f}`] = FL.png(crop.canvas);
        overlays[i] = { file: f, x: sl.box.x + crop.x, y: sl.box.y + band.y0 + crop.y, canvas: crop.canvas };
      });
    }

    // --- composition (the same rule the configurator and the server use).
    const slots2 = [S1, S2];
    const compose = (pair) => {
      const c = FL.canvas(img.W, img.H), x = c.getContext("2d");
      [...pair].forEach((ch, i) => {
        if (ch === "A") { x.drawImage(slots2[i].canvas, slots2[i].box.x, slots2[i].box.y); return; }
        const g = glyphs[ch];
        x.drawImage(g.canvas, origin[i].x + g.dx, origin[i].y + g.dy);
        if (overlays[i]) x.drawImage(overlays[i].canvas, overlays[i].x, overlays[i].y);
      });
      return c;
    };
    // AA check against the original.
    const aa = compose("AA").getContext("2d").getImageData(0, 0, img.W, img.H).data, o = img.data.data;
    let diff = 0; for (let i = 0; i < o.length; i++) if (aa[i] !== o[i]) diff++;
    report.aaDiff = diff;
    // Bounds of every glyph in both slots inside the canvas?
    let outside = 0;
    for (const ch of LETTERS) for (let i = 0; i < 2; i++) {
      const g = glyphs[ch], X = origin[i].x + g.dx, Y = origin[i].y + g.dy;
      outside = Math.max(outside, -X, -Y, X + g.canvas.width - img.W, Y + g.canvas.height - img.H);
    }
    // Largest overrun past the artwork's edge, px (the A itself touches the edge on some designs).
    report.maxOverrunPx = outside;

    // --- previews.
    const cell = 300, sheet = FL.canvas(cell * 6, cell * 5), sx = sheet.getContext("2d");
    sx.fillStyle = "#fff"; sx.fillRect(0, 0, sheet.width, sheet.height);
    const k = (cell * 0.78) / Math.max(AW, AH);
    [...LETTERS].forEach((ch, i) => {
      const g = glyphs[ch], cx = (i % 6) * cell + cell / 2, cy = Math.floor(i / 6) * cell + cell * 0.12;
      sx.drawImage(g.canvas, cx + (g.dx - aCx) * k, cy + g.dy * k, g.canvas.width * k, g.canvas.height * k);
      if (overlays[0] && ch !== "A") sx.drawImage(overlays[0].canvas, cx + (overlays[0].x - S1.box.x - aCx) * k, cy + (overlays[0].y - S1.box.y) * k, overlays[0].canvas.width * k, overlays[0].canvas.height * k);
    });
    files[`${previewBase}/sheet-A-Z.png`] = FL.png(sheet);
    for (const pair of ["AA", "AB", "MK", "SA", "ZH"]) {
      const c = compose(pair), t = FL.canvas(640, Math.round((640 * img.H) / img.W)), tx = t.getContext("2d");
      tx.fillStyle = "#fff"; tx.fillRect(0, 0, t.width, t.height); tx.drawImage(c, 0, 0, t.width, t.height);
      files[`${previewBase}/${pair}.png`] = FL.png(t);
    }

    const template = {
      version: 1,
      type: "front-letters",
      templateId: input.designId,
      libraryId: input.libraryId,
      originalFileName: input.originalFileName,
      asset: input.asset,
      style: { id: style.id, name: style.name, family: style.family, approximation: !!style.approximation, notes: style.notes ?? "" },
      canvas: { width: img.W, height: img.H },
      defaultLetters: "AA",
      characters: LETTERS,
      // Where each letter goes: slot origin = the original A's box (slot 2 = slot 1 + the template's shift).
      slots: origin.map((p, i) => ({ x: p.x, y: p.y, originalA: aFiles[i], overlay: overlays[i] ? { file: overlays[i].file, x: overlays[i].x, y: overlays[i].y } : null })),
      shift: found.shift,
      glyphs: meta,
      measured: { aBox: { width: AW, height: AH }, body: { x: bodyStats.x0, y: bodyStats.y0, width: bodyStats.w, height: bodyStats.h, centreX: Math.round(aCx * 10) / 10 }, ...report },
    };
    files[`${base}/template.json`] = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(template, null, 1))));
    return JSON.stringify({ files, report, index: { file: `${input.designId}/template.json`, style: style.id, name: style.name, approximation: !!style.approximation } });
  };

  function cropCanvas(c) {
    const W = c.width, H = c.height, d = c.getContext("2d").getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const o = FL.canvas(x1 - x0 + 1, y1 - y0 + 1);
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return { canvas: o, x: x0, y: y0 };
  }
})();
