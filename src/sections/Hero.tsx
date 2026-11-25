import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Atmosphere from "@/components/Atmosphere";
import { NAVY_THREAD } from "@/components/ThreadDyes";
import { useInView } from "@/hooks/useInView";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { pad2 } from "@/i18n/format";
import Ltr from "@/i18n/Ltr";
import { Trans } from "@/i18n/Trans";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";
import { exitStyle, seg } from "@/lib/scrollTimeline";
import { canUseWebGL } from "@/lib/webgl";
import AnnotationArrows from "@/sections/AnnotationArrows";
import DesignFrame from "@/sections/DesignFrame";
import HeroBadges from "@/sections/HeroBadges";
import { at, useDesignFrame } from "@/sections/frame";
import HeroStory, { ArrowRight, CompactBackdrop, StoryBackdrop } from "@/sections/HeroStory";
import { stitchMask, useEntrance } from "@/sections/heroIntro";
import type { AnchorListener } from "@/three/scene/FidelioScene";
import {
  arrivedAt,
  atmosphereAt,
  beatAt,
  chapterAt,
  HERO_COLOURWAYS,
  HERO_TIMELINE,
  STORY_BEATS,
  STORY_END,
  STUDIO_COLOUR,
  type StoryBeatId,
} from "@/three/heroLayout";

// Three.js loads in its own chunk so the hero's text paints first.
const FidelioScene = lazy(() => import("@/three/scene/FidelioScene"));

/**
 * The homepage story: ONE pinned, scroll-driven 3D scene. A camera films
 * the jacket through the hero and five chapters; scroll position is the
 * only driver, so it runs at the user's pace and reverses exactly (shots
 * in three/heroLayout.ts, words in HeroStory):
 *   HERO      the words, JACKETEK and the call to action left; one jacket right;
 *   01 IDEA   the jacket crosses to the left; "Designed for your year.";
 *   02 JACKET the dark studio; curved annotations on the turning jacket;
 *   03 CRAFT  paper; the macro on collar, snaps and leather in a panel;
 *   04 STITCH it turns its back as the embroidery stitches in;
 *   05 YOURS  "Made for [jacket] your moment." + call to action.
 *
 * Layers, back to front: the studio backgrounds (CSS) and grain → the
 * stitch badges and display words → the transparent 3D canvas → the words.
 */
export default function Hero() {
  return <CinematicHero />;
}

/** Wide screens: landscape choreography, text beside the jacket. */
const WIDE_QUERY = "(min-width: 900px) and (min-aspect-ratio: 11/10)";

const [CHROME_START, CHROME_END] = HERO_TIMELINE.chromeExit;

/** Scroll the story covers, at the original pace (12 viewports per unit). */
const TRACK_VH = Math.round(STORY_END * 1200);

