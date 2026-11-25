// Dimension lines for the technical flat: extension lines, dimension line
// with arrowheads, and a compact POM label (code · name / value · status).
// All geometry in drawing units; text sizes in printed mm (k = mm per unit).
const f = (n) => (Math.round(n * 100) / 100).toString();

export const DIM_COLOUR = "#0b4f8a";
const PXMM = (mm) => (mm / 0.2646).toFixed(2);
const DIM = `stroke="${DIM_COLOUR}" stroke-width="${PXMM(0.16)}" vector-effect="non-scaling-stroke" fill="none"`;
const EXT = `stroke="${DIM_COLOUR}" stroke-width="${PXMM(0.1)}" vector-effect="non-scaling-stroke" fill="none"`;
const REF = `stroke="#7a7a7a" stroke-width="${PXMM(0.1)}" stroke-dasharray="${PXMM(1.6)} ${PXMM(0.8)}" vector-effect="non-scaling-stroke" fill="none"`;

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const P = ([x, y]) => `${f(x)},${f(-y)}`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Arrowhead marker (once per <svg>), `size` in drawing units. */
const markerDefs = (id, size) =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="${f(size)}" markerHeight="${f(size)}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="${DIM_COLOUR}"/></marker></defs>`;

const STATUS_STYLE = {
  PROV: { fill: "#5a2386", text: "PROVISIONAL" },
  REF: { fill: "#111", text: "REFERENCE" },
  SAMPLE: { fill: "#8a5a00", text: "SAMPLE" },
  PATTERN: { fill: "#8a5a00", text: "PATTERN MAKER" },
  DERIVED: { fill: "#8a5a00", text: "DERIVED" },
  // Development tech packs only (server/techpack): a development target of the approved development size chart.
  DEV: { fill: "#1d4f91", text: "DEV TARGET" },
};

/**
 * Dimension renderer for one drawing. `k` = printed mm per drawing unit;
 * `marker` = arrow marker id defined in the same <svg>.
 */
