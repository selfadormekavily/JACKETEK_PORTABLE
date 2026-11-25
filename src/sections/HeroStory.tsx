import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import OutlineText from "@/components/OutlineText";
import StitchedText from "@/components/StitchedText";
import { CREAM_THREAD } from "@/components/ThreadDyes";
import type { TKey } from "@/i18n/context";
import { pad2 } from "@/i18n/format";
import Ltr from "@/i18n/Ltr";
import { renderRich } from "@/i18n/richText";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";
import { seg, segEased } from "@/lib/scrollTimeline";
import { at, CRAFT_PANEL, FRAME_W } from "@/sections/frame";
import { HERO_TIMELINE, type AnchorId, type Beat, type StoryBeatId } from "@/three/heroLayout";

/**
 * The story told around the jacket as the homepage scrolls, in the
 * JACKETEK design (design spec §4–§5). Each beat is timed against the
 * camera's shots (three/heroLayout.ts). Scroll (`--p`) moves between
 * them — the jacket travels, the studio changes, a beat leaves — but
 * doesn't reveal the words: once the jacket arrives at a section
 * (`hasArrived`), its words play in on their own:
 *
 *   01 IDEA     headline right; jacket framed left; material chip
 *   02 JACKET   the dark studio; four callouts with curved arrows
 *   03 CRAFT    paper; words left, the macro shot in a panel right
 *   04 STITCH   its back; "Stitched" embroidered; a macro chip + arrow
 *   05 YOURS    "Made for [jacket] your moment." + call to action
 *
 * Wide screens lay the words out in the design's 1440 × 900 pixels (the
 * parent DesignFrame scales them). Within a beat nothing arrives at
 * once: eyebrow → line 1 → line 2 → body → link rise in, in turn
 * (~120ms apart, ~0.8s each); on the way out — with scroll — the whole
 * beat drifts up and fades.
 */

type HeroStoryProps = {
  /** Portrait screens: text in the lower half, no arrows. */
  compact?: boolean;
  /** The beat currently on screen (only it takes pointer input). */
  active: StoryBeatId | null;
  /** The beat whose section the jacket has arrived at (its words shown). */
  arrived: StoryBeatId | null;
  /** Scrolls the story to a point (in-page links). */
  goTo: (p: number) => void;
};

const T = HERO_TIMELINE;

/** Time between one element's entrance and the next. */
const STAGGER_MS = 120;
const ENTER_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * The entrance of the i-th element of a beat (eyebrow, line 1, line 2…):
 * fades in rising into place when its BeatFrame's `--in` turns 1 (the
 * section has arrived), in turn — a CSS transition, so it completes on
 * its own. Turning 0 (scrolled back before the arrival), it fades at once.
 */
const rise = (i: number, distancePx = 24): CSSProperties => {
  const delay = `calc(var(--in, 0) * ${i * STAGGER_MS}ms)`;
  return {
    opacity: "var(--in, 0)",
    transform: `translate3d(0, calc((1 - var(--in, 0)) * ${distancePx}px), 0)`,
    transition: `opacity 700ms ${ENTER_EASE} ${delay}, transform 900ms ${ENTER_EASE} ${delay}`,
  };
};

/** `--in` for a beat's container: 1 once its section has arrived. */
const inVar = (arrived: boolean) => ({ "--in": arrived ? 1 : 0 }) as CSSProperties;

/** Where "Discover the craft" / "View the craft" take you. */
const CRAFT_AT = 0.55;

/** The story's beats (for its "[ 0X / 05 ]" counters). */
const BEATS = 5;

/**
 * A headline size (design px) that languages can tune as a whole: Arabic
 * sets --jk-head-scale (styles/l10n-home.css), since DARK's taller
 * letters and line-height need a smaller size in the same boxes.
 */
const headSize = (px: number) => `calc(${px}px * var(--jk-head-scale, 1))`;

const MACRO = {
  wool: "/assets/macro/wool.webp",
  leather: "/assets/macro/leather.webp",
  snap: "/assets/macro/snap.webp",
  stitch: "/assets/macro/stitch.webp",
};

type StoryProps = Omit<HeroStoryProps, "compact">;

export default function HeroStory({ compact = false, active, arrived, goTo }: HeroStoryProps) {
  return compact ? (
    <CompactStory active={active} arrived={arrived} goTo={goTo} />
  ) : (
    <WideStory active={active} arrived={arrived} goTo={goTo} />
  );
}

