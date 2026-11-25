import { useRef, type CSSProperties, type PointerEvent } from "react";
import { useI18n } from "@/i18n/useI18n";
import { exitStyle } from "@/lib/scrollTimeline";
import { HERO_TIMELINE } from "@/three/heroLayout";

/**
 * The stitch badges around the jacket in the opening frame: the brand's
 * own patches and stickers (public/assets/stitch and stitch-2 — cut out
 * of their photos, transparent), behind the jacket and in front of the
 * studio.
 *
 * Art-directed, not scattered: each has a place in the open ground around
 * the jacket (never over it, the words or the controls), a size, a slight
 * turn and a DEPTH — far ones are smaller, a touch dimmer, with a tighter
 * shadow and a smaller drift, so the frame reads in layers. They breathe
 * with a very slow float, and react to the cursor in place: a lift, a
 * little scale and a tilt toward the pointer, like a real patch pressed
 * by a finger (a tap does the same on touch screens). They leave with the
 * rest of the opening frame as the story begins.
 */

type Depth = "near" | "mid" | "far";

type Badge = {
  id: string;
  src: string;
  /** Intrinsic size of the cut-out (px). */
  w: number;
  h: number;
  /** Turn at rest (deg). */
  rot: number;
  depth: Depth;
};

/**
 * Two collections, one system: `stitch` (public/assets/stitch; its
 * offline-mode.webp is cut out too, held back to keep the frame calm) and
 * `stitch 2` (public/assets/stitch-2; "It's finally over" is a print with
 * no die-cut border, so it is cut as a rounded card on its own paper).
 */
const BADGES = {
  // Primary — the strongest designs: larger, forward ("near").
  sixtySeven: { id: "sixty-seven", src: "/assets/stitch/sixty-seven.webp", w: 520, h: 518, rot: 8, depth: "near" },
  finallyOver: { id: "finally-over", src: "/assets/stitch-2/finally-over.webp", w: 520, h: 384, rot: -5, depth: "near" },
  aura: { id: "aura", src: "/assets/stitch/aura.webp", w: 520, h: 296, rot: -4, depth: "near" },
  // Secondary — support the frame ("mid").
  howToGraduate: { id: "how-to-graduate", src: "/assets/stitch-2/how-to-graduate.webp", w: 560, h: 178, rot: -3, depth: "mid" },
  stayPositive: { id: "stay-positive", src: "/assets/stitch/stay-positive.webp", w: 520, h: 281, rot: -8, depth: "mid" },
  warning: { id: "warning", src: "/assets/stitch-2/warning.webp", w: 516, h: 336, rot: 5, depth: "mid" },
  mamaSays: { id: "mama-says", src: "/assets/stitch/mama-says.webp", w: 520, h: 226, rot: 4, depth: "mid" },
  // Background — small, set back, for depth ("far").
  idkChatgpt: { id: "idk-chatgpt", src: "/assets/stitch-2/idk-chatgpt.webp", w: 505, h: 191, rot: 4, depth: "far" },
  error: { id: "error", src: "/assets/stitch-2/error.webp", w: 513, h: 407, rot: -6, depth: "far" },
  missionPassed: { id: "mission-passed", src: "/assets/stitch/mission-passed.webp", w: 560, h: 169, rot: -4, depth: "far" },
  thanksChatgpt: { id: "thanks-chatgpt", src: "/assets/stitch-2/thanks-chatgpt.webp", w: 520, h: 370, rot: -5, depth: "far" },
  escape: { id: "escape", src: "/assets/stitch/escape.webp", w: 505, h: 470, rot: 9, depth: "far" },
  camera: { id: "camera", src: "/assets/stitch/camera.webp", w: 480, h: 385, rot: -8, depth: "far" },
} satisfies Record<string, Badge>;

/** A badge's place: centre and width, in the frame's units. */
type Placement = { badge: Badge; x: number; y: number; width: number };

/**
 * Wide screens, in the 1440 × 900 design frame (the jacket stands at
 * x ≈ 750–1250, y ≈ 160–770; the words hold x 110–715, y 160–742).
 * One collection, framing the jacket in three tiers: the three primary
 * pieces anchor three sides (67 high right, "It's finally over" low
 * left of centre, Aura low right); secondary ones bridge between them;
 * small background ones fill the corners for depth. Gaps, heights and
 * distances from the jacket deliberately vary — no rows, no columns —
 * and the busy left (the words) carries fewer, quieter pieces than the
 * open right.
 */