export function dimKit(k, marker = "a") {
  const u = (mm) => mm / k; // printed mm → drawing units
  const arrow = `marker-start="url(#${marker})" marker-end="url(#${marker})"`;
  const labels = [];

  /**
   * A POM label: two lines, boxed — a third when the POM has a provisional target range
   * (pom.target) — anchored at `at` (drawing units), `align` start|middle|end.
   */
  function label(at, pom, { align = "middle", leaderTo = null } = {}) {
    const fs = u(2.15), fs2 = u(1.95), pad = u(0.7);
    const l1 = `${pom.code}  ${pom.short}`;
    const st = STATUS_STYLE[pom.status] ?? STATUS_STYLE.SAMPLE;
    const l2 = `${pom.value}`;
    const l2b = st.text;
    const l3 = pom.target ? `target ${pom.target}` : "", l3b = STATUS_STYLE.PROV.text;
    const w = Math.max(l1.length * fs * 0.6, (l2.length + l2b.length + 2) * fs2 * 0.55, l3 ? (l3.length + l3b.length + 2) * fs2 * 0.55 : 0) + 2 * pad;
    const h = fs + fs2 + 3 * pad * 0.8 + (l3 ? fs2 + pad * 0.8 : 0);
    const x0 = align === "middle" ? at[0] - w / 2 : align === "end" ? at[0] - w : at[0];
    const y0 = at[1] + h / 2; // top (y up)
    const out = [];
    if (leaderTo) out.push(`<polyline points="${P(leaderTo)} ${P([align === "end" ? x0 + w : align === "start" ? x0 : at[0], at[1]])}" ${EXT}/>`);
    out.push(`<rect x="${f(x0)}" y="${f(-y0)}" width="${f(w)}" height="${f(h)}" fill="#fff" stroke="${DIM_COLOUR}" stroke-width="${PXMM(0.12)}" vector-effect="non-scaling-stroke" rx="${f(u(0.5))}"/>`);
    out.push(`<text x="${f(x0 + pad)}" y="${f(-(y0 - pad - fs * 0.82))}" font-size="${f(fs)}" fill="${DIM_COLOUR}" font-family="Arial, Helvetica, sans-serif"><tspan font-weight="bold">${esc(pom.code)}</tspan>  ${esc(pom.short)}</text>`);
    out.push(`<text x="${f(x0 + pad)}" y="${f(-(y0 - pad * 1.6 - fs - fs2 * 0.82))}" font-size="${f(fs2)}" font-family="Arial, Helvetica, sans-serif"><tspan fill="#111" font-weight="bold">${esc(l2)}</tspan>  <tspan fill="${st.fill}" font-size="${f(fs2 * 0.86)}" font-weight="bold">${esc(l2b)}</tspan></text>`);
    if (l3) out.push(`<text x="${f(x0 + pad)}" y="${f(-(y0 - pad * 2.4 - fs - fs2 - fs2 * 0.82))}" font-size="${f(fs2)}" font-family="Arial, Helvetica, sans-serif"><tspan fill="${STATUS_STYLE.PROV.fill}" font-weight="bold">${esc(l3)}</tspan>  <tspan fill="${STATUS_STYLE.PROV.fill}" font-size="${f(fs2 * 0.86)}" font-weight="bold">${esc(l3b)}</tspan></text>`);
    labels.push({ x0, y0, w, h, code: pom.code });
    return out.join("");
  }

  /**
   * Linear dimension a → b, offset `off` (perpendicular, + = left of a→b).
   * `labelAt` fraction along the line (or `labelPos` absolute) with optional leader.
   */
  function linear(a, b, pom, { off = 0, labelAt = 0.5, labelPos = null, align = "middle", labelNudge = [0, 0], extOver = 1.2, refs = [] } = {}) {
    const d = norm(sub(b, a)), n = [-d[1], d[0]];
    const A = add(a, mul(n, off)), B = add(b, mul(n, off));
    const out = [];
    for (const r of refs) out.push(`<polyline points="${r.map(P).join(" ")}" ${REF}/>`);
    if (Math.abs(off) > 0.01) {
      const s = Math.sign(off);
      out.push(`<polyline points="${P(add(a, mul(n, s * u(0.8))))} ${P(add(A, mul(n, s * u(extOver))))}" ${EXT}/>`);
      out.push(`<polyline points="${P(add(b, mul(n, s * u(0.8))))} ${P(add(B, mul(n, s * u(extOver))))}" ${EXT}/>`);
    }
    out.push(`<polyline points="${P(A)} ${P(B)}" ${DIM} ${arrow}/>`);
    const mid = lerp(A, B, labelAt);
    out.push(labelPos ? label(labelPos, pom, { align, leaderTo: mid }) : label(add(mid, labelNudge), pom, { align }));
    return out.join("");
  }

  /** A dimension along a path (e.g. CB → SP → cuff), arrows at both ends. */
  function path(pts, pom, { labelPos, align = "middle", leaderAt = 0.5 } = {}) {
    const out = [`<polyline points="${pts.map(P).join(" ")}" ${DIM} ${arrow}/>`];
    const i = Math.max(0, Math.min(pts.length - 2, Math.floor(leaderAt * (pts.length - 1))));
    const m = lerp(pts[i], pts[i + 1], 0.5);
    out.push(label(labelPos, pom, { align, leaderTo: m }));
    return out.join("");
  }

  /** An angle between a reference direction and a line, at `c`. */
  function angle(c, ref, to, r, pom, { labelPos, align = "start" } = {}) {
    const a0 = Math.atan2(ref[1], ref[0]), a1 = Math.atan2(to[1], to[0]);
    const p0 = add(c, [Math.cos(a0) * r, Math.sin(a0) * r]), p1 = add(c, [Math.cos(a1) * r, Math.sin(a1) * r]);
    const sweep = a1 > a0 ? 0 : 1;
    const out = [`<polyline points="${P(c)} ${P(add(c, mul(norm(ref), r * 1.35)))}" ${REF}/>`];
    out.push(`<path d="M ${P(p0)} A ${f(r)} ${f(r)} 0 0 ${sweep} ${P(p1)}" ${DIM}/>`);
    out.push(label(labelPos, pom, { align, leaderTo: lerp(p0, p1, 0.5) }));
    return out.join("");
  }

  /** A callout (no dimension): leader from a point to the label. */
  function callout(at, pom, { labelPos, align = "start" } = {}) {
    return `<circle cx="${f(at[0])}" cy="${f(-at[1])}" r="${f(u(0.55))}" fill="${DIM_COLOUR}"/>` + label(labelPos, pom, { align, leaderTo: at });
  }

  /** A highlighted path (e.g. a seam to be measured along), no arrows. */
  function along(pts, pom, { labelPos, align = "start", leaderAt = 0.5 } = {}) {
    const out = [`<polyline points="${pts.map(P).join(" ")}" stroke="${DIM_COLOUR}" stroke-width="${PXMM(0.35)}" stroke-dasharray="${PXMM(1.2)} ${PXMM(0.7)}" vector-effect="non-scaling-stroke" fill="none"/>`];
    const m = pts[Math.round(leaderAt * (pts.length - 1))];
    out.push(label(labelPos, pom, { align, leaderTo: m }));
    return out.join("");
  }

  return { linear, path, angle, callout, along, label, labels, u, defs: markerDefs(marker, u(1.9)) };
}

/** Label boxes that overlap each other (for QA). */
export function labelCollisions(labels) {
  const hits = [];
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      if (a.x0 < b.x0 + b.w && b.x0 < a.x0 + a.w && a.y0 - a.h < b.y0 && b.y0 - b.h < a.y0) hits.push(`${a.code}×${b.code}`);
    }
  return hits;
}