function CinematicHero() {
  const { t } = useI18n();
  const wide = useMediaQuery(WIDE_QUERY);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Only the beat on screen takes pointer input (state changes a handful
  // of times per scroll-through, not per frame).
  const [active, setActive] = useState<StoryBeatId | null>(null);
  // The section the jacket has arrived at: its words play in on their own.
  const [arrived, setArrived] = useState<StoryBeatId | null>(null);
  const [chapter, setChapter] = useState(-1);
  const [opening, setOpening] = useState(true);
  // A colourway picked in the opening frame (recolours the front jacket
  // until the story begins).
  const [pick, setPick] = useState<number | null>(null);
  const onProgress = useCallback((p: number) => {
    setActive(beatAt(p));
    setArrived(arrivedAt(p));
    setChapter(chapterAt(p));
    setOpening(p < CHROME_START + 0.01);
    writePageAtmosphere(p);
  }, []);
  const { ref, progress } = useScrollProgress<HTMLElement>(true, onProgress, STORY_END);
  const stage = useInView<HTMLDivElement>({ threshold: 0, once: false });
  const frame = useDesignFrame(stage.ref);
  const anchorListener = useRef<AnchorListener | null>(null);
  const webgl = canUseWebGL();
  // The entrance: lettering and jackets stitched in, right to left.
  const { revealing, onSceneReady } = useEntrance(stage.ref, reducedMotion, webgl);
  // Until the 3D jacket has drawn, a quiet placeholder holds its place.
  const [sceneShown, setSceneShown] = useState(false);
  const handleSceneReady = useCallback(() => {
    setSceneShown(true);
    onSceneReady();
  }, [onSceneReady]);
  // The page's ink/theme variables belong to this story only.
  useEffect(() => () => clearPageAtmosphere(), []);

  /** Scrolls to a point of the story (e.g. "Discover the craft"). */
  const goTo = useCallback(
    (p: number) => {
      const el = ref.current;
      if (!el) return;
      const travel = el.offsetHeight - window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + (p / STORY_END) * travel, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [ref, reducedMotion]
  );

  return (
    <section ref={ref} aria-label={t("hero.storyAria")} className="jk-home relative" style={{ height: `${TRACK_VH + 100}vh` }}>
      <div
        ref={stage.ref}
        className="sticky top-0 h-screen overflow-hidden"
        // The large viewport (100lvh), so the stage always covers the
        // screen on iPhone Safari as its toolbars show and hide (desktop:
        // identical to 100vh). Older browsers keep h-screen.
        style={{ backgroundColor: STUDIO_COLOUR, height: "100lvh" }}
      >
        <Studio />

        {/* Behind the jacket: the stitch badges, the display words, the
            craft panel (phones: the embroidered wordmark too). */}
        {wide ? (
          <DesignFrame>
            <HeroThread />
            {webgl && <HeroLoading shown={!sceneShown} style={at(JACKET_X, 430, { width: 400, transform: "translate(-50%, -50%)" })} />}
            <HeroBadges interactive={opening} revealing={revealing} />
            <StoryBackdrop />
          </DesignFrame>
        ) : (
          <>
            <HeroBadges compact interactive={opening} revealing={revealing} />
            <CompactWordmark revealing={revealing} />
            {webgl && <HeroLoading shown={!sceneShown} className="absolute left-1/2 top-[40%] w-[min(58%,320px)] -translate-x-1/2 -translate-y-1/2" />}
            <CompactBackdrop />
          </>
        )}

        {/* The 3D jacket on a transparent canvas. In 03 the macro shot
            is shown only inside the craft panel. It lets the pointer
            through to the badges beneath (the scene reads the cursor from
            the window). */}
        {webgl && (
          <div
            role="img"
            aria-label={t("hero.jacketAria")}
            className="pointer-events-none absolute inset-0"
            style={{ ...(wide ? CRAFT_CLIP : undefined), ...(revealing ? stitchMask("--intro-j") : undefined) }}
          >
            <ErrorBoundary fallback={null}>
              <Suspense fallback={null}>
                <FidelioScene
                  animate={stage.inView}
                  scroll={progress}
                  wide={wide}
                  alive={!reducedMotion}
                  anchorTarget={stage.ref}
                  anchorListener={anchorListener}
                  heroColourway={pick}
                  onReady={handleSceneReady}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {wide ? (
          <DesignFrame>
            <OpeningFrame interactive={opening} revealing={revealing} pick={pick ?? 0} onPick={setPick} />
            <HeroStory active={active} arrived={arrived} goTo={goTo} />
            <AnnotationArrows listener={anchorListener} progress={progress} frame={frame} />
            <ChapterIndex chapter={chapter} />
          </DesignFrame>
        ) : (
          <>
            <CompactOpening interactive={opening} />
            <HeroStory compact active={active} arrived={arrived} goTo={goTo} />
            <CompactCounter chapter={chapter} />
          </>
        )}
      </div>
    </section>
  );
}

/** The macro is clipped to the craft panel as the paper studio comes in. */
const CRAFT_CLIP: CSSProperties = {
  clipPath:
    "inset(calc(var(--jk-paper, 0) * var(--clip-t, 0px)) calc(var(--jk-paper, 0) * var(--clip-r, 0px)) calc(var(--jk-paper, 0) * var(--clip-b, 0px)) calc(var(--jk-paper, 0) * var(--clip-l, 0px)))",
};

// ---------------------------------------------------------------------------
// The page around the story follows its colour world (three/heroLayout
// MOODS): the background, the light behind the jacket and every text role
// are CSS variables (styles/index.css), rewritten here as the story moves.

/** World colour → CSS variable (r g b). */
const WORLD_VARS = {
  center: "--bg-c0",
  mid: "--bg-c1",
  edge: "--bg-c2",
  glow: "--bg-glow",
  head: "--t-head",
  accent: "--t-accent",
  body: "--t-body",
  muted: "--t-muted",
  numeral: "--t-numeral",
  onHead: "--t-on-head",
  btn: "--t-btn",
  btnText: "--t-btn-text",
  btnHover: "--t-btn-hover",
  link: "--t-link",
  rule: "--t-rule",
  stitch: "--t-stitch",
} as const;

const ATMOSPHERE_VARS = ["--jk-dark", "--jk-paper", "--bg-glow-a", "--jk-amb", "--jk-wall", "--fid-ink", "--fid-ink-inverse", ...Object.values(WORLD_VARS)];

function writePageAtmosphere(p: number) {
  const { dark, paper, glowStrength, ambient, wall, colours } = atmosphereAt(p);
  const root = document.documentElement.style;
  root.setProperty("--jk-amb", ambient.toFixed(3));
  root.setProperty("--jk-wall", wall.toFixed(3));
  root.setProperty("--jk-dark", dark.toFixed(3));
  root.setProperty("--jk-paper", paper.toFixed(3));
  root.setProperty("--bg-glow-a", glowStrength.toFixed(3));
  for (const [key, name] of Object.entries(WORLD_VARS)) root.setProperty(name, colours[key as keyof typeof WORLD_VARS].join(" "));
  // The nav and logo tag take the headline colour (the tag's letter: the ground).
  root.setProperty("--fid-ink", colours.head.join(" "));
  root.setProperty("--fid-ink-inverse", colours.onHead.join(" "));
}

function clearPageAtmosphere() {
  const root = document.documentElement.style;
  ATMOSPHERE_VARS.forEach((v) => root.removeProperty(v));
}

/**
 * The studio, full-bleed: the cream room the jacket hangs in (components/
 * Atmosphere: the world's gradient, window light, dusty-blue ambient,
 * pinstripe wall, floor plane, vignette, grain), plus the light behind the
 * jacket(s).
 */
function Studio() {
  return (
    <Atmosphere className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: "var(--bg-glow-layer)" }} />
    </Atmosphere>
  );
}

// ---------------------------------------------------------------------------
// The hero

/**
 * While the 3D jacket loads (slow connections or devices): a faint jacket
 * silhouette where it will stand, a stitch sewing along beneath it and one
 * quiet line. Never blocks the page; fades out the moment the jacket draws.
 */
function HeroLoading({ shown, className = "", style }: { shown: boolean; className?: string; style?: CSSProperties }) {
  const { t } = useI18n();
  return (
    <div aria-hidden={!shown} data-shown={shown} className={`jk-hero-loading ${className}`} style={style}>
      <div className="jk-hero-loading__silhouette" />
      <div className="jk-hero-loading__stitch" />
      <p className="jk-hero-loading__label" role={shown ? "status" : undefined}>
        {shown ? t("hero.preparingJacket") : ""}
      </p>
    </div>
  );
}

/**
 * One crimson thread, stitched across the cream room and passing behind the
 * jacket (design-frame units: the 1440 x 900 artboard). Its stitches march
 * slowly; it leaves with the rest of the opening chrome.
 */
function HeroThread() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={exitStyle(CHROME_START, CHROME_END, 0)}>
      <svg className="jk-thread absolute inset-0" width={1440} height={900} viewBox="0 0 1440 900" fill="none">
        <path
          d="M 470 930 C 640 760, 760 600, 980 560 S 1300 420, 1470 170"
          stroke="rgb(var(--brand-red))"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeDasharray="7 9"
        />
      </svg>
    </div>
  );
}

