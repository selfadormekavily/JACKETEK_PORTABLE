import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * The homepage's entrance: the embroidered JACKETEK and the jackets are
 * stitched into the frame from right to left — the same serrated, row by
 * row front as the embroidery in 04 (three/embroidery/stitchReveal), at
 * an entrance's pace. The lettering leads; the jackets follow a beat
 * behind it, so the front crosses the right-hand jacket first.
 *
 * Each layer is masked by one wide image: clear on the left, solid on the
 * right, the stitched front between. Sliding it (mask-position, 0 → 1)
 * carries the front across the element; the mask is dropped once the
 * entrance is over.
 */

/** The front's depth, as a fraction of the element's width. */
const FRONT = 0.014;
/**
 * Rows of stitches down each layer: 36 on the lettering (as on the
 * embroidery), twice that on the full-height jackets — ~12px rows on both.
 */
const ROWS = { "--intro-w": 36, "--intro-j": 72 } as const;

const LETTERS_MS = 1250;
const JACKETS_LAG_MS = 150;
const JACKETS_MS = 1300;
/** If the jackets are slow to load, the lettering doesn't wait longer than this. */
const WAIT_MS = 3500;

function stitchedFront(rows: number) {
  const w = 100;
  const f = FRONT * w;
  const total = 2 * w + f;
  // Each row's edge slants across the front, like satin stitches laid in a row.
  let d = `M${total} 0V${rows}`;
  for (let i = rows - 1; i >= 0; i--) d += `L${w + f} ${i + 1}L${w} ${i}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${rows}" preserveAspectRatio="none"><path d="${d}Z"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const FRONT_IMAGES = {
  "--intro-w": stitchedFront(ROWS["--intro-w"]),
  "--intro-j": stitchedFront(ROWS["--intro-j"]),
};
const FRONT_SIZE = `${(2 + FRONT) * 100}% 100%`;

/** The mask for one layer, driven by a CSS variable (0 hidden → 1 whole). */
export function stitchMask(variable: keyof typeof ROWS): CSSProperties {
  const position = `calc(var(${variable}, 0) * 100%) 0`;
  const image = FRONT_IMAGES[variable];
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: FRONT_SIZE,
    WebkitMaskSize: FRONT_SIZE,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: position,
    WebkitMaskPosition: position,
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const progress = (now: number, start: number | null, ms: number) =>
  start === null ? 0 : easeInOut(Math.min(1, Math.max(0, (now - start) / ms)));

/**
 * Runs the entrance once, writing --intro-w (lettering) and --intro-j
 * (jackets) on `target`. The lettering starts with the jackets, once
 * they have loaded (call `onSceneReady`), or alone without a 3D scene.
 * `instant` (reduced motion) shows everything at once.
 */
export function useEntrance(target: RefObject<HTMLElement | null>, instant: boolean, scene: boolean) {
  const [done, setDone] = useState(false);
  const ready = useRef<() => void>(() => {});

  useEffect(() => {
    if (instant) return;
    let live = true;
    let frame = 0;
    let letters: number | null = null;
    let jackets: number | null = null;

    const tick = () => {
      const now = performance.now();
      const w = progress(now, letters, LETTERS_MS);
      const j = progress(now, jackets, JACKETS_MS);
      target.current?.style.setProperty("--intro-w", w.toFixed(4));
      target.current?.style.setProperty("--intro-j", j.toFixed(4));
      frame = 0;
      if (w === 1 && (j === 1 || !scene)) setDone(true);
      else if ((letters !== null && w < 1) || (jackets !== null && j < 1)) frame = requestAnimationFrame(tick);
    };
    const run = () => {
      if (live && !frame) frame = requestAnimationFrame(tick);
    };
    // Two frames on: past the first render's stall (shaders compiling), so
    // the front sets off smoothly.
    const settled = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(() => live && fn()));
    const startLetters = () => {
      letters ??= performance.now();
      run();
    };

    ready.current = () =>
      settled(() => {
        startLetters();
        jackets = Math.max(performance.now(), (letters ?? 0) + JACKETS_LAG_MS);
        run();
      });
    if (!scene) settled(startLetters);
    const wait = window.setTimeout(startLetters, WAIT_MS);

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(wait);
      ready.current = () => {};
    };
  }, [instant, scene, target]);

  const onSceneReady = useCallback(() => ready.current(), []);
  return { revealing: !instant && !done, onSceneReady };
}
