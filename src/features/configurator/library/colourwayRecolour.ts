/**
 * COLOURWAY RECOLOURING — the one implementation, used by the configurator
 * (preview), the server (production artwork) and the generator's tests
 * (scripts/colourways/build.mjs). Pure: arrays in, array out; no DOM.
 *
 * Inputs: the design's ORIGINAL pixels (RGBA, never modified) and its region
 * map (generated offline: regions.png): per pixel the region it belongs to
 * (0 = keep original, 1–3 = colour slots), a second region on boundaries,
 * and the share of the first one there (antialiasing between two regions).
 *
 * Each changed slot takes its new thread colour with the original stitch
 * shading kept: per pixel, lightness moves from the region's reference
 * lightness by the multiplicative (linear-light) or the additive (L*) change
 * — whichever is smaller — so neither light→dark nor dark→light exaggerates
 * the texture. Alpha is never touched. Pixels of unchanged slots and of the
 * keep-original region are copied exactly.
 */

export type ColourwayRegionRef = {
  /** Reference linear luminance and Lab of the region (median of its core pixels). */
  y: number;
  lab: [number, number, number];
};

/** One slot's new colour (sRGB hex), or null = keep the original colour. */
export type SlotTargets = (string | null)[];

const s2l = (v: number) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const l2s = (v: number) => {
  v = Math.max(0, Math.min(1, v));
  return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
};
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
export const lumaOf = (r: number, g: number, b: number) => 0.2126 * s2l(r) + 0.7152 * s2l(g) + 0.0722 * s2l(b);
export const labOf = (r: number, g: number, b: number): [number, number, number] => {
  const R = s2l(r), G = s2l(g), B = s2l(b);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
const labToLinear = ([L, a, b]: [number, number, number]) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
};
/** Lab → sRGB 0–255. */
export const labToHexParts = (lab: [number, number, number]) => labToLinear(lab).map(l2s);
const hexLinear = (hex: string) => [1, 3, 5].map((i) => s2l(parseInt(hex.slice(i, i + 2), 16)));
const Lof = (y: number) => 116 * f(y) - 16;

/**
 * Recolours `src` (RGBA) into a new RGBA array. `regions` is the region map's
 * RGBA (R = region, G = second region, B = share of the first ×255).
 * `refs[k]` is region k's reference (index 0 unused: keep original).
 */
export function recolourPixels(src: Uint8ClampedArray, regions: Uint8ClampedArray, refs: (ColourwayRegionRef | null)[], targets: SlotTargets): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src); // exact copy; only recoloured pixels are rewritten
  const T = refs.map((_, k) => (k > 0 && targets[k - 1] ? hexLinear(targets[k - 1]!) : null));
  if (!T.some(Boolean)) return out;
  const own = refs.map((r) => (r ? labToLinear(r.lab) : null));
  const n = src.length / 4;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (src[o + 3] === 0) continue;
    const k1 = regions[o], k2 = regions[o + 1], a = k2 ? regions[o + 2] / 255 : 1;
    if (!k1 || !refs[k1]) continue; // keep original
    const t1 = T[k1], t2 = k2 ? T[k2] : null;
    // Nothing changes at this pixel: leave the original exactly.
    if (!t1 && (!t2 || a >= 1)) continue;
    const r1 = refs[k1]!, r2 = k2 && refs[k2] ? refs[k2]! : r1;
    const A = t1 ?? own[k1]!, B = k2 ? (t2 ?? own[k2] ?? A) : A;
    const Tm = [0, 1, 2].map((c) => a * A[c] + (1 - a) * B[c]);
    const Ty = 0.2126 * Tm[0] + 0.7152 * Tm[1] + 0.0722 * Tm[2];
    const tl = labOf(l2s(Tm[0]), l2s(Tm[1]), l2s(Tm[2]));
    const yRef = a * r1.y + (1 - a) * r2.y;
    const y = lumaOf(src[o], src[o + 1], src[o + 2]);
    const L = labOf(src[o], src[o + 1], src[o + 2])[0];
    // The stitch shading: multiplicative or additive lightness change, whichever is smaller.
    const dMul = Lof(Math.min(1.2, Ty * (y / Math.max(1e-5, yRef)))) - tl[0];
    const dAdd = L - Lof(yRef);
    let Ln = tl[0] + (Math.abs(dMul) < Math.abs(dAdd) ? dMul : dAdd);
    Ln = Ln > 92 ? 92 + 8 * Math.tanh((Ln - 92) / 8) : Math.max(0, Ln);
    const kc = tl[0] > 1 ? Math.max(0.55, Math.min(1.1, Ln / tl[0])) : 1;
    const rgb = labToLinear([Ln, tl[1] * kc, tl[2] * kc]);
    out[o] = l2s(rgb[0]);
    out[o + 1] = l2s(rgb[1]);
    out[o + 2] = l2s(rgb[2]);
  }
  return out;
}
