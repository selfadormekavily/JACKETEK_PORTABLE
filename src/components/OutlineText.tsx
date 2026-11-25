import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useSvgTextBox } from "@/components/useSvgTextBox";

/**
 * Outlined display text as ONE merged contour. CSS -webkit-text-stroke
 * strokes every glyph part on its own, so in a joined script (Arabic, in
 * DARK) the overlaps inside each word show as stray lines. Here the word
 * is drawn solid, grown by the stroke width (feMorphology dilate) and the
 * solid shape taken away again: only the outer contour remains, a clean
 * hairline round the whole word.
 *
 * Sized from the font size of its parent (so CSS sizes such as clamp()
 * keep working), 1 SVG unit = 1 CSS pixel, so the line is `stroke` px at
 * any size. `maxWidth` (px) scales a long word down to fit. `colour` is
 * any CSS colour (CSS variables allowed: it is applied as a style).
 */
export default function OutlineText({
  text,
  colour,
  stroke = 1,
  maxWidth,
  className,
  style,
}: {
  text: string;
  colour: string;
  stroke?: number;
  maxWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const ref = useRef<SVGTextElement>(null);
  const fontPx = useParentFontSize(svg);
  const box = useSvgTextBox(ref, [text, fontPx]);
  const pad = stroke + 2;
  const b = box ?? { x: -text.length * 0.6 * fontPx, y: -1.1 * fontPx, width: text.length * 0.6 * fontPx, height: 1.6 * fontPx };
  const vw = b.width + 2 * pad;
  const vh = b.height + 2 * pad;
  const fit = maxWidth && vw > maxWidth ? maxWidth / vw : 1;

  return (
    <svg
      ref={svg}
      aria-hidden="true"
      className={className}
      viewBox={`${(b.x - pad).toFixed(1)} ${(b.y - pad).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`}
      width={vw * fit}
      height={vh * fit}
      style={{ overflow: "visible", visibility: box ? undefined : "hidden", ...style }}
    >
      <defs>
        <filter id={id} x="-2%" y="-5%" width="104%" height="110%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={stroke / fit} result="grown" />
          <feComposite in="grown" in2="SourceAlpha" operator="out" result="contour" />
          <feFlood style={{ floodColor: colour }} />
          <feComposite in2="contour" operator="in" />
        </filter>
      </defs>
      <text
        ref={ref}
        x={0}
        y={0}
        fill="#000"
        filter={`url(#${id})`}
        style={{ fontFamily: "var(--font-ar-display), var(--font-display)", fontWeight: 800, fontSize: fontPx }}
      >
        {text}
      </text>
    </svg>
  );
}

/** The computed font size of `el`'s parent (px), kept current on resize. */
function useParentFontSize(el: RefObject<Element | null>) {
  const [px, setPx] = useState(100);
  useEffect(() => {
    const read = () => {
      const parent = el.current?.parentElement;
      if (!parent) return;
      const v = parseFloat(getComputedStyle(parent).fontSize);
      if (v > 0) setPx((prev) => (Math.abs(prev - v) < 0.25 ? prev : v));
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [el]);
  return px;
}