const WORDMARK_SRC = "/assets/embroidery/jacketek-wordmark-silver@2x.webp";
const [WORDMARK_START, WORDMARK_END] = HERO_TIMELINE.wordmarkExit;

/** The lettering in navy satin thread on the cream room, stitched in during the entrance. */
const wordmarkLook = (revealing: boolean): CSSProperties => ({
  filter: NAVY_THREAD,
  ...(revealing ? stitchMask("--intro-w") : undefined),
});

/**
 * The graduation cap on the final K: a rendered 3D mortarboard (Blender,
 * lit like the lettering — key from the top left) in two aligned layers,
 * the cap and its tassel, so the tassel can sway on its own. Placed in
 * fractions of the wordmark, so it sits the same at every size: balanced
 * on the outer corner of the K's upper arm — the rim's inner edge on the
 * corner, most of the cap beyond the letter, tipped outward about that
 * point (CAP.contact).
 */
const CAP = {
  src: "/assets/hero/grad-cap.webp",
  tassel: "/assets/hero/grad-cap-tassel.webp",
  /** Render size (px) and the tassel's pivot on the board's edge. */
  w: 449,
  h: 323,
  pivot: [402.5, 136.7],
  /** Box in the wordmark: left / top / width as fractions of its width / height / width. */
  left: 0.912,
  top: -0.165,
  width: 0.168,
  /** Where the rim meets the K's corner (fractions of the cap's box). */
  contact: [0.34, 0.72],
} as const;
const TASSEL_PIVOT = `${(CAP.pivot[0] / CAP.w) * 100}% ${(CAP.pivot[1] / CAP.h) * 100}%`;

