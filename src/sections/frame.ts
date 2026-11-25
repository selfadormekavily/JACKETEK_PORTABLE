import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

/**
 * The design was drawn on a 1440 × 900 artboard per section. On wide
 * screens the story's words and marks are laid out in that artboard's own
 * pixels, and the artboard is scaled to fit the viewport (centred), so the
 * composition stays identical at every size — backgrounds stay full-bleed.
 */
export const FRAME_W = 1440;
export const FRAME_H = 900;
/** Above this the composition stops growing (a 1680px content frame). */
const MAX_SCALE = 1680 / 1440;

export type FrameMetrics = { u: number; left: number; top: number };

export function frameMetrics(width: number, height: number): FrameMetrics {
  const u = Math.min(width / FRAME_W, height / FRAME_H, MAX_SCALE);
  return { u, left: (width - FRAME_W * u) / 2, top: (height - FRAME_H * u) / 2 };
}

/** The craft panel (03): the macro shot is shown only inside it. */
export const CRAFT_PANEL = { x: 700, y: 116, w: 684, h: 740 };

/**
 * Keeps the frame's scale and placement on `stage` as CSS variables
 * (--u, and the craft panel's insets for clipping) and in the returned
 * ref, for code that maps screen pixels into frame pixels.
 */
export function useDesignFrame(stage: RefObject<HTMLElement | null>) {
  const metrics = useRef<FrameMetrics>({ u: 1, left: 0, top: 0 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const m = frameMetrics(w, h);
      metrics.current = m;
      el.style.setProperty("--u", m.u.toFixed(5));
      el.style.setProperty("--frame-left", `${m.left}px`);
      el.style.setProperty("--frame-top", `${m.top}px`);
      const p = CRAFT_PANEL;
      el.style.setProperty("--clip-t", `${m.top + p.y * m.u}px`);
      el.style.setProperty("--clip-l", `${m.left + p.x * m.u}px`);
      el.style.setProperty("--clip-r", `${w - (m.left + (p.x + p.w) * m.u)}px`);
      el.style.setProperty("--clip-b", `${h - (m.top + (p.y + p.h) * m.u)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage]);
  return metrics;
}

/** Positions a child at the design's (x, y) inside a DesignFrame. */
export const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  ...extra,
});
