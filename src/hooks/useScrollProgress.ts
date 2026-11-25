import { useEffect, useRef } from "react";

/**
 * How quickly the eased value catches up with the real scroll, per
 * second. Time-based, so it settles equally fast on slow devices
 * (≈ 12% per frame at 60 fps).
 */
const SMOOTHING_PER_SECOND = 7.5;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Scroll progress (0 → 1) through a tall element, for pinned
 * scroll-driven sequences.
 *
 * Progress is 0 when the element's top reaches the viewport top and 1
 * when its bottom reaches the viewport bottom. The value is lightly
 * eased for a smooth, cinematic feel and written to the element as the
 * CSS custom property `--p`, so styles can animate without React
 * re-rendering every frame. `progress` exposes the same value to code
 * that needs it (e.g. a future Three.js camera in a render loop).
 */
export function useScrollProgress<T extends HTMLElement>(
  enabled = true,
  /** Called with each new (eased) value — keep it cheap. */
  onChange?: (value: number) => void,
  /** The value at the end of the track (the track maps onto 0 → end). */
  end = 1
) {
  const ref = useRef<T | null>(null);
  const progress = useRef(0);
  const listener = useRef(onChange);
  useEffect(() => {
    listener.current = onChange;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      return (travel > 0 ? clamp01(-rect.top / travel) : 0) * end;
    };

    const write = (value: number) => {
      progress.current = value;
      el.style.setProperty("--p", value.toFixed(4));
      listener.current?.(value);
    };

    let frame = 0;
    let lastTime = 0;
    let current = measure();
    write(current); // start at the real position, no easing on load

    const tick = (now: number) => {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.25) : 1 / 60;
      lastTime = now;
      const target = measure();
      current += (target - current) * (1 - Math.exp(-dt * SMOOTHING_PER_SECOND));
      if (Math.abs(target - current) < 0.0005) current = target;
      write(current);
      if (current === target) {
        frame = 0;
        lastTime = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--p");
    };
  }, [enabled, end]);

  return { ref, progress };
}