// ---------------------------------------------------------------------------
// Behind the jackets (wide): the display words and the craft panel.

/**
 * Drawn under the 3D canvas, inside the DesignFrame: "DETAIL" outlined in
 * the dark studio (02), the craft panel (03), the embossed "MOMENT" (05).
 */
export function StoryBackdrop() {
  const { t, isRtl } = useI18n();
  return (
    <>
      {isRtl ? (
        // Arabic: one merged outline (text-stroke would draw DARK's
        // inner overlaps), centred on the English word's band.
        <div
          aria-hidden="true"
          className="jk-display jk-home-detail absolute inset-x-0 flex items-center justify-center"
          // DARK's font box runs high above its letters: the box is raised
          // so the word's ink sits on the English word's band (135–617).
          style={{ top: 90, height: 460, fontSize: 600, ...displayWordStyle(T.jacket) }}
        >
          <OutlineText text={t("story.backdrop.detail")} colour="rgb(var(--t-head))" maxWidth={1320} />
        </div>
      ) : (
        <p
          aria-hidden="true"
          className="jk-display absolute inset-x-0 text-center"
          style={{
            top: 150,
            fontSize: 560,
            color: "transparent",
            WebkitTextStroke: "1px rgb(var(--t-head))",
            ...displayWordStyle(T.jacket),
          }}
        >
          {t("story.backdrop.detail")}
        </p>
      )}
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          left: CRAFT_PANEL.x,
          top: CRAFT_PANEL.y,
          width: CRAFT_PANEL.w,
          height: CRAFT_PANEL.h,
          background: "rgb(var(--brand-navy))",
          opacity: "var(--jk-paper, 0)",
        }}
      />
      <p
        aria-hidden="true"
        className="jk-display jk-home-moment absolute flex items-center justify-center"
        style={{
          // Scaled so the whole word shows, centred on the artboard: Anton's
          // "MOMENT" is 3.25em wide — 380px ≈ 1235px, ~100px from each edge.
          left: 0,
          top: 155,
          width: 1440,
          height: 446,
          fontSize: 380,
          // Oxblood on the cream room: the one deep-red editorial moment, pressed in.
          color: "rgb(230 199 177)", // cream with 18% oxblood: a deep-red tint, pressed into the room
          textShadow: "0 1px 0 rgb(255 255 255 / .7), 0 -1px 0 rgb(var(--brand-oxblood) / .18), 0 34px 60px rgb(var(--brand-oxblood) / .16)",
          ...displayWordStyle(T.finale),
        }}
      >
        {t("story.backdrop.moment")}
      </p>
    </>
  );
}

/** Display words fade in (with a 2 % drift) through their beat, then out. */
function displayWordStyle(beat: Beat): CSSProperties {
  const t = segEased(beat[0], beat[1]);
  const out = beat[2] > 1 ? "0" : seg(beat[2], beat[3]);
  return {
    opacity: `calc(${t} * (1 - ${out}))`,
    transform: `translate3d(0, calc((1 - ${t}) * 18px), 0)`,
  };
}

// ---------------------------------------------------------------------------
// Wide screens (design pixels)

