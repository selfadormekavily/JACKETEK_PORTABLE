import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { FrameMetrics } from "@/sections/frame";
import type { AnchorListener, AnchorPoint } from "@/three/scene/FidelioScene";
import { hasArrived, HERO_TIMELINE, type AnchorId, type Beat } from "@/three/heroLayout";

/**
 * The design's curved annotation arrows (design spec §6), attached to
 * the live 3D jacket. Each arrow keeps its reference curve (from
 * the-jacket-arrows.svg, 1440 × 900): every frame the whole curve is
 * rotated and scaled about its fixed start dot so that its target ring
 * lands on the projected point of the jacket's detail. Drawn on by
 * itself once its section has arrived, in turn with its callout
 * (stroke-dashoffset); the arrowhead and ring arrive over the last 15 %
 * of the draw; an arrow dims when its detail turns away, and leaves with
 * its section on scroll.
 */

type Pt = readonly [number, number];

type ArrowDef = {
  id: string;
  anchor: AnchorId;
  /** Reference path: the start point, then cubic segments (3 points each). */
  path: readonly Pt[];
  /** Reference target ring centre (lands on the anchor). */
  ring: Pt;
  ringRadius: number;
  colour: string;
  /**
   * A light halo under the stroke, so an ink arrow stays visible where
   * it crosses the black jacket (it vanishes into the light studio).
   */
  halo?: string;
  /** When its draw-on starts after its section arrives (with its callout's entrance, HeroStory). */
  delayMs: number;
  beat: Beat;
};

/** How long an arrow takes to draw on. */
const DRAW_MS = 700;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
// The world's headline colour (SVG attributes can't read CSS variables;
// style properties can).
const ON_DARK = "rgb(var(--t-head))";
const INK = "rgb(var(--t-head))";

