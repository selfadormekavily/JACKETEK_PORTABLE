// Front Letters — the constructed capitals for the serif / block families (western,
// stencil, Clarendon, collegiate, outlined and patch templates). No font: every
// letter is built from strokes (stems, diagonals, bars, bowls, serifs) whose sizes
// are the style's parameters, measured against that template's own A.
// Design space: cap height 1000, y down (cap line y = 0, baseline y = 1000).
/* global window */
"use strict";

(() => {
  const FL = window.FL;

  /** Polygon part. `thin` parts are the ones a stencil style separates from the rest. */
  const poly = (pts, thin = false) => ({ kind: "poly", pts, thin });
  const rect = (x0, y0, x1, y1, thin = false) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], thin);
  /** Rectangle with rounded corners (radius r). */
  const rrect = (x0, y0, x1, y1, r, thin = false) => {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    if (!r) return rect(x0, y0, x1, y1, thin);
    const pts = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (Math.PI / 2) * (i / 6); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    arc(x1 - r, y0 + r, -Math.PI / 2); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, Math.PI / 2); arc(x0 + r, y0 + r, Math.PI);
    return poly(pts, thin);
  };

  /** A straight stroke from a top centre to a bottom centre, `w` wide horizontally. */
  const stroke = (xt, yt, xb, yb, w, thin = false) => {
    const p = poly([[xt - w / 2, yt], [xt + w / 2, yt], [xb + w / 2, yb], [xb - w / 2, yb]], thin);
    p.span = (y) => { const k = (y - yt) / (yb - yt), c = xt + (xb - xt) * k; return [c - w / 2, c + w / 2]; };
    p.ends = { top: yt, bot: yb };
    return p;
  };

  /** Elliptical band between an outer ellipse and one inset by T (sides) and t (top/bottom), over angles a0→a1 (deg; 0 right, 90 down). */
  const ring = (cx, cy, rx, ry, T, t, a0 = 0, a1 = 360, thin = false) => {
    const pts = [], n = Math.max(24, Math.round(Math.abs(a1 - a0) / 3));
    for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    const inner = [];
    for (let i = n; i >= 0; i--) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; inner.push([cx + (rx - T) * Math.cos(a), cy + (ry - t) * Math.sin(a)]); }
    if (a1 - a0 >= 360) return { kind: "hole", outer: pts, inner, thin };
    return poly([...pts, ...inner], thin);
  };

  /** A bowl joined to a stem: flat on the left (x0), round on the right; T side, t top/bottom. */
  const bowl = (x0, y0, x1, y1, T, t, thin = false) => {
    const h = y1 - y0, rx = Math.min(x1 - x0, h * 0.62), cx = x1 - rx, cy = (y0 + y1) / 2, ry = h / 2;
    const half = (rX, rY, inset) => {
      const pts = [], n = 40;
      for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; pts.push([cx + rX * Math.cos(a), cy + rY * Math.sin(a)]); }
      return [[x0 + inset, cy - rY], ...pts, [x0 + inset, cy + rY]];
    };
    return { kind: "hole", outer: half(rx, ry, 0), inner: half(Math.max(4, rx - T), Math.max(4, ry - t), 0.01), thin, clipLeft: x0 };
  };

  /**
   * Serifs at a stroke end. `side` "bot" (baseline) or "top" (cap line); l / r: overhang
   * on the left / right (1 = full, 0 = none). Kinds: slab (square), bracket (slab with
   * concave fillets to the stroke), round (slab with round ends), flare (big fillets).
   */
  const serif = (P, s, side, l = 1, r = 1, thin = s.thin) => {
    if (P.serif === "none") return [];
    const y = side === "bot" ? s.ends.bot : s.ends.top, dir = side === "bot" ? -1 : 1;
    // The slab spans the stroke's end plus the overhang (a diagonal leaves it at an angle).
    const inner = y + dir * P.sh, [a, b] = s.span(inner), [a0, b0] = s.span(y);
    const L = a0 - P.sl * l, R = b0 + P.sl * r;
    const parts = [];
    const y0 = Math.min(y, inner), y1 = Math.max(y, inner);
    if (P.serif === "round") {
      const rr = P.sh / 2, pts = [];
      const cap = (cx, from) => { for (let i = 0; i <= 12; i++) { const ang = from + (Math.PI * i) / 12; pts.push([cx + rr * Math.cos(ang), (y0 + y1) / 2 + rr * Math.sin(ang)]); } };
      cap(R - rr, -Math.PI / 2); cap(L + rr, Math.PI / 2);
      parts.push(poly(pts, thin));
    } else parts.push(rrect(L, y0, R, y1, P.corner ?? 0, thin));
    const br = P.serif === "flare" ? P.br * 1.6 : P.serif === "bracket" || P.serif === "round" ? P.br : P.serif === "slab" ? P.brSlab ?? 0 : 0;
    if (br > 0) {
      // Concave fillets between the serif and the stroke's sides.
      const fillet = (x, sgn) => {
        if ((sgn < 0 && l === 0) || (sgn > 0 && r === 0)) return;
        const pts = [[x, inner], [x + sgn * br, inner]], n = 10;
        for (let i = 0; i <= n; i++) { const ang = (Math.PI / 2) * (i / n); pts.push([x + sgn * br - sgn * br * Math.sin(ang), inner + dir * br - dir * br * Math.cos(ang)]); }
        parts.push(poly(pts, thin));
      };
      fillet(a, -1); fillet(b, 1);
    }
    return parts;
  };

  /** A "beak": the vertical serif at the end of an arm (E, F, L, T, Z, C, S). */
  const beak = (P, x, y, side, len) => {
    if (P.serif === "none" || !P.beak) return [];
    const h = P.beak * len, w = P.beakW ?? P.t;
    return side === "down" ? [rect(x - w, y, x, y + h)] : [rect(x - w, y - h, x, y)];
  };

  /** The letters. Each returns its parts; w = width in design units. */
  const LETTERS = {
    A(P) {
      const w = 760 * P.wide, aw = P.apex, cx = w / 2 + (P.apexShift ?? 0);
      const L = stroke(cx - aw / 2 + P.t / 2, 0, P.t / 2, 1000, P.t, true);
      const R = stroke(cx + aw / 2 - P.T / 2, 0, w - P.T / 2, 1000, P.T);
      const yb = P.barY ?? 640, [, lx] = L.span(yb + P.bar / 2), [rx] = R.span(yb + P.bar / 2);
      const parts = [L, R, rect(lx - 5, yb, rx + 5, yb + P.bar), ...serif(P, L, "bot"), ...serif(P, R, "bot")];
      if (P.apexSerif || P.apexSerifR) parts.push(rrect(cx - aw / 2 - (P.apexSerif ?? 0), 0, cx + aw / 2 + (P.apexSerifR ?? 0), P.apexH ?? P.sh, P.corner ?? 0));
      return { w, parts };
    },
    B(P) {
      const w = 650 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T), m = 470;
      return { w, parts: [s, bowl(0, 0, w * 0.9, m + P.bar / 2, P.T * 0.92, P.bar, true), bowl(0, m - P.bar / 2, w, 1000, P.T, P.bar, true), ...serif(P, s, "top", 1, 0), ...serif(P, s, "bot", 1, 0)] };
    },
    C(P) {
      const w = 690 * P.wide, gh = 170;
      return { w, parts: [{ kind: "cut", part: ring(w / 2, 500, w / 2, 500, P.T, P.bar), cut: [[w * 0.62, 500 - gh], [w + 50, 500 - gh], [w + 50, 500 + gh], [w * 0.62, 500 + gh]] }, ...beak(P, w, 70, "down", 1.4), ...beak(P, w, 930, "up", 1.4)] };
    },
    D(P) {
      const w = 720 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T);
      return { w, parts: [s, bowl(0, 0, w, 1000, P.T, P.bar, true), ...serif(P, s, "top", 1, 0), ...serif(P, s, "bot", 1, 0)] };
    },
    E(P) {
      const w = 600 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T), b = P.bar * 1.08;
      return { w, parts: [s, rect(0, 0, w, b, true), rect(0, 500 - b / 2, w * 0.8, 500 + b / 2, true), rect(0, 1000 - b, w, 1000, true), ...serif(P, s, "top", 1, 0), ...serif(P, s, "bot", 1, 0), ...beak(P, w, b, "down", 1), ...beak(P, w * 0.8, 500 - b / 2, "up", 0.6), ...beak(P, w * 0.8, 500 + b / 2, "down", 0.6), ...beak(P, w, 1000 - b, "up", 1.1)] };
    },
    F(P) {
      const w = 580 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T), b = P.bar * 1.08;
      return { w, parts: [s, rect(0, 0, w, b, true), rect(0, 520 - b / 2, w * 0.78, 520 + b / 2, true), ...serif(P, s, "top", 1, 0), ...serif(P, s, "bot"), ...beak(P, w, b, "down", 1), ...beak(P, w * 0.78, 520 - b / 2, "up", 0.6), ...beak(P, w * 0.78, 520 + b / 2, "down", 0.6)] };
    },
    G(P) {
      const w = 730 * P.wide, gh = 120, sp = P.T * 0.92;
      return { w, parts: [{ kind: "cut", part: ring(w / 2, 500, w / 2, 500, P.T, P.bar), cut: [[w * 0.6, 500 - gh * 1.5], [w + 50, 500 - gh * 1.5], [w + 50, 545], [w * 0.6, 545]] }, rect(w - sp, 545, w, 930), rect(w * 0.52, 545, w, 545 + P.bar, true), ...beak(P, w, 70, "down", 1.4)] };
    },
    H(P) {
      const w = 760 * P.wide, a = stroke(P.T / 2, 0, P.T / 2, 1000, P.T), b = stroke(w - P.T / 2, 0, w - P.T / 2, 1000, P.T);
      return { w, parts: [a, b, rect(P.T - 5, 470, w - P.T + 5, 470 + P.bar, true), ...serif(P, a, "top"), ...serif(P, a, "bot"), ...serif(P, b, "top"), ...serif(P, b, "bot")] };
    },
    I(P) {
      const w = P.T, s = stroke(w / 2, 0, w / 2, 1000, P.T);
      return { w, parts: [s, ...serif(P, s, "top"), ...serif(P, s, "bot")] };
    },
    J(P) {
      const w = 520 * P.wide, s = stroke(w - P.T / 2, 0, w - P.T / 2, 700, P.T);
      return { w, parts: [s, ring(w / 2 + P.T * 0.0, 700, w / 2, 300, P.T, P.bar, 0, 150, true), ...serif(P, s, "top")] };
    },
    K(P) {
      const w = 740 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T);
      const up = stroke(w - P.t / 2 - 30, 0, P.T + P.t * 0.3, 620, P.t, true);
      const lo = stroke(P.T + w * 0.12, 400, w - P.T / 2, 1000, P.T);
      return { w, parts: [s, up, lo, ...serif(P, s, "top"), ...serif(P, s, "bot"), ...serif(P, up, "top"), ...serif(P, lo, "bot")] };
    },
    L(P) {
      const w = 590 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T), b = P.bar * 1.08;
      return { w, parts: [s, rect(0, 1000 - b, w, 1000, true), ...serif(P, s, "top"), ...serif(P, s, "bot", 1, 0), ...beak(P, w, 1000 - b, "up", 1.3)] };
    },
    M(P) {
      const w = 900 * P.wide, a = stroke(P.t / 2 + 10, 0, P.t / 2, 1000, P.t, true), d = stroke(w - P.T / 2, 0, w - P.T / 2, 1000, P.T);
      // The vertex stops above the baseline when the serifs are tall (block styles) — high enough
      // that the notch under it stays open above the foot serifs (at 1000 − sh × 0.6 the heavy
      // patch / collegiate styles closed it, and the M read as an "И").
      // (Name-band styles keep the low vertex: the band cuts the letter and the V's lower part
      // must show below it.)
      const vy = P.sh > 120 ? (P.band ? 1000 - P.sh * 0.6 : Math.min(1000 - P.sh * 0.6, 1000 - P.sh - 150)) : 1000;
      const l = stroke(P.T * 0.5 + 10, 0, w / 2, vy, P.T * 0.92), r = stroke(w - P.T * 0.7, 0, w / 2 - P.t * 0.1, vy, P.t, true);
      return { w, parts: [a, l, r, d, ...serif(P, a, "top", 1, 0), ...serif(P, a, "bot", 1, 0.35), ...serif(P, d, "top", 0, 1), ...serif(P, d, "bot", 0.35, 1)] };
    },
    N(P) {
      const w = 770 * P.wide, a = stroke(P.t / 2, 0, P.t / 2, 1000, P.t, true), b = stroke(w - P.t / 2, 0, w - P.t / 2, 1000, P.t, true);
      const d = stroke(P.T / 2, 0, w - P.T / 2, 1000, P.T);
      return { w, parts: [a, d, b, ...serif(P, a, "top", 1, 0), ...serif(P, a, "bot"), ...serif(P, b, "top")] };
    },
    O(P) {
      const w = 760 * P.wide;
      if (P.stencil) return { w, parts: [ring(w / 2, 500, w / 2, 500, P.T, P.bar, 90, 270), ring(w / 2, 500, w / 2, 500, P.T, P.bar, -90, 90, true)] };
      return { w, parts: [ring(w / 2, 500, w / 2, 500, P.T, P.bar)] };
    },
    P(P) {
      const w = 640 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T);
      return { w, parts: [s, bowl(0, 0, w, 570, P.T, P.bar, true), ...serif(P, s, "top", 1, 0), ...serif(P, s, "bot")] };
    },
    Q(P) {
      const w = 760 * P.wide, tail = stroke(w * 0.5, 740, w * 0.8, P.qTail ?? 1110, P.T * 0.8);
      const o = P.stencil ? [ring(w / 2, 500, w / 2, 500, P.T, P.bar, 90, 270), ring(w / 2, 500, w / 2, 500, P.T, P.bar, -90, 90, true)] : [ring(w / 2, 500, w / 2, 500, P.T, P.bar)];
      return { w, parts: [...o, tail] };
    },
    R(P) {
      const w = 700 * P.wide, s = stroke(P.T / 2, 0, P.T / 2, 1000, P.T);
      const leg = stroke(w * 0.42, 540, w - P.T / 2, 1000, P.T);
      return { w, parts: [s, bowl(0, 0, w * 0.93, 560, P.T, P.bar, true), leg, ...serif(P, s, "top", 1, 0), ...serif(P, s, "bot"), ...serif(P, leg, "bot", 0.5, 1)] };
    },
    S(P) {
      const w = 600 * P.wide, T = P.T * 0.95;
      return {
        w,
        parts: [
          ring(w * 0.5, 262, w * 0.46, 262, T, P.bar, 105, 335, true),
          ring(w * 0.5, 738, w * 0.5, 262, T, P.bar, -75, 160, true),
          stroke(w * 0.3, 330, w * 0.7, 670, T * 1.05),
          ...beak(P, w * 0.96, 75, "down", 1.2),
          ...beak(P, P.beakW ?? P.t, 925, "up", 1.2),
        ],
      };
    },
    T(P) {
      const w = 680 * P.wide, b = P.bar * 1.1, s = stroke(w / 2, 0, w / 2, 1000, P.T);
      return { w, parts: [rect(0, 0, w, b, true), s, ...serif(P, s, "bot"), ...beak(P, (P.beakW ?? P.t), b, "down", 1.2), ...beak(P, w, b, "down", 1.2)] };
    },
    U(P) {
      const w = 740 * P.wide, a = stroke(P.T / 2, 0, P.T / 2, 640, P.T), b = stroke(w - P.t / 2, 0, w - P.t / 2, 640, P.t, true);
      return { w, parts: [a, b, ring(w / 2, 640, w / 2, 360, P.T * 0.92, P.bar, 0, 180, true), ...serif(P, a, "top"), ...serif(P, b, "top")] };
    },
    V(P) {
      const w = 760 * P.wide, aw = P.apex, cx = w / 2;
      const l = stroke(P.T / 2, 0, cx + aw / 2 - P.T / 2, 1000, P.T), r = stroke(w - P.t / 2, 0, cx - aw / 2 + P.t / 2, 1000, P.t, true);
      return { w, parts: [l, r, ...serif(P, l, "top"), ...serif(P, r, "top")] };
    },
    W(P) {
      const w = 1040 * P.wide, aw = P.apex * 0.8, q = w / 4;
      const a = stroke(P.T / 2, 0, q + aw / 2 - P.T / 2, 1000, P.T), b = stroke(2 * q + P.t / 2 - 10, 60, q - aw / 2 + P.t / 2, 1000, P.t, true);
      const c = stroke(2 * q - P.T / 2 + 10, 60, 3 * q + aw / 2 - P.T / 2, 1000, P.T * 0.92), d = stroke(w - P.t / 2, 0, 3 * q - aw / 2 + P.t / 2, 1000, P.t, true);
      return { w, parts: [a, b, c, d, rect(2 * q - P.T / 2, 0, 2 * q + P.T / 2, 120), ...serif(P, a, "top"), ...serif(P, d, "top")] };
    },
    X(P) {
      const w = 740 * P.wide, a = stroke(P.T / 2, 0, w - P.T / 2, 1000, P.T), b = stroke(w - P.t / 2, 0, P.t / 2, 1000, P.t, true);
      return { w, parts: [a, b, ...serif(P, a, "top"), ...serif(P, a, "bot"), ...serif(P, b, "top"), ...serif(P, b, "bot")] };
    },
    Y(P) {
      const w = 740 * P.wide, j = 520, l = stroke(P.T / 2, 0, w / 2, j, P.T), r = stroke(w - P.t / 2, 0, w / 2 + P.T * 0.2, j + 30, P.t, true);
      const s = stroke(w / 2, j - 20, w / 2, 1000, P.T);
      return { w, parts: [l, r, s, ...serif(P, l, "top"), ...serif(P, r, "top"), ...serif(P, s, "bot")] };
    },
    Z(P) {
      const w = 640 * P.wide, b = P.bar * 1.08, d = stroke(w - P.T / 2, b - 5, P.T / 2, 1000 - b + 5, P.T);
      return { w, parts: [rect(0, 0, w, b, true), d, rect(0, 1000 - b, w, 1000, true), ...beak(P, P.beakW ?? P.t, b, "down", 1), ...beak(P, w, 1000 - b, "up", 1.1)] };
    },
  };

  /** Draws a letter's body (opaque black) into ctx, design units mapped by the ctx transform. */
  FL.drawRoman = (ctx, ch, P) => {
    const g = LETTERS[ch](P);
    const W = ctx.canvas.width, H = ctx.canvas.height, m = ctx.getTransform();
    // Thin parts and the rest on separate layers (a stencil style cuts a gap between them).
    const layers = [FL.canvas(W, H), FL.canvas(W, H)];
    const lx = layers.map((c) => { const x = c.getContext("2d"); x.setTransform(m); x.fillStyle = "#000"; return x; });
    const path = (pts) => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) p.lineTo(q[0], q[1]); p.closePath(); return p; };
    const draw = (part) => {
      const x = lx[part.thin && P.stencil ? 1 : 0];
      if (part.kind === "poly") x.fill(path(part.pts));
      else if (part.kind === "hole") {
        // The part alone on a scratch layer (its hole must not cut other parts).
        const c = FL.canvas(W, H), y = c.getContext("2d");
        y.setTransform(m); y.fill(path(part.outer)); y.globalCompositeOperation = "destination-out"; y.fill(path(part.inner));
        x.save(); x.resetTransform(); x.drawImage(c, 0, 0); x.restore();
      } else if (part.kind === "cut") {
        const c = FL.canvas(W, H), y = c.getContext("2d");
        y.setTransform(m);
        const inner = part.part;
        if (inner.kind === "hole") { y.fill(path(inner.outer)); y.globalCompositeOperation = "destination-out"; y.fill(path(inner.inner)); }
        else y.fill(path(inner.pts));
        y.globalCompositeOperation = "destination-out"; y.fill(path(part.cut));
        x.save(); x.resetTransform(); x.drawImage(c, 0, 0); x.restore();
      }
    };
    for (const part of g.parts) draw(part);
    if (P.stencil) {
      // Stencil: the thin layer minus the main layer grown by the gap.
      const gap = P.stencil * Math.hypot(m.a, m.b);
      lx[1].save(); lx[1].resetTransform(); lx[1].globalCompositeOperation = "destination-out";
      lx[1].filter = `blur(0px)`;
      for (const [dx, dy] of FL.disc(gap)) lx[1].drawImage(layers[0], dx, dy);
      lx[1].restore();
    }
    ctx.save(); ctx.resetTransform();
    ctx.drawImage(layers[0], 0, 0); ctx.drawImage(layers[1], 0, 0);
    ctx.restore();
    return g.w;
  };

  /** Offsets that sweep a disc of radius r (for growing a layer by drawing it shifted). */
  FL.disc = (r) => {
    const out = [], n = Math.max(8, Math.round(r * 1.5));
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; out.push([r * Math.cos(a), r * Math.sin(a)]); out.push([0.5 * r * Math.cos(a), 0.5 * r * Math.sin(a)]); }
    return out;
  };

  FL.romanWidth = (ch, P) => LETTERS[ch](P).w;
})();
