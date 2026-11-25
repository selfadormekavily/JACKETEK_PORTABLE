import { useLayoutEffect, useState, type RefObject } from "react";

export type TextBox = { x: number; y: number; width: number; height: number };

/**
 * The box of an SVG <text> (font ascent to descent, so marks and dots
 * above and below the letters are always inside it), measured once its
 * font has loaded, and again whenever `deps` change. Null until measured.
 */
export function useSvgTextBox(text: RefObject<SVGTextElement | null>, deps: readonly unknown[]): TextBox | null {
  const [box, setBox] = useState<TextBox | null>(null);

  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      const el = text.current;
      if (!live || !el) return;
      try {
        const b = el.getBBox();
        if (b.width > 0) {
          setBox((prev) =>
            prev && prev.x === b.x && prev.y === b.y && prev.width === b.width && prev.height === b.height
              ? prev
              : { x: b.x, y: b.y, width: b.width, height: b.height }
          );
        }
      } catch {
        /* not rendered (display: none): measured on the next change */
      }
    };
    measure();
    const el = text.current;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (el && fonts) {
      const cs = getComputedStyle(el);
      // Ask for this text's own face (a display font may load only on use).
      fonts
        .load(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, el.textContent ?? undefined)
        .then(measure, measure);
      fonts.ready.then(measure, measure);
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return box;
}