const ARROWS: readonly ArrowDef[] = [
  {
    id: "wool-body",
    anchor: "body",
    path: [[390, 394], [452, 346], [528, 300], [598, 338]],
    ring: [607, 343],
    ringRadius: 11,
    colour: ON_DARK,
    delayMs: 360,
    beat: HERO_TIMELINE.jacket,
  },
  {
    id: "leather-sleeves",
    anchor: "sleeve",
    path: [[1108, 329], [1046, 292], [962, 318], [936, 394]],
    ring: [934, 405],
    ringRadius: 11,
    colour: ON_DARK,
    delayMs: 480,
    beat: HERO_TIMELINE.jacket,
  },
  {
    id: "custom-fit",
    anchor: "fit",
    path: [[390, 637], [456, 694], [546, 708], [600, 668]],
    ring: [609, 663],
    ringRadius: 11,
    colour: ON_DARK,
    delayMs: 600,
    beat: HERO_TIMELINE.jacket,
  },
  {
    // One small loop, then it glides in.
    id: "built-to-last",
    anchor: "snaps",
    path: [
      [1108, 491],
      [1050, 452], [968, 452], [972, 500],
      [976, 536], [1032, 526], [1018, 494],
      [1000, 452], [860, 438], [770, 466],
    ],
    ring: [759, 470],
    ringRadius: 11,
    colour: ON_DARK,
    delayMs: 720,
    beat: HERO_TIMELINE.jacket,
  },
  {
    // 04: from the macro chip to the back lettering ("SENIORS").
    id: "stitch-k",
    anchor: "backK",
    path: [[928, 206], [872, 182], [770, 226], [744, 326]],
    ring: [741, 338],
    ringRadius: 12,
    colour: INK,
    halo: "rgb(var(--bg-c0) / .7)",
    delayMs: 360,
    beat: HERO_TIMELINE.stitch,
  },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Per arrow: its group, and its strokes (halo first, when it has one). */
type ArrowNodes = {
  group: SVGGElement | null;
  paths: (SVGPathElement | null)[];
  rings: (SVGCircleElement | null)[];
  heads: (SVGPathElement | null)[];
};

export default function AnnotationArrows({
  listener,
  progress,
  frame,
}: {
  listener: MutableRefObject<AnchorListener | null>;
  progress: RefObject<number>;
  frame: RefObject<FrameMetrics>;
}) {
  const nodes = useRef<ArrowNodes[]>(ARROWS.map(() => ({ group: null, paths: [], rings: [], heads: [] })));
  // When each arrow's section arrived (ms), or -1 while it hasn't.
  const arrived = useRef<number[]>(ARROWS.map(() => -1));

  useEffect(() => {
    const update: AnchorListener = (points) => {
      const p = progress.current ?? 0;
      const now = performance.now();
      const { u, left, top } = frame.current ?? { u: 1, left: 0, top: 0 };
      ARROWS.forEach((def, i) => {
        const n = nodes.current[i];
        if (!n.group) return;
        const since = arrived.current;
        if (!hasArrived(def.beat, p)) since[i] = -1;
        else if (since[i] < 0) since[i] = now;
        const draw = since[i] < 0 ? 0 : easeOut(clamp01((now - since[i] - def.delayMs) / DRAW_MS));
        const [, , outStart, outEnd] = def.beat;
        const exit = outStart > 1 ? 0 : clamp01((p - outStart) / (outEnd - outStart));
        const point: AnchorPoint = points[def.anchor];
        const opacity = (1 - exit) * point.v;
        if (draw <= 0 || opacity <= 0.001) {
          n.group.style.visibility = "hidden";
          return;
        }
        n.group.style.visibility = "visible";
        n.group.style.opacity = opacity.toFixed(3);

        // The detail, in frame pixels.
        const tx = (point.x - left) / u;
        const ty = (point.y - top) / u;
        const [sx, sy] = def.path[0];
        const rx = def.ring[0] - sx;
        const ry = def.ring[1] - sy;
        const nx = tx - sx;
        const ny = ty - sy;
        // Rotate + scale the reference curve about its start dot.
        const k = Math.hypot(nx, ny) / Math.hypot(rx, ry);
        const angle = Math.atan2(ny, nx) - Math.atan2(ry, rx);
        const c = Math.cos(angle) * k;
        const s = Math.sin(angle) * k;
        const map = ([x, y]: Pt) => {
          const dx = x - sx;
          const dy = y - sy;
          return `${(sx + dx * c - dy * s).toFixed(1)} ${(sy + dx * s + dy * c).toFixed(1)}`;
        };
        let d = `M${map(def.path[0])}`;
        for (let j = 1; j < def.path.length; j += 3) {
          d += ` C${map(def.path[j])}, ${map(def.path[j + 1])}, ${map(def.path[j + 2])}`;
        }
        const late = clamp01((draw - 0.85) / 0.15).toFixed(3);
        n.paths.forEach((path) => {
          path?.setAttribute("d", d);
          if (path) path.style.strokeDashoffset = (1 - draw).toFixed(4);
        });
        n.rings.forEach((ring) => {
          ring?.setAttribute("cx", tx.toFixed(1));
          ring?.setAttribute("cy", ty.toFixed(1));
          if (ring) ring.style.opacity = late;
        });
        n.heads.forEach((head) => {
          if (head) head.style.opacity = late;
        });
      });
    };
    listener.current = update;
    return () => {
      if (listener.current === update) listener.current = null;
    };
  }, [listener, progress, frame]);

  return (
    <svg aria-hidden="true" className="absolute inset-0 overflow-visible" width={1440} height={900} viewBox="0 0 1440 900">
      <defs>
        {ARROWS.flatMap((def, i) =>
          strokesOf(def).map(({ key, colour, width }, j) => (
            <marker
              key={`${def.id}-${key}`}
              id={`jk-arrowhead-${def.id}-${key}`}
              viewBox="0 0 12 12"
              refX={10}
              refY={6}
              markerWidth={11}
              markerHeight={11}
              markerUnits="userSpaceOnUse"
              orient="auto"
              overflow="visible"
            >
              <path
                ref={(el) => {
                  nodes.current[i].heads[j] = el;
                }}
                d="M2.5 2 Q6 4.6 10 6 Q6 7.4 2.5 10"
                fill="none"
                strokeWidth={1.3 + (width - 1.15)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: colour, opacity: 0 }}
              />
            </marker>
          ))
        )}
      </defs>
      {ARROWS.map((def, i) => (
        <g
          key={def.id}
          ref={(el) => {
            nodes.current[i].group = el;
          }}
          style={{ visibility: "hidden" }}
        >
          {strokesOf(def).map(({ key, colour, width }, j) => (
            <g key={key}>
              <path
                ref={(el) => {
                  nodes.current[i].paths[j] = el;
                }}
                fill="none"
                style={{ stroke: colour }}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1 1"
                markerEnd={`url(#jk-arrowhead-${def.id}-${key})`}
              />
              <circle cx={def.path[0][0]} cy={def.path[0][1]} r={2 + (width - 1.15) / 2} style={{ fill: colour }} />
              <circle
                ref={(el) => {
                  nodes.current[i].rings[j] = el;
                }}
                r={def.ringRadius}
                fill="none"
                strokeOpacity={key === "halo" ? 0.6 : 0.28}
                strokeWidth={width - 0.15}
                style={{ stroke: colour, opacity: 0 }}
              />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** An arrow's strokes, back to front: its halo (if any), then the line. */
function strokesOf(def: ArrowDef) {
  const main = { key: "line", colour: def.colour, width: 1.15 };
  return def.halo ? [{ key: "halo", colour: def.halo, width: 3.4 }, main] : [main];
}