/**
 * The embroidered JACKETEK (a pre-rendered satin-stitch image, never live
 * text) with the cap on its last K. The cap settles onto the letter once
 * the lettering has stitched in.
 */
function CappedWordmark({ revealing, alt, style }: { revealing: boolean; alt: string; style: CSSProperties }) {
  return (
    <div className="relative" style={style}>
      <img
        src={WORDMARK_SRC}
        alt={alt}
        width={1480}
        height={430}
        decoding="async"
        className="block h-auto w-full select-none"
        style={wordmarkLook(revealing)}
      />
      <div
        aria-hidden="true"
        className={`jk-cap absolute ${revealing ? "" : "jk-cap-on"}`}
        style={{
          left: `${CAP.left * 100}%`,
          top: `${CAP.top * 100}%`,
          width: `${CAP.width * 100}%`,
          aspectRatio: `${CAP.w} / ${CAP.h}`,
          transformOrigin: `${CAP.contact[0] * 100}% ${CAP.contact[1] * 100}%`,
        }}
      >
        {/* The tassel's breeze: two slow sways of different lengths about
            its knot on the board's edge, so the motion never quite repeats. */}
        <div className="jk-cap-breeze absolute inset-0" style={{ transformOrigin: TASSEL_PIVOT }}>
          <img
            src={CAP.tassel}
            alt=""
            decoding="async"
            className="jk-cap-gust absolute inset-0 h-full w-full select-none"
            style={{ transformOrigin: TASSEL_PIVOT }}
          />
        </div>
        <img src={CAP.src} alt="" decoding="async" className="absolute inset-0 h-full w-full select-none" />
      </div>
    </div>
  );
}

/**
 * Phones: the embroidered wordmark (a pre-rendered satin-stitch image,
 * never live text), set left at a refined size above the jacket, with a
 * small caption naming it. Positioned in the stage's own terms (as the 3D
 * framing is). Leaves upward with the hero.
 */
function CompactWordmark({ revealing }: { revealing: boolean }) {
  const { t, isRtl } = useI18n();
  const out = seg(WORDMARK_START, WORDMARK_END);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-5"
      style={{ top: "13%", transform: `translate3d(0, calc(${out} * -60vh), 0)` }}
    >
      <p className="jk-label-xs flex items-center gap-[12px] text-jk-muted" style={{ opacity: `calc(1 - ${seg(CHROME_START, CHROME_END)})` }}>
        <span aria-hidden="true" className="block h-px w-8 bg-jk-rule" />
        {t("hero.compact.eyebrow")}
      </p>
      {/* RTL: the wordmark (brand art, never mirrored) moves to the reading
          start, the right, its cap kept clear of the screen's edge. */}
      <CappedWordmark
        revealing={revealing}
        alt=""
        style={
          isRtl
            ? { width: "min(62%, 300px)", marginLeft: "auto", marginRight: "7%", marginTop: 14 }
            : { width: "min(62%, 300px)", marginLeft: "-1.5%", marginTop: 14 }
        }
      />
    </div>
  );
}

