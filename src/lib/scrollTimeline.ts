import type { CSSProperties } from "react";

/**
 * Helpers for scroll-driven sequences powered by the `--p` custom
 * property (see hooks/useScrollProgress). Each returns plain CSS, so
 * the browser does the animating — no per-frame React work.
 */

/**
 * CSS expression that goes 0 → 1 as `--p` moves from `start` to `end`
 * (clamped outside that range).
 */
export const seg = (start: number, end: number) =>
  `clamp(0, calc((var(--p, 0) - ${start}) / ${end - start}), 1)`;

/** Fade + rise into place between `start` and `end`. */
export const revealStyle = (
  start: number,
  end: number,
  distancePx = 32
): CSSProperties => {
  const t = seg(start, end);
  return {
    opacity: t,
    transform: `translate3d(0, calc((1 - ${t}) * ${distancePx}px), 0)`,
  };
};

/**
 * Eased version of `seg` (smoothstep), so reveals settle softly instead
 * of stopping dead.
 */
export const segEased = (start: number, end: number) => {
  const t = seg(start, end);
  return `(${t} * ${t} * (3 - 2 * ${t}))`;
};

/** Fade in while coming into focus (blur → sharp) and rising slightly. */
export const focusStyle = (
  start: number,
  end: number,
  { blurPx = 10, distancePx = 18 }: { blurPx?: number; distancePx?: number } = {}
): CSSProperties => {
  const t = segEased(start, end);
  return {
    opacity: `calc(${t})`,
    filter: `blur(calc((1 - ${t}) * ${blurPx}px))`,
    transform: `translate3d(0, calc((1 - ${t}) * ${distancePx}px), 0)`,
  };
};

/**
 * A line rising into view from behind a mask: apply to an inner element
 * inside an overflow-hidden line wrapper. Travels a little more than
 * its own height, so no sliver shows in the wrapper's bottom padding.
 */
export const maskLineStyle = (start: number, end: number): CSSProperties => {
  const t = segEased(start, end);
  return {
    transform: `translate3d(0, calc((1 - ${t}) * 135%), 0)`,
    filter: `blur(calc((1 - ${t}) * 6px))`,
  };
};

/** Letters drawing together as they appear (tracking-in). */
export const trackingStyle = (
  start: number,
  end: number,
  fromEm: number,
  toEm: number
): CSSProperties => {
  const t = segEased(start, end);
  return {
    opacity: `calc(${t})`,
    letterSpacing: `calc(${fromEm}em + (${toEm - fromEm}em * ${t}))`,
  };
};

/** A hairline drawing itself from the left. */
export const drawLineStyle = (start: number, end: number): CSSProperties => ({
  transform: `scaleX(calc(${segEased(start, end)}))`,
  transformOrigin: "left center",
});

/**
 * The design's reveal: fade in while rising 24px into place (eased; no
 * blur). Pair with `fadeOutStyle` on the container for the exit.
 */
export const riseStyle = (start: number, end: number, distancePx = 24): CSSProperties => {
  const t = segEased(start, end);
  return {
    opacity: `calc(${t})`,
    transform: `translate3d(0, calc((1 - ${t}) * ${distancePx}px), 0)`,
  };
};

/** Fade + drift away between `start` and `end`. */
export const exitStyle = (
  start: number,
  end: number,
  distancePx = 24
): CSSProperties => {
  const t = seg(start, end);
  return {
    opacity: `calc(1 - ${t})`,
    transform: `translate3d(0, calc(${t} * -${distancePx}px), 0)`,
  };
};
