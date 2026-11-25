import { useId, useRef, type CSSProperties } from "react";
import { useSvgTextBox } from "@/components/useSvgTextBox";

/**
 * A word embroidered in live text: the counterpart, for scripts the
 * pre-rendered satin-stitch artwork doesn't cover (Arabic), of the
 * "Stitched" lettering image. One SVG <text> filled with dense satin
 * floss (each thread rounded: dark at its edges, lit along its crown),
 * the threads displaced so they wander and fray like real floss, their
 * tone varied, the letters lit from the top left, shaded at the edges and
 * lifted off the cloth by a shadow; a crimson running stitch follows the
 * outline.
 *
 * Drawn at a fixed internal size (UNITS) and scaled as a whole, so it
 * reads the same at every size, like the artwork. Nothing is masked or
 * clipped: the SVG holds the whole font box (dots, shadda and other marks
 * included) and draws past its layout box (overflow visible).
 *
 * Layout: `size` is the lettering's font size in em of the surrounding
 * text; it sits on the surrounding baseline and takes `ascent` above and
 * `descent` below it in the line (em of the lettering) — the font box's
 * generous metrics would otherwise open a gap above and below the line.
 * `dye` re-colours the silver thread (components/ThreadDyes), as on the
 * artwork.
 */

/** The SVG's internal font size (user units). */
const UNITS = 190;
/** Room around the font box for the thread's wander and the drop shadow. */
const PAD = 16;

export default function StitchedText({
  text,
  size = 1,
  ascent = 0.8,
  descent = 0.2,
  dye,
  className,
  style,
}: {
  text: string;
  /** Font size in em of the surrounding text. */
  size?: number;
  /** Line space taken above / below the baseline, in em of the lettering. */
  ascent?: number;
  descent?: number;
  dye?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGTextElement>(null);
  const box = useSvgTextBox(ref, [text]);
  // A first guess until measured (about 0.55em per letter, 1.6em tall).
  const b = box ?? { x: -text.length * 0.55 * UNITS, y: -1.1 * UNITS, width: text.length * 0.55 * UNITS, height: 1.6 * UNITS };
  const vx = b.x - PAD;
  const vy = b.y - PAD;
  const vw = b.width + 2 * PAD;
  const vh = b.height + 2 * PAD;
  const em = (units: number) => `${((units / UNITS) * size).toFixed(4)}em`;
  // The baseline is y = 0: the SVG reaches -vy above it and vy + vh below.
  const keepAbove = ascent * UNITS;
  const keepBelow = descent * UNITS;

  const satin = `${id}-satin`;
  const floss = `${id}-floss`;
  const thread = `${id}-thread`;
  const textProps = {
    x: 0,
    y: 0,
    // The text's own direction (Arabic: right to left from x = 0).
    textAnchor: "start" as const,
    style: { fontFamily: "var(--font-ar-display), var(--font-display)", fontWeight: 800, fontSize: UNITS } as CSSProperties,
  };

  return (
    <svg
      role="img"
      aria-label={text}
      className={className}
      viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`}
      style={{
        display: "inline-block",
        width: em(vw),
        height: em(vh),
        // The margin box spans [-keepAbove, keepBelow] around the baseline.
        marginTop: em(keepAbove + vy),
        marginBottom: em(keepBelow - (vy + vh)),
        verticalAlign: `-${em(keepBelow)}`,
        overflow: "visible",
        visibility: box ? undefined : "hidden",
        ...style,
      }}
    >
      <defs>
        {/* One thread: dark where it dips into its neighbours, lit along its crown. */}
        <linearGradient id={floss} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#2c2a26" />
          <stop offset="0.22" stopColor="#8a867d" />
          <stop offset="0.5" stopColor="#efebe3" />
          <stop offset="0.8" stopColor="#99958c" />
          <stop offset="1" stopColor="#36342f" />
        </linearGradient>
        {/* Satin: dense parallel floss laid on a slant. */}
        <pattern id={satin} width={4.6} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(-62)">
          <rect width={4.6} height={12} fill={`url(#${floss})`} />
        </pattern>
        <filter id={thread} x="-8%" y="-25%" width="116%" height="150%" colorInterpolationFilters="sRGB">
          {/* Long, thread-wise noise: wander (displacement) and tone. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.07" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={3.5} xChannelSelector="R" yChannelSelector="G" result="frayed" />
          <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="grain" />
          <feComposite in="frayed" in2="grain" operator="arithmetic" k1={0.75} k2={0.45} k3={0} k4={0} result="toned" />
          <feComposite in="toned" in2="frayed" operator="in" result="body" />
          {/* Relief: the letter's raised body, lit from the top left. */}
          <feGaussianBlur in="frayed" stdDeviation={2.6} result="relief" />
          <feDiffuseLighting in="relief" surfaceScale={4} diffuseConstant={1.15} lightingColor="#fff" result="shade">
            <feDistantLight azimuth={235} elevation={55} />
          </feDiffuseLighting>
          <feSpecularLighting in="relief" surfaceScale={5} specularConstant={0.55} specularExponent={14} lightingColor="#fff" result="sheen">
            <feDistantLight azimuth={235} elevation={45} />
          </feSpecularLighting>
          <feComposite in="body" in2="shade" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="shaded" />
          <feComposite in="sheen" in2="frayed" operator="in" result="sheenIn" />
          <feComposite in="shaded" in2="sheenIn" operator="arithmetic" k1={0} k2={1} k3={0.35} k4={0} result="lit" />
          <feComposite in="lit" in2="frayed" operator="in" result="litIn" />
          {/* Edges roll down into the cloth. */}
          <feMorphology in="frayed" operator="erode" radius={2.4} result="inner" />
          <feComposite in="frayed" in2="inner" operator="out" result="edge" />
          <feFlood floodColor="#000" floodOpacity={0.4} />
          <feComposite in2="edge" operator="in" result="edgeShade" />
          <feMerge result="stitched">
            <feMergeNode in="litIn" />
            <feMergeNode in="edgeShade" />
          </feMerge>
          <feDropShadow in="stitched" dx={0} dy={3.5} stdDeviation={2.6} floodColor="#000" floodOpacity={0.5} />
        </filter>
      </defs>
      <g style={dye ? { filter: dye } : undefined}>
        <text ref={ref} {...textProps} fill={`url(#${satin})`} filter={`url(#${thread})`}>
          {text}
        </text>
      </g>
      {/* The running stitch around the letters. */}
      <text
        {...textProps}
        aria-hidden="true"
        fill="none"
        strokeWidth={1.2}
        strokeDasharray="4 4"
        opacity={0.5}
        style={{ ...textProps.style, stroke: "rgb(var(--brand-crimson))" }}
      >
        {text}
      </text>
    </svg>
  );
}