const VERTICAL: CSSProperties = { transform: "translate(-50%, -50%) rotate(-90deg)", whiteSpace: "nowrap" };

/** Where the jacket stands in the opening frame (HERO in three/heroLayout: sx 0.7). */
const JACKET_X = 0.7 * 1440;

/**
 * The opening frame (design §3.3): the brand message and its call to
 * action hold the left; the one jacket holds the right, with its one
 * interaction beneath it — pick a colourway and the jacket takes it.
 */
function OpeningFrame({
  interactive,
  revealing,
  pick,
  onPick,
}: {
  interactive: boolean;
  revealing: boolean;
  pick: number;
  onPick: (i: number) => void;
}) {
  const { t, isRtl } = useI18n();
  const exit = exitStyle(CHROME_START, CHROME_END, 16);
  return (
    <div className="absolute inset-0" style={exit}>
      <p className="jk-label-xs text-jk-muted" style={at(20, 450, VERTICAL)}>
        {t("hero.side.series")}
      </p>
      <p
        className="jk-label-xs text-jk-muted"
        style={at(1420, 450, { ...VERTICAL, transform: "translate(-50%, -50%) rotate(90deg)" })}
      >
        {t("hero.side.class")}
      </p>

      {/* LEFT — eyebrow, the embroidered JACKETEK, headline, copy, CTA.
          RTL: the same column, read from its right edge; the wordmark
          (brand art) keeps its place on the column's left. */}
      {/* Arabic ends the column 60px short of the English box: its right
          edge is the reading edge, kept clear of the jacket's badges. */}
      <div className="flex flex-col justify-center" style={at(110, 70, { width: isRtl ? 540 : 600, height: 760 })}>
        <p className="jk-label flex items-center gap-[14px] text-jk-red" style={{ fontSize: 13.5 }}>
          <span aria-hidden="true" className="block h-px w-10 bg-jk-rule" />
          {t("hero.eyebrow")}
        </p>
        <CappedWordmark
          revealing={revealing}
          alt={t("hero.wordmarkAlt")}
          // The image's letters start ~2 % in: pulled back onto the column's
          // (left) edge, in both directions.
          style={{ width: 580, marginLeft: -12, marginTop: 34, alignSelf: isRtl ? "flex-end" : undefined }}
        />
        <h1 className="jk-hero-title mt-8 text-[45px] font-medium leading-[1.14] tracking-[-0.03em] text-jk-navy">
          <Trans k="hero.headline" tags={HEADLINE_TAGS} />
        </h1>
        <p className="jk-body jk-hero-lede mt-5 w-[500px]" style={{ fontSize: 22 }}>
          {t("hero.lede")}
        </p>
        <div className={`mt-10 flex items-center gap-8 ${interactive ? "pointer-events-auto" : ""}`}>
          <Link to={ROUTES.design} tabIndex={interactive ? undefined : -1} className="jk-btn-primary jk-btn-hero w-[292px]" style={{ fontSize: 13 }}>
            {t("hero.cta")}
            <ArrowRight />
          </Link>
          <p className="jk-label whitespace-nowrap text-jk-muted">{t("hero.scrollCue")}</p>
        </div>
      </div>

      {/* RIGHT — under the jacket: its name and colourways. */}
      <div
        className={`flex items-center gap-7 whitespace-nowrap ${interactive ? "pointer-events-auto" : ""}`}
        style={at(JACKET_X, 806, { transform: "translateX(-50%)" })}
      >
        <p className="jk-label text-jk-ink">{t("hero.jacketName")}</p>
        <ColourwayDots interactive={interactive} pick={pick} onPick={onPick} />
      </div>
    </div>
  );
}