const WIDE: Placement[] = [
  // Primary
  { badge: BADGES.sixtySeven, x: 1338, y: 244, width: 124 },
  { badge: BADGES.finallyOver, x: 572, y: 826, width: 116 },
  { badge: BADGES.aura, x: 1332, y: 772, width: 118 },
  // Secondary
  { badge: BADGES.howToGraduate, x: 318, y: 100, width: 128 },
  { badge: BADGES.stayPositive, x: 706, y: 130, width: 98 },
  { badge: BADGES.warning, x: 1176, y: 100, width: 88 },
  // Tucked just behind the sleeves (left, then right).
  { badge: BADGES.mamaSays, x: 716, y: 612, width: 86 },
  { badge: BADGES.missionPassed, x: 1302, y: 584, width: 92 },
  // Background
  { badge: BADGES.idkChatgpt, x: 868, y: 170, width: 66 },
  { badge: BADGES.error, x: 1356, y: 414, width: 62 },
  { badge: BADGES.thanksChatgpt, x: 340, y: 860, width: 58 },
  { badge: BADGES.escape, x: 68, y: 792, width: 52 },
  { badge: BADGES.camera, x: 762, y: 792, width: 58 },
];

/**
 * Phones and portrait tablets, in % of the stage (the jacket holds the
 * centre, ≈ 25–64 % down; the wordmark the top left; the colours and the
 * call to action the bottom): five, in the same tiers — the 67 beside
 * the wordmark and Aura on the right sleeve lead; the rest are smaller,
 * down the side margins by the sleeves (tucked just behind them), spaced
 * unevenly so they don't zigzag. Width in vmin, so they scale with the
 * jacket rather than the width.
 */
const COMPACT: Placement[] = [
  { badge: BADGES.sixtySeven, x: 85, y: 20.5, width: 16 },
  { badge: BADGES.aura, x: 91, y: 39, width: 15 },
  { badge: BADGES.warning, x: 92, y: 51.5, width: 11 },
  { badge: BADGES.error, x: 8, y: 29, width: 10 },
  { badge: BADGES.camera, x: 8.5, y: 53, width: 12 },
];

const DEPTH: Record<Depth, { drift: number; float: number; className: string }> = {
  near: { drift: 26, float: 3.5, className: "jk-badge-near" },
  mid: { drift: 18, float: 2.5, className: "jk-badge-mid" },
  far: { drift: 10, float: 1.8, className: "jk-badge-far" },
};

const [CHROME_START, CHROME_END] = HERO_TIMELINE.chromeExit;

export default function HeroBadges({
  compact = false,
  interactive,
  revealing,
}: {
  compact?: boolean;
  /** The opening frame is on screen (badges take the pointer only then). */
  interactive: boolean;
  /** The entrance is still stitching in: the badges wait for it. */
  revealing: boolean;
}) {
  const placements = compact ? COMPACT : WIDE;
  return (
    <div aria-hidden="true" className={`absolute inset-0 ${revealing ? "" : "jk-badges-on"}`}>
      {placements.map((p, i) => (
        <BadgeView key={p.badge.id} placement={p} index={i} compact={compact} interactive={interactive} />
      ))}
    </div>
  );
}

function BadgeView({
  placement: { badge, x, y, width },
  index,
  compact,
  interactive,
}: {
  placement: Placement;
  index: number;
  compact: boolean;
  interactive: boolean;
}) {
  const { isRtl } = useI18n();
  const body = useRef<HTMLDivElement>(null);
  const release = useRef<number | undefined>(undefined);
  const depth = DEPTH[badge.depth];

  /** Tilt toward the pointer, at most a few degrees. */
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = body.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    el.style.setProperty("--tilt-x", `${(-ny * 6).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(nx * 7).toFixed(2)}deg`);
  };
  const onLeave = () => {
    body.current?.style.setProperty("--tilt-x", "0deg");
    body.current?.style.setProperty("--tilt-y", "0deg");
  };
  /** Touch: a tap presses the badge for a moment (no hover on phones). */
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = body.current;
    if (!el || e.pointerType === "mouse") return;
    el.classList.add("jk-badge-pressed");
    window.clearTimeout(release.current);
    release.current = window.setTimeout(() => el.classList.remove("jk-badge-pressed"), 700);
  };

  // Phones, RTL: the wordmark moves to the right, so the badges' places
  // mirror around it (the badges themselves are artwork: never flipped).
  // Wide screens keep the composition in both directions.
  const anchor: CSSProperties = compact
    ? { left: `${isRtl ? 100 - x : x}%`, top: `${y}%`, width: `${width}vmin` }
    : { left: x, top: y, width };

  return (
    <div className="absolute" style={{ ...anchor, transform: "translate(-50%, -50%)" }}>
      {/* Leaves with the opening frame, the far ones drifting less. */}
      <div style={exitStyle(CHROME_START, CHROME_END, depth.drift)}>
        <div
          className={`jk-badge-float ${depth.className}`}
          style={{ "--float": `${depth.float}px`, animationDelay: `${-index * 1.7}s`, transitionDelay: `${180 + index * 70}ms` } as CSSProperties}
        >
          <div
            ref={body}
            className={`jk-badge ${interactive ? "pointer-events-auto" : ""}`}
            style={{ "--rot": `${badge.rot}deg` } as CSSProperties}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            onPointerDown={onDown}
          >
            <img
              src={badge.src}
              alt=""
              width={badge.w}
              height={badge.h}
              decoding="async"
              draggable={false}
              className="block h-auto w-full select-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