function WideStory({ active, arrived, goTo }: StoryProps) {
  const { t, isRtl, locale } = useI18n();
  // 05 splits its sentence across the (centred) jacket: the lead stands
  // on the reading-start side, the rest of the sentence, the copy and the
  // button on the other — in Arabic the two columns mirror (right: lead).
  const col = (x: number, width: number) => (isRtl ? FRAME_W - x - width : x);
  // 01's material chip lines up with the column's reading start.
  const ideaChip = isRtl ? { position: "absolute" as const, right: FRAME_W - 840 - 520, top: 700 } : at(840, 700);
  return (
    <>
      {/* 01 — THE IDEA */}
      <BeatFrame beat={T.idea} active={active === "idea"} arrived={arrived === "idea"}>
        <div style={at(840, 200, { width: 520 })}>
          <Eyebrow index="01" label={t("story.idea.eyebrow")} rule={70} />
          <Headline size={108} className="mt-[30px]" k="story.idea.headline" />
          <p className="jk-body mt-[34px] w-[440px]" style={rise(3)}>
            {renderRich(t("story.idea.body"), BODY_TAGS)}
          </p>
          <div className="mt-[26px]" style={rise(4)}>
            <ArrowLink onClick={() => goTo(CRAFT_AT)}>{t("story.idea.cta")}</ArrowLink>
          </div>
        </div>
        <div className="flex items-center gap-[22px]" style={{ ...ideaChip, ...rise(4) }}>
          <MacroChip src={MACRO.wool} size={86} shadow />
          <p className="jk-label text-jk-ink" style={{ fontSize: 10, lineHeight: 2 }}>
            {t("story.idea.spec.wool")}
            <br />
            {t("story.idea.spec.leather")}
            <br />
            {t("story.idea.spec.rib")}
            <br />
            {t("story.idea.spec.made")}
          </p>
        </div>
      </BeatFrame>

      {/* 02 — THE JACKET (dark studio). The callouts keep their places
          (their arrows start beside them); in Arabic they read RTL. */}
      <BeatFrame beat={T.jacket} active={active === "jacket"} arrived={arrived === "jacket"}>
        <div style={at(110, 130)}>
          <Eyebrow index="02" label={t("story.jacket.eyebrow")} rule={50} dark />
          <Headline size={80} className="mt-6" dark k="story.jacket.headline" />
        </div>
        <Callout step={3} side="left" top={372} index="01" title={t("story.jacket.callout.wool.title")} detail={t("story.jacket.callout.wool.detail")} />
        <Callout step={5} side="left" top={613} index="03" title={t("story.jacket.callout.fit.title")} detail={t("story.jacket.callout.fit.detail")} />
        <Callout
          step={4}
          side="right"
          top={296}
          index="02"
          title={t("story.jacket.callout.leather.title")}
          detail={t("story.jacket.callout.leather.detail")}
          macro={MACRO.leather}
        />
        <Callout
          step={6}
          side="right"
          top={458}
          index="04"
          title={t("story.jacket.callout.built.title")}
          detail={t("story.jacket.callout.built.detail")}
          macro={MACRO.snap}
        />
        <FooterRule left={t("story.jacket.footer")} counter={2} />
      </BeatFrame>

      {/* 03 — THE CRAFT (paper; the macro is the live 3D shot) */}
      <BeatFrame beat={T.craft} active={active === "craft"} arrived={arrived === "craft"}>
        <div style={at(110, 190, { width: 520 })}>
          <Eyebrow index="03" label={t("story.craft.eyebrow")} rule={50} />
          {/* 124px (128 in the mockup): Hanken's "Made to be" would just
              reach the craft panel, where ink on its dark fill vanishes. */}
          <Headline size={124} className="mt-[26px]" k="story.craft.headline" />
          <p className="jk-body mt-[34px] w-[430px]" style={rise(3)}>
            {t("story.craft.body")}
          </p>
          <SpecList
            className="mt-[34px] w-[430px]"
            rowClass="py-[14px] text-[15px]"
            items={[
              { id: "collar", label: t("story.craft.spec.collar") },
              { id: "snaps", label: t("story.craft.spec.snaps") },
              { id: "seams", label: t("story.craft.spec.seams") },
            ]}
          />
        </div>
        <PhotoTag anchor="collar" i={0}>
          {t("story.craft.tag.collar")}
        </PhotoTag>
        <PhotoTag anchor="placket" i={1}>
          {t("story.craft.tag.snap")}
        </PhotoTag>
        <PhotoTag anchor="sleeveNear" i={2}>
          {t("story.craft.tag.sleeve")}
        </PhotoTag>
        {/* The reveal moves the wrapper; the caption keeps its own
            right/bottom alignment inside the panel. */}
        <div style={rise(4)}>
          <p
            className="jk-label-xs whitespace-nowrap text-jk-dusty"
            style={{
              ...at(CRAFT_PANEL.x + CRAFT_PANEL.w - 20, CRAFT_PANEL.y + CRAFT_PANEL.h - 18),
              transform: "translate(-100%, -100%)",
            }}
          >
            {t("story.craft.figCaption")}
          </p>
        </div>
      </BeatFrame>

      {/* 04 — EMBROIDERY (its back) */}
      <BeatFrame beat={T.stitch} active={active === "stitch"} arrived={arrived === "stitch"}>
        <div style={rise(0)}>
          <p className="jk-label-xs text-jk-muted" style={at(20, 475, VERTICAL)}>
            {t("story.stitch.sideLabel")}
          </p>
        </div>
        {/* The chip stays beside its arrow's start in both directions. */}
        <div className="flex items-center gap-4 rtl:flex-row-reverse" style={{ ...at(936, 164), ...rise(2) }}>
          <MacroChip src={MACRO.stitch} size={84} shadow border="rgb(var(--t-head)/.2)" />
          <div>
            <p className="jk-label-xs text-jk-muted">{t("story.stitch.macro")}</p>
            <p className="jk-label text-jk-ink" style={{ fontSize: 11 }}>
              {t("story.stitch.raised")}
            </p>
            <p className="text-[13px] leading-[1.5] text-jk-muted">{t("story.stitch.threadByThread")}</p>
          </div>
        </div>
        {/* At 950 (1000 in the mockup): in Hanken Grotesk "not printed."
            runs ~455px at 96px, past the frame's edge from 1000. */}
        <div style={at(950, 320, { width: 400 })}>
          <Eyebrow index="04" label={t("story.stitch.eyebrow")} rule={50} />
          <h2 className="jk-headline mt-[26px] text-jk-ink" style={{ fontSize: headSize(96) }}>
            <MaskLine i={0}>
              {locale === "en" ? (
                <img
                  src="/assets/embroidery/stitched-silver@2x.webp"
                  alt={t("story.stitch.stitched")}
                  width={336.5}
                  height={84.5}
                  className="inline-block max-w-none"
                  style={{ width: 336.5, height: 84.5, marginLeft: -4, marginRight: -10, verticalAlign: -12, filter: CREAM_THREAD }}
                />
              ) : (
                <StitchedText text={t("story.stitch.stitched")} size={STITCHED_SIZE} dye={CREAM_THREAD} className="jk-stitched" />
              )}
              {t("story.stitch.afterStitched")}
            </MaskLine>
            <MaskLine i={1} className="text-jk-taupe">
              {t("story.stitch.notPrinted")}
            </MaskLine>
          </h2>
          <p className="jk-body mt-[30px] w-[380px]" style={rise(3)}>
            {t("story.stitch.body")}
          </p>
          <SpecList
            className="mt-[28px] w-[380px]"
            rowClass="py-[13px] text-[15px]"
            items={[
              { id: "name", label: t("story.stitch.spec.name") },
              { id: "year", label: t("story.stitch.spec.year") },
              { id: "crest", label: t("story.stitch.spec.crest") },
            ]}
          />
        </div>
        <p
          className="jk-label absolute text-jk-muted"
          style={{ right: 56, top: 850, padding: "2px 6px", background: "rgb(var(--bg-c0) / .75)", ...rise(4) }}
        >
          <Counter n={4} />
        </p>
      </BeatFrame>

      {/* 05 — YOURS */}
      <BeatFrame beat={T.finale} active={active === "finale"} arrived={arrived === "finale"}>
        <div style={at(col(110, 380), 300, { width: 380 })}>
          <Eyebrow index="05" label={t("story.finale.eyebrow")} rule={50} />
          <h2 className="jk-headline mt-[26px] text-jk-ink" style={{ fontSize: headSize(112) }}>
            <MaskLine i={0}>{t("story.finale.lead")}</MaskLine>
          </h2>
        </div>
        <div style={at(col(1000, 380), 300, { width: 380 })}>
          <Headline size={112} k="story.finale.rest" />
          <p className="jk-body mb-[26px] mt-7" style={rise(3)}>
            {t("story.finale.body")}
          </p>
          <div style={rise(4)}>
            <Link to={ROUTES.design} className="jk-btn-primary w-[320px]">
              {t("story.finale.cta")}
              <ArrowRight />
            </Link>
            <div className="mt-[18px]">
              <button type="button" onClick={() => goTo(CRAFT_AT)} className="jk-label jk-link text-jk-ink">
                {t("story.finale.viewCraft")}
              </button>
            </div>
          </div>
        </div>
        <div
          className="jk-label absolute flex items-center justify-between pt-[14px] text-jk-muted"
          style={{ left: 56, top: 836, width: 1328, borderTop: "1px dashed rgb(var(--t-rule))", ...rise(4) }}
        >
          <span>{t("story.finale.footer")}</span>
          {/* Size codes (Latin): in Arabic the row runs from the right, XS first. */}
          <span aria-hidden="true" className="flex gap-[22px]">
            {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
              <span key={s} className={s === "M" ? "text-jk-accent" : "text-jk-muted"}>
                <Ltr>{s === "M" ? "[ M ]" : s}</Ltr>
              </span>
            ))}
          </span>
          <Counter n={5} />
        </div>
      </BeatFrame>
    </>
  );
}