/** Four 14px dots (Black, Navy, Maroon, Forest); the active one ringed. */
function ColourwayDots({
  interactive,
  pick,
  onPick,
}: {
  interactive: boolean;
  pick: number;
  onPick: (i: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t("hero.colourwayAria")} className="flex">
      {HERO_COLOURWAYS.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={pick === i}
          aria-label={t(`hero.colourway.${c.id}`)}
          tabIndex={interactive ? undefined : -1}
          onClick={() => onPick(i)}
          // A 22px hit area around each 14px dot (8px apart).
          // jk-dot-cell: roomier cells on touch screens (styles/details.css).
          className="jk-dot-cell group grid h-[22px] w-[22px] place-items-center"
        >
          <span
            className="block h-[14px] w-[14px] rounded-full transition-shadow duration-200"
            style={{
              background: c.colours.body,
              boxShadow:
                pick === i
                  ? "0 0 0 2px rgb(var(--bg-c1)), 0 0 0 3px rgb(var(--t-link))"
                  : "0 0 0 1px rgb(var(--t-muted))",
            }}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Phones: under the jacket, the headline and the call to action, full
 * width at the thumb (cue hidden). No colour picker here — the jacket's
 * colours are chosen properly in Design Your Jacket.
 */
function CompactOpening({ interactive }: { interactive: boolean }) {
  const { t } = useI18n();
  return (
    <div className="jk-safe-bottom absolute inset-x-0 px-5" style={exitStyle(CHROME_START, CHROME_END, 16)}>
      <h1 className="jk-hero-title jk-hero-title--compact text-[25px] font-medium leading-[1.14] tracking-[-0.03em] text-jk-navy">
        <Trans k="hero.headline" tags={HEADLINE_TAGS} />
      </h1>
      <div className={`mt-5 ${interactive ? "" : "pointer-events-none"}`}>
        <Link
          to={ROUTES.design}
          tabIndex={interactive ? undefined : -1}
          className="jk-btn-primary jk-btn-hero h-14 w-full py-0"
        >
          {t("hero.cta")}
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Where you are in the story

/**
 * The index rail (design §4.1): 01–05 in a column at the left; the
 * current chapter in ink with an 18px rule beneath it, the rest quiet.
 */
function ChapterIndex({ chapter }: { chapter: number }) {
  const { t } = useI18n();
  const shown: CSSProperties = { opacity: `calc(${seg(CHROME_START, CHROME_END)})` };
  return (
    <nav aria-label={t("hero.chaptersAria")} style={at(56, 300, shown)}>
      <ol className="flex flex-col gap-[22px]">
        {STORY_BEATS.map((id, i) => {
          const current = i === chapter;
          return (
            <li key={id} className="jk-label relative" style={{ fontSize: 10 }}>
              <span
                className="transition-colors duration-300"
                // The current chapter in the headline colour (its rule
                // beneath, in the accent); the rest in the label colour.
                style={{ color: current ? "rgb(var(--t-head))" : "rgb(var(--t-muted))" }}
              >
                {pad2(i + 1)}
              </span>
              <span
                aria-hidden="true"
                className="absolute left-0 top-full mt-[6px] block h-px w-[18px] origin-left transition-transform duration-300"
                style={{ background: "rgb(var(--t-rule))", transform: `scaleX(${current ? 1 : 0})` }}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Phones: a single counter. */
function CompactCounter({ chapter }: { chapter: number }) {
  const { t } = useI18n();
  return (
    <p
      aria-hidden="true"
      className="jk-label absolute end-5 top-[76px]"
      style={{ fontSize: 10, color: "rgb(var(--t-muted))", opacity: `calc(${seg(CHROME_START, CHROME_END)})` }}
    >
      {/* Western digits, read left to right in both languages. */}
      <Ltr>{t("hero.compact.counter", { current: pad2(Math.max(1, chapter + 1)), total: pad2(STORY_BEATS.length) })}</Ltr>
    </p>
  );
}

/** The opening headline's second line, in crimson. */
const HEADLINE_TAGS = {
  accent: (c: ReactNode) => <span className="block text-jk-crimson">{c}</span>,
};