/** "[ 04 / 05 ]": Western digits, read left to right in both languages. */
function Counter({ n }: { n: number }) {
  const { t } = useI18n();
  return <Ltr>{t("story.counter", { n: pad2(n), total: pad2(BEATS) })}</Ltr>;
}

/** The embroidered word's lettering size, in em of its headline. */
const STITCHED_SIZE = 1.9;

/** Rich-text tags of the story's body copy. */
const BODY_TAGS = {
  em: (c: ReactNode) => <span className="text-jk-taupe">{c}</span>,
};

const VERTICAL: CSSProperties = { transform: "translate(-50%, -50%) rotate(-90deg)", whiteSpace: "nowrap" };

/**
 * A callout in the dark studio (design §4.2). Left ones are right-aligned
 * and end 10px before the arrow's start dot; right ones carry a material
 * macro and start 12px after it. The arrow itself is AnnotationArrows.
 */
function Callout({
  step,
  side,
  top,
  index,
  title,
  detail,
  macro,
}: {
  /** Its place in the beat's entrance (its arrow draws with it). */
  step: number;
  side: "left" | "right";
  top: number;
  index: string;
  title: string;
  detail: string;
  macro?: string;
}) {
  const style = rise(step, 12);
  // Left callouts end at their arrow (right-aligned in both languages);
  // right ones keep the macro chip beside their arrow, the text after it.
  const text = (
    <div>
      <p className="jk-label-xs text-jk-numeral">{index}</p>
      <p className="jk-label mt-[6px] text-jk-on-dark" style={{ fontSize: 12 }}>
        {title}
      </p>
      <p className="mt-[6px] text-[14px] leading-[1.5] text-jk-muted-dark">{detail}</p>
    </div>
  );
  if (side === "left") {
    return (
      <div className="text-right" style={{ ...at(110, top, { width: 270 }), ...style }}>
        {text}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-4 rtl:flex-row-reverse" style={{ ...at(1120, top, { width: 250 }), ...style }}>
      {macro && <MacroChip src={macro} size={58} border="rgb(var(--t-head)/.3)" />}
      {text}
    </div>
  );
}

/**
 * A tag on the craft panel, pinned to a part of the live macro shot (the
 * 3D scene publishes where each part is on screen — canvas pixels, so the
 * frame's offset and scale are undone here).
 */
function PhotoTag({ anchor, i, children }: { anchor: AnchorId; i: number; children: ReactNode }) {
  // Kept inside the panel, whatever the jacket does.
  const p = CRAFT_PANEL;
  const x = `clamp(${p.x + 16}px, calc((var(--a-${anchor}-x, 50%) - var(--frame-left, 0px)) / var(--u, 1)), ${p.x + p.w - 190}px)`;
  const y = `clamp(${p.y + 40}px, calc((var(--a-${anchor}-y, 50%) - var(--frame-top, 0px)) / var(--u, 1)), ${p.y + p.h - 60}px)`;
  // The entrance moves the wrapper; the tag follows its part of the shot.
  return (
    <div style={rise(5 + i, 12)}>
      <p
        className="jk-label-xs absolute flex items-center gap-[10px] whitespace-nowrap bg-jk-paper px-[14px] py-[9px] text-jk-ink"
        style={{
          left: x,
          top: y,
          opacity: `var(--a-${anchor}-v, 1)`,
          transform: "translate3d(14px, -50%, 0)",
        }}
      >
        {children}
        <ArrowUpRight size={11} stroke={2} className="jk-flip-rtl" />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portrait screens: the jacket holds the upper part of the stage (framed
// by TALL in three/heroLayout.ts, its hem just above 58 %); each beat's
// words sit in the space between the jacket and the safe bottom edge,
// centred there — so a short beat and a long one are both balanced (no
// empty block under the text), in the same order as on desktop: eyebrow
// → headline → copy.

/** The words' area under the jacket (shared by every beat). */
const LOWER = "inset-x-0 top-[58%] jk-safe-bottom flex flex-col [justify-content:safe_center] px-5";
/** Headline size on phones/tablets: the dominant element, as on desktop. */
const COMPACT_HEADLINE = "text-[clamp(40px,12vw,64px)]";

/**
 * Phones: drawn under the 3D canvas — the embossed "MOMENT" behind the
 * jacket in 05 (as on desktop, at a size that shows the whole word).
 */
export function CompactBackdrop() {
  const { t } = useI18n();
  return (
    <p
      aria-hidden="true"
      className="jk-display jk-home-moment--compact pointer-events-none absolute inset-x-0 text-center"
      style={{
        top: "17%",
        // 3.25em wide in Anton: 27vw keeps the whole word on screen.
        fontSize: "27vw",
        color: "rgb(230 199 177)", // cream with 18% oxblood: a deep-red tint, pressed into the room
        textShadow: "0 1px 0 rgb(255 255 255 / .7), 0 -1px 0 rgb(var(--brand-oxblood) / .18), 0 34px 60px rgb(var(--brand-oxblood) / .16)",
        ...displayWordStyle(T.finale),
      }}
    >
      {t("story.backdrop.moment")}
    </p>
  );
}

function CompactStory({ active, arrived, goTo }: StoryProps) {
  const { t, locale } = useI18n();
  const lower = LOWER;
  const headline = COMPACT_HEADLINE;
  return (
    <>
      <BeatFrame beat={T.idea} active={active === "idea"} arrived={arrived === "idea"} className={lower}>
        <Eyebrow index="01" label={t("story.idea.eyebrow")} rule={50} />
        <Headline className={`mt-5 ${headline}`} compact k="story.idea.headline" />
        <p className="mt-4 text-base leading-[1.6] text-jk-body" style={rise(3)}>
          {renderRich(t("story.idea.body"), BODY_TAGS)}
        </p>
      </BeatFrame>

      <BeatFrame beat={T.jacket} active={active === "jacket"} arrived={arrived === "jacket"} className={lower}>
        <Eyebrow index="02" label={t("story.jacket.eyebrow")} rule={50} dark />
        <Headline className={`mt-5 ${headline}`} compact dark k="story.jacket.headline" />
        <ol className="mt-5" style={rise(3)}>
          {(["wool", "leather", "fit", "built"] as const).map((id, i) => (
            <li
              key={id}
              className="flex items-baseline justify-between gap-4 py-2"
              style={{ borderTop: "1px dashed rgb(var(--t-rule))" }}
            >
              <span className="jk-label text-jk-on-dark" style={{ fontSize: 10 }}>
                <span className="me-3 text-jk-numeral">{i + 1}</span>
                {t(`story.jacket.compact.${id}.term`)}
              </span>
              <span className="text-[13px] text-jk-muted-dark">{t(`story.jacket.compact.${id}.value`)}</span>
            </li>
          ))}
        </ol>
      </BeatFrame>
      <CompactRings arrived={arrived === "jacket"} />

      <BeatFrame beat={T.craft} active={active === "craft"} arrived={arrived === "craft"} className={lower}>
        <Eyebrow index="03" label={t("story.craft.eyebrow")} rule={50} />
        <Headline className={`mt-5 ${headline}`} compact k="story.craft.headline" />
        <p className="mt-4 text-base leading-[1.6] text-jk-body" style={rise(3)}>
          {t("story.craft.body")}
        </p>
      </BeatFrame>

      <BeatFrame beat={T.stitch} active={active === "stitch"} arrived={arrived === "stitch"} className={lower}>
        <Eyebrow index="04" label={t("story.stitch.eyebrow")} rule={50} />
        <h2 className={`jk-headline mt-5 text-jk-ink ${headline}`} style={{ letterSpacing: "-0.04em" }}>
          <MaskLine i={0}>
            {locale === "en" ? (
              <img
                src="/assets/embroidery/stitched-silver@2x.webp"
                alt={t("story.stitch.stitched")}
                className="inline-block max-w-none"
                // Scales with the headline (design §11): height 0.906em.
                style={{ height: "0.906em", width: "auto", marginLeft: "-0.04em", marginRight: "-0.1em", verticalAlign: "-0.125em", filter: CREAM_THREAD }}
              />
            ) : (
              <StitchedText text={t("story.stitch.stitched")} size={STITCHED_SIZE} dye={CREAM_THREAD} className="jk-stitched" />
            )}
            {t("story.stitch.afterStitched")}
          </MaskLine>
          <MaskLine i={1} className="text-jk-taupe">
            {t("story.stitch.notPrinted")}
          </MaskLine>
        </h2>
        <p className="mt-4 text-base leading-[1.6] text-jk-body" style={rise(3)}>
          {t("story.stitch.bodyCompact")}
        </p>
      </BeatFrame>

      <div
        className={`absolute ${LOWER} ${active === "finale" ? "" : "pointer-events-none"}`}
        style={inVar(arrived === "finale")}
        aria-hidden={active === "finale" ? undefined : true}
      >
        <Eyebrow index="05" label={t("story.finale.eyebrow")} rule={50} />
        <Headline className={`mt-5 ${headline}`} compact k="story.finale.headlineCompact" />
        <p className="mt-4 text-base leading-[1.6] text-jk-body" style={rise(3)}>
          {t("story.finale.body")}
        </p>
        <div className="mt-5" style={rise(4)}>
          <Link to={ROUTES.design} className="jk-btn-primary h-14 w-full py-0">
            {t("story.finale.cta")}
            <ArrowRight />
          </Link>
          <button type="button" onClick={() => goTo(CRAFT_AT)} className="jk-label jk-link mt-4 text-jk-ink">
            {t("story.finale.viewCraft")}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Phones, in 02: only the target rings on the jacket, numbered 1–4 — in
 * after the list once the section arrives; out with it on scroll.
 */
function CompactRings({ arrived }: { arrived: boolean }) {
  const rings: AnchorId[] = ["body", "sleeve", "fit", "snaps"];
  const out = seg(T.jacket[2], T.jacket[3]);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: `calc(1 - ${out})`, ...inVar(arrived) }}>
      <div className="absolute inset-0" style={{ opacity: "var(--in, 0)", transition: `opacity 700ms ${ENTER_EASE} calc(var(--in, 0) * ${4 * STAGGER_MS}ms)` }}>
        {rings.map((id, i) => (
          <span
            key={id}
            className="absolute grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[9px] font-semibold text-jk-on-dark"
            style={{
              left: `var(--a-${id}-x, 50%)`,
              top: `var(--a-${id}-y, 50%)`,
              border: "1px solid rgb(var(--t-rule))",
              opacity: `var(--a-${id}-v, 1)`,
            }}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks

/**
 * A beat's container: starts its words' entrance once its section has
 * arrived (`--in`); exits, with scroll, by drifting up and fading.
 */
function BeatFrame({
  beat,
  className = "inset-0",
  active,
  arrived,
  children,
}: {
  beat: Beat;
  className?: string;
  active: boolean;
  arrived: boolean;
  children: ReactNode;
}) {
  return (
    <div
      // Wide screens draw the story inside the click-transparent design
      // frame (DesignFrame: pointer-events none), so the active beat turns
      // its own links and buttons back on — the frame itself stays
      // transparent to clicks; an inactive beat takes none.
      className={`absolute ${className} ${active ? "[&_a]:pointer-events-auto [&_button]:pointer-events-auto" : "pointer-events-none"}`}
      style={{ ...exitBeatStyle(beat), ...inVar(arrived) }}
      aria-hidden={active ? undefined : true}
    >
      {children}
    </div>
  );
}

function exitBeatStyle([, , outStart, outEnd]: Beat): CSSProperties {
  if (outStart > 1) return {};
  const t = segEased(outStart, outEnd);
  return {
    opacity: `calc(1 - ${t})`,
    transform: `translate3d(0, calc(${t} * -36px), 0)`,
  };
}

/** "01  The idea ——": numeral, name and a rule, 16px apart. */
function Eyebrow({
  index,
  label,
  rule,
  dark = false,
}: {
  index: string;
  label: string;
  rule: number;
  dark?: boolean;
}) {
  return (
    <p className={`jk-label flex items-center gap-4 ${dark ? "text-jk-on-dark" : "text-jk-ink"}`} style={rise(0)}>
      <span className={dark ? "text-jk-numeral" : "text-jk-muted"}>{index}</span>
      {label}
      {/* The rule draws itself in, just after the words. */}
      <span
        aria-hidden="true"
        className="block h-px origin-left rtl:origin-right"
        style={{
          width: rule,
          background: "rgb(var(--t-rule))",
          transform: "scaleX(var(--in, 0))",
          transition: `transform 800ms ${ENTER_EASE} calc(var(--in, 0) * ${STAGGER_MS}ms)`,
        }}
      />
    </p>
  );
}

/**
 * The two-tone headline, from a message with one tag per line (see
 * locales/en/story): <lN> in the headline colour, <aN> in taupe; N is the
 * line's place in the entrance.
 */
function Headline({
  k,
  size,
  className = "",
  dark = false,
  compact = false,
}: {
  k: TKey;
  size?: number;
  className?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const accent = dark ? "text-jk-taupe-dark" : "text-jk-taupe";
  const tags = Object.fromEntries(
    [1, 2, 3].flatMap((n) => [
      [`l${n}`, (c: ReactNode) => <MaskLine i={n - 1}>{c}</MaskLine>],
      [`a${n}`, (c: ReactNode) => <MaskLine i={n - 1} className={accent}>{c}</MaskLine>],
    ])
  );
  return (
    <h2
      className={`jk-headline ${dark ? "text-jk-on-dark" : "text-jk-ink"} ${compact ? "jk-story-head--compact" : ""} ${className}`}
      style={{ fontSize: size === undefined ? undefined : headSize(size), letterSpacing: compact ? "-0.04em" : undefined }}
    >
      {renderRich(t(k), tags)}
    </h2>
  );
}

/** One headline line rising into place, in sequence after the eyebrow. */
function MaskLine({
  i,
  className = "",
  children,
}: {
  i: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`block whitespace-nowrap ${className}`} style={rise(i + 1)}>
      {children}
    </span>
  );
}

/** A dashed list: text at the reading start, numeral at the end. */
function SpecList({
  items,
  className,
  rowClass,
}: {
  items: { id: string; label: string }[];
  className: string;
  rowClass: string;
}) {
  return (
    <ul className={className} style={rise(4)}>
      {items.map(({ id, label }, i) => (
        <li
          key={id}
          className={`flex items-baseline justify-between leading-[1.5] text-jk-ink jk-dashed-top ${rowClass} ${
            i === items.length - 1 ? "jk-dashed-bottom" : ""
          }`}
        >
          {label}
          <span className="jk-label text-jk-muted">{pad2(i + 1)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A section's footer rule: a label at the reading start, "[ 0X / 05 ]" at the end. */
function FooterRule({ left, counter }: { left: string; counter: number }) {
  return (
    <div
      className="jk-label absolute flex items-center justify-between pt-[14px]"
      style={{
        left: 56,
        top: 836,
        width: 1328,
        color: "rgb(var(--t-muted))",
        borderTop: "1px dashed rgb(var(--t-rule))",
        ...rise(4),
      }}
    >
      <span>{left}</span>
      <span>
        <Counter n={counter} />
      </span>
    </div>
  );
}

/** A circular macro close-up of a material. */
function MacroChip({ src, size, shadow = false, border }: { src: string; size: number; shadow?: boolean; border?: string }) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="shrink-0 rounded-full object-cover"
      style={{
        width: size,
        height: size,
        border: border ? `1px solid ${border}` : undefined,
        boxShadow: shadow ? "0 8px 18px rgb(var(--brand-navy-deep) / .24)" : undefined,
      }}
    />
  );
}

/** "Discover the craft ↗". */
function ArrowLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="jk-label jk-arrow-link jk-hit text-jk-ink">
      {children}
      <ArrowUpRight size={14} stroke={1.8} />
    </button>
  );
}

function ArrowUpRight({ size, stroke, className }: { size: number; stroke: number; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10 L10 4 M5 4 H10 V9" />
    </svg>
  );
}

/** The CTA's arrow (18px). */
export function ArrowRight({ stroke = 1.8 }: { stroke?: number }) {
  return (
    <svg aria-hidden="true" className="jk-arrow shrink-0" width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 H15 M10 4 L15 9 L10 14" />
    </svg>
  );
}
