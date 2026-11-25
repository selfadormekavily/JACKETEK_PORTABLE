import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { SoftShadows } from "@react-three/drei";
import {
  CanvasTexture,
  Color,
  MathUtils,
  NeutralToneMapping,
  Object3D,
  Raycaster,
  Vector3,
  type DirectionalLight,
  type Group,
  type Mesh,
  type PerspectiveCamera,
  type SpotLight,
} from "three";
import type { EmbroideryAppearance, JacketAppearance } from "@/features/configurator";
import { MODEL_ASSETS } from "../assets";
import { setStitchReveal } from "../embroidery/stitchReveal";
import {
  ANCHORS,
  atmosphereAt,
  BACK_ANCHORS,
  CAMERA_PITCH,
  computeHeroLayout,
  HERO_COLOURWAYS,
  HERO_EMBROIDERY,
  HERO_FOV,
  HERO_MOTION,
  HERO_PICK_END,
  HERO_TIMELINE,
  JACKET_HEIGHT,
  type AnchorId,
  type CameraState,
  type Colourway,
  type HeroLayout,
  type SolvedShot,
} from "../heroLayout";
import JacketModel from "../jacket/JacketModel";
import Cyclorama from "../stage/Cyclorama";
import LoadingIndicator from "../stage/LoadingIndicator";
import StudioLighting from "../stage/StudioLighting";

const JACKET_URL = MODEL_ASSETS.configuratorJacket;

// ---------------------------------------------------------------------------
// Appearances

/**
 * A satin-stitched motif from pre-drawn artwork (transparent PNG in its
 * thread colours), stitched like any image design. `scale` × the back
 * zone's image size (0.17 m) is its longest side.
 */
const satin = (
  id: string,
  file: string,
  aspect: number,
  offset: [number, number],
  scale: number
): EmbroideryAppearance => ({
  id,
  kind: "image",
  text: "",
  image: { src: `/assets/embroidery/back/${file}`, aspect },
  placement: "upperBack",
  offset,
  rotation: 0,
  scale,
  threadHex: null,
});

/**
 * A varsity piece (tackle twill: twill face, satin border), as on real
 * Tawjihi / graduation jackets — see three/embroidery/embroideryMaps.
 */
const varsity = (
  id: string,
  value: string,
  placement: EmbroideryAppearance["placement"],
  offset: [number, number],
  rotation: number,
  style: NonNullable<EmbroideryAppearance["varsity"]>
): EmbroideryAppearance => ({
  id,
  kind: "text",
  text: value,
  image: null,
  placement,
  offset,
  rotation,
  scale: 1,
  threadHex: style.border,
  varsity: style,
});

// The back: a senior design, top to bottom — a star; "SENIORS" arched in
// maroon tackle twill; "CLASS OF" on a ribbon; a large twill "27"; a star
// over "Twenty Seven" in script between double rules; "THE FUTURE IS
// OURS"; a shield with an "S" in a laurel wreath. Offsets are metres from
// the back zone's centre (0.53 m above the hem), laid out from the
// reference design: it runs from just under the collar to ~8 cm above the
// waistband (lower, the back gathers into the rib and bends the artwork).

const backTwill = (
  id: string,
  value: string,
  offset: [number, number],
  rotation: number,
  capHeight: number,
  borderWeight: number
) =>
  varsity(id, value, "upperBack", offset, rotation, {
    fill: HERO_EMBROIDERY.twill,
    border: HERO_EMBROIDERY.thread,
    borderWeight,
    capHeight,
  });

/**
 * "SENIORS", arched: one twill piece per letter, set along an arc (radius
 * 0.32 m, its top at the "I") and turned to follow it. Spacing from the
 * collegiate face's advance widths (per 100px; cap height 75) plus a gap,
 * so neighbouring satin borders just meet.
 */
const SENIORS_CAP = 0.0432;
const SENIORS_ARC = 0.32;
const SENIORS_TOP = 0.0584;
const SENIORS_PIECES = (() => {
  const letters: [string, number][] = [["S", 60], ["E", 64], ["N", 81], ["I", 39], ["O", 65], ["R", 70], ["S", 60]];
  const gap = 12;
  const unit = SENIORS_CAP / 75;
  const total = letters.reduce((sum, [, w]) => sum + w, 0) + gap * (letters.length - 1);
  let x = 0;
  return letters.map(([letter, w], i) => {
    const along = (x + w / 2 - total / 2) * unit;
    x += w + gap;
    const angle = along / SENIORS_ARC;
    return backTwill(
      `hero-back-seniors-${i}`,
      letter,
      [SENIORS_ARC * Math.sin(angle), SENIORS_TOP - SENIORS_ARC * (1 - Math.cos(angle))],
      -angle,
      SENIORS_CAP,
      0.04
    );
  });
})();

const BACK_EMBROIDERY: EmbroideryAppearance[] = [
  satin("hero-back-star", "star.png", 1, [0.0014, 0.106], 0.121),
  ...SENIORS_PIECES,
  satin("hero-back-banner", "banner.png", 460 / 92, [0, -0.0108], 1.264),
  backTwill("hero-back-27", "27", [-0.0047, -0.1322], 0, 0.1514, 0.022),
  satin("hero-back-script", "script.png", 545 / 112, [-0.007, -0.2606], 1.497),
  satin("hero-back-motto", "motto.png", 400 / 36, [-0.0056, -0.2966], 1.099),
  satin("hero-back-crest", "crest.png", 150 / 104, [-0.0056, -0.3307], 0.412),
];

/**
 * Stitching order on the back (as `HERO_TIMELINE.stitchBack` runs 0 → 1):
 * top to bottom, the arched letters one after another — each piece
 * stitched over its own stretch.
 */
const BACK_STITCH: readonly { id: string; from: number; to: number }[] = BACK_EMBROIDERY.map((e, i) => {
  const from = Math.min(0.82, i * 0.07);
  return { id: e.id, from, to: from + 0.18 };
});

/**
 * The main jacket's embroidery — one array, shared by every colourway: the
 * back design (stitched in during the story), and one student's varsity
 * pieces — a block "F" on the chest (cream twill, crimson satin border) and
 * "09" on the upper sleeve (cream twill, fine navy edge). Brand palette.
 */
const MAIN_EMBROIDERY: EmbroideryAppearance[] = [
  ...BACK_EMBROIDERY,
  varsity("hero-chest-f", "F", "leftChest", [0.006, -0.03], 0, {
    fill: "#FCF0D6",
    border: "#C1121F",
    capHeight: 0.1,
  }),
  varsity("hero-sleeve-09", "09", "leftSleeve", [0, 0], 0.08, {
    fill: "#FCF0D6",
    border: "#003049",
    borderWeight: 0.035,
    capHeight: 0.056,
    face: "athletic",
  }),
];

const appearanceOf = (colours: Colourway, embroidery: EmbroideryAppearance[]): JacketAppearance => ({
  surfaces: {
    body: { hex: colours.body, finish: "felt" },
    sleeves: { hex: colours.sleeves, finish: "leather" },
    trim: { hex: colours.trim, finish: "rib" },
  },
  stripe: colours.stripe,
  embroidery,
  fit: "relaxed",
});

/** Main jacket: one appearance per colourway (stable references). */
const MAIN_APPEARANCES = HERO_COLOURWAYS.map(({ colours }) => appearanceOf(colours, MAIN_EMBROIDERY));

// ---------------------------------------------------------------------------
// Scroll maths — every pose is a pure function of scroll progress.

const segment = (p: number, [a, b]: readonly [number, number]) =>
  MathUtils.clamp((p - a) / (b - a), 0, 1);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** The two shots around p, and the eased blend between them. */
function shotsAround(shots: readonly SolvedShot[], p: number) {
  let i = 0;
  while (i < shots.length - 2 && p >= shots[i + 1].at) i++;
  const a = shots[i];
  const b = shots[i + 1];
  const t = easeInOut(MathUtils.clamp((p - a.at) / (b.at - a.at), 0, 1));
  return { a, b, t };
}

const CAMERA_KEYS = ["x", "lookY", "focusZ", "distance"] as const;
const JACKET_KEYS = ["x", "z", "yaw"] as const;

function cameraAt(shots: readonly SolvedShot[], p: number, out: CameraState) {
  const { a, b, t } = shotsAround(shots, p);
  for (const k of CAMERA_KEYS) out[k] = MathUtils.lerp(a.camera[k], b.camera[k], t);
  return out;
}

// ---------------------------------------------------------------------------

type FidelioSceneProps = {
  /** Render continuously while visible. When false, a still frame. */
  animate: boolean;
  /** Scroll progress (0 → 1) through the pinned story. */
  scroll?: RefObject<number>;
  /** Landscape choreography (desktop) vs portrait. */
  wide?: boolean;
  /**
   * Subtle life on top of the scroll pose: breathing, sway, camera
   * drift and cursor response. Off for reduced-motion users.
   */
  alive?: boolean;
  /**
   * Element that receives the projected screen positions of points on
   * the jacket (CSS variables --a-<id>-x / -y / -v), so annotations can
   * point at the real garment as it moves.
   */
  anchorTarget?: RefObject<HTMLElement | null>;
  /**
   * Also receives those positions as numbers, once per frame after they
   * are published (for drawing that can't be done in CSS, e.g. curves).
   */
  anchorListener?: RefObject<AnchorListener | null>;
  /**
   * A colourway picked in the opening frame (index into
   * HERO_COLOURWAYS): the front jacket takes it until the story begins.
   */
  heroColourway?: number | null;
  /**
   * Phones: body / sleeve / trim colours chosen in the opening frame
   * (instead of a whole colourway); they apply until the story begins.
   */
  heroColours?: Colourway | null;
  /**
   * Called once the jackets have loaded. When given, the page reveals the
   * canvas itself (the hero's entrance), so it shows without a fade.
   */
  onReady?: () => void;
};

/** Screen position (CSS px in the canvas) and visibility (0–1) of an anchor. */
export type AnchorPoint = { x: number; y: number; v: number };
export type AnchorListener = (points: Readonly<Record<AnchorId, AnchorPoint>>) => void;

/**
 * The homepage story scene: one real JACKETEK jacket (the Design page's
 * GLB) filmed by a scroll-driven camera (see three/heroLayout.ts for the
 * choreography). The canvas is transparent: the studio backgrounds are
 * the page's, behind it; here only the jackets, their light and the
 * shadows they cast.
 */
export default function FidelioScene({
  animate,
  scroll,
  wide = true,
  alive = true,
  anchorTarget,
  anchorListener,
  heroColourway = null,
  heroColours = null,
  onReady,
}: FidelioSceneProps) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);

  if (!JACKET_URL) return null;

  return (
    <>
      <Canvas
        frameloop={animate ? "always" : "demand"}
        dpr={[1, 1.75]}
        shadows
        camera={{ fov: HERO_FOV, position: [0, JACKET_HEIGHT / 2, 3], near: 0.05, far: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          // sRGB output is R3F's default; neutral tone mapping keeps
          // fabric colours true while handling highlights gracefully.
          gl.toneMapping = NeutralToneMapping;
          gl.toneMappingExposure = 1;
        }}
        resize={{ offsetSize: true, scroll: false }}
        style={{
          pointerEvents: "none",
          // One-time fade once the model has loaded (not an animation of
          // the jackets — just avoids them popping in half-rendered).
          opacity: ready ? 1 : 0,
          transition: onReady ? undefined : "opacity 1.2s ease",
        }}
      >
        <SceneContent
          url={JACKET_URL}
          scroll={scroll}
          wide={wide}
          alive={alive}
          anchorTarget={anchorTarget}
          anchorListener={anchorListener}
          heroColourway={heroColourway}
          heroColours={heroColours}
          onReady={markReady}
        />
      </Canvas>
      <LoadingIndicator />
    </>
  );
}

/** Smoothed pointer position, −1…1 on each axis (0 = centre). */
type PointerState = { x: number; y: number; tx: number; ty: number };

function SceneContent({
  url,
  scroll,
  wide,
  alive,
  anchorTarget,
  anchorListener,
  heroColourway,
  heroColours,
  onReady,
}: {
  url: string;
  scroll?: RefObject<number>;
  wide: boolean;
  alive: boolean;
  anchorTarget?: RefObject<HTMLElement | null>;
  anchorListener?: RefObject<AnchorListener | null>;
  heroColourway: number | null;
  heroColours: Colourway | null;
  onReady: () => void;
}) {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const aspect = width / Math.max(height, 1);
  const layout = useMemo(() => computeHeroLayout(aspect, wide), [aspect, wide]);

  // The canvas ignores pointer events (it sits under the page), so the
  // cursor is read from the window. Touch devices simply don't move it.
  const pointer = useRef<PointerState>({ x: 0, y: 0, tx: 0, ty: 0 });
  useEffect(() => {
    if (!alive) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      pointer.current.tx = 0;
      pointer.current.ty = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [alive]);
  useFrame((_, delta) => {
    const p = pointer.current;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * HERO_MOTION.pointerEase);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
  }, -1);

  // In the opening frame a colourway picked by the visitor wins; the
  // story itself is told in the first (a state change only on a pick).
  const [colourway, setColourway] = useState(0);
  const [inOpening, setInOpening] = useState(true);
  useFrame(() => {
    const p = scroll?.current ?? 0;
    const opening = p < HERO_PICK_END;
    const next = heroColourway !== null && opening ? heroColourway : 0;
    if (next !== colourway) setColourway(next);
    if (opening !== inOpening) setInOpening(opening);
  });
  // Phones: colours chosen per part in the opening frame — the same
  // appearance (felt body, leather sleeves, rib trim) the renderer tints
  // with each finish's own light response.
  const customAppearance = useMemo(
    () => (heroColours ? appearanceOf(heroColours, MAIN_EMBROIDERY) : null),
    [heroColours]
  );
  const mainAppearance = customAppearance && inOpening ? customAppearance : MAIN_APPEARANCES[colourway];

  // The light on the jacket through the story (ATMOSPHERE).
  const atmosphere = useAtmosphere(scroll);

  return (
    <>
      <HeroCamera layout={layout} scroll={scroll} pointer={pointer} alive={alive} />
      <StudioLighting />
      <Studio layout={layout} atmosphere={atmosphere} />

      <Suspense fallback={null}>
        <Lean pointer={pointer}>
          <MainJacket
            appearance={mainAppearance}
            url={url}
            layout={layout}
            scroll={scroll}
            alive={alive}
            anchorTarget={anchorTarget}
            anchorListener={anchorListener}
          />
        </Lean>
        <OnMounted onMounted={onReady} />
      </Suspense>
    </>
  );
}

// ---------------------------------------------------------------------------
// Atmosphere — the light on the jacket through the story

type Atmosphere = {
  /** Warm rim light on the jacket's edges (0–1): the dark moments. */
  rim: number;
};

/** The rim light's colour: warm, softened toward the studio's ivory light. */
const RIM_COLOUR = new Color("#E8C48A").lerp(new Color("#FBFAF6"), 0.85);
/** The broad wash on the jackets (a neutral, lightly warm white). */
const WASH_COLOUR = new Color("#FBFAF6").lerp(new Color("#ffffff"), 0.5);

/**
 * The light at the current scroll position (ATMOSPHERE). Computed before
 * the frame's other updates; read by the studio.
 */
function useAtmosphere(scroll: RefObject<number> | undefined) {
  const state = useMemo<Atmosphere>(() => ({ rim: 0 }), []);
  useFrame(() => {
    state.rim = atmosphereAt(scroll?.current ?? 0).rim;
  }, -2);
  return state;
}

/**
 * The film camera: follows the solved shots with scroll, plus a very
 * slow handheld drift and a slight shift with the cursor.
 */
function HeroCamera({
  layout,
  scroll,
  pointer,
  alive,
}: {
  layout: HeroLayout;
  scroll?: RefObject<number>;
  pointer: RefObject<PointerState>;
  alive: boolean;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef<CameraState>({ ...layout.shots[0].camera });

  useLayoutEffect(() => {
    camera.fov = HERO_FOV;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, layout, invalidate]);

  useFrame(({ clock }) => {
    const c = cameraAt(layout.shots, scroll?.current ?? 0, state.current);
    const time = alive ? clock.elapsedTime : 0;
    const w = (time / HERO_MOTION.driftSeconds) * Math.PI * 2;
    const driftX = Math.sin(w) * HERO_MOTION.drift;
    const driftY = Math.sin(w * 0.7 + 1.3) * HERO_MOTION.drift * 0.5;
    const px = (pointer.current?.x ?? 0) * HERO_MOTION.pointerShift;
    const py = (pointer.current?.y ?? 0) * HERO_MOTION.pointerShift * 0.5;
    // Shifts scale with distance, so close-ups don't swing wildly.
    const s = MathUtils.clamp(c.distance / 4, 0.35, 1);
    camera.position.set(
      c.x + (driftX + px) * s,
      c.lookY + Math.tan(CAMERA_PITCH) * c.distance + (driftY - py) * s,
      c.focusZ + c.distance
    );
    camera.lookAt(c.x + driftX * 0.5 * s, c.lookY, c.focusZ);
  });
  return null;
}

/**
 * The photo studio's light and its shadows: a soft overhead key that
 * casts real shadows (PCSS-softened, so they fall off naturally), a
 * broad wash, and a warm rim for the dark moments. The cove itself is
 * invisible — a shadow catcher — so the jackets' shadows fall onto the
 * page's studio background behind the transparent canvas.
 */
function Studio({ layout, atmosphere }: { layout: HeroLayout; atmosphere: Atmosphere }) {
  const key = useRef<DirectionalLight>(null);
  const wash = useRef<SpotLight>(null);
  const rim = useRef<DirectionalLight>(null);
  const { visible, floorY } = layout;
  const hero = layout.shots[0].camera;

  useFrame(() => {
    if (wash.current) {
      wash.current.color.copy(WASH_COLOUR);
      wash.current.intensity = 0.9 * (1 - 0.65 * atmosphere.rim);
    }
    if (rim.current) {
      rim.current.intensity = 2.6 * atmosphere.rim;
      rim.current.color.copy(RIM_COLOUR);
    }
  });

  useLayoutEffect(() => {
    // Lights aim at their targets; targets must be in the scene graph.
    const targets: Object3D[] = [];
    if (key.current) {
      key.current.target.position.set(0, floorY, -0.2);
      targets.push(key.current.target);
    }
    if (wash.current) {
      wash.current.target.position.set(0, hero.lookY, -1.6);
      targets.push(wash.current.target);
    }
    targets.forEach((t) => key.current?.parent?.add(t));
    return () => targets.forEach((t) => t.removeFromParent());
  }, [floorY, hero.lookY]);

  const reach = Math.max(visible.width, visible.height);

  return (
    <>
      <SoftShadows size={28} samples={12} focus={0.6} />
      <Cyclorama
        floorY={floorY}
        backZ={-1.6}
        frontZ={hero.distance + 2}
        halfWidth={reach * 2 + 3}
        top={hero.lookY + reach * 1.8}
        radius={0.9}
        color="#0B1A26"
        shadowOnly={0.22}
      />
      {/* Warm rim from behind, for the jacket's edges in the dark moments. */}
      <directionalLight ref={rim} position={[-1.6, 2.4, -1.4]} color="#E8C48A" intensity={0} />
      <directionalLight
        ref={key}
        position={[0.7, floorY + 4.5, 1.8]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      <spotLight
        ref={wash}
        position={[0, hero.lookY + 1.2, hero.distance * 0.6]}
        angle={0.9}
        penumbra={1}
        decay={0}
        intensity={0.9}
      />
    </>
  );
}

/** Rendered inside the Suspense boundary: fires once everything has loaded. */
function OnMounted({ onMounted }: { onMounted: () => void }) {
  useEffect(onMounted, [onMounted]);
  return null;
}

/** A gentle lean of the products toward the cursor. */
function Lean({ pointer, children }: { pointer: RefObject<PointerState>; children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = (pointer.current?.x ?? 0) * HERO_MOTION.pointerYaw;
    group.current.rotation.x = (pointer.current?.y ?? 0) * HERO_MOTION.pointerPitch;
  });
  return <group ref={group}>{children}</group>;
}

/** Slow breathing float and sway, out of step between the jackets. */
function life(time: number, phase: number) {
  const breath = Math.sin((time / HERO_MOTION.breathSeconds) * Math.PI * 2 + phase);
  const sway = Math.sin((time / HERO_MOTION.swaySeconds) * Math.PI * 2 + phase * 1.3);
  return { lift: breath * HERO_MOTION.float, sway: sway * HERO_MOTION.sway };
}

// ---------------------------------------------------------------------------
// Grounding

let groundTexture: CanvasTexture | null = null;

/** Soft elliptical occlusion (greyscale, for an alphaMap). Shared. */
function getGroundTexture() {
  if (groundTexture) return groundTexture;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // A dense core right under the hem (where the garment is closest to
  // the floor), falling quickly into a wide soft spread — the profile of
  // real contact occlusion; a broad-only falloff reads as floating.
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.18, "#e6e6e6");
  g.addColorStop(0.38, "#7a7a7a");
  g.addColorStop(0.7, "#262626");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  groundTexture = new CanvasTexture(c);
  return groundTexture;
}

/**
 * Ambient occlusion where a garment hangs close to the floor: a soft
 * darkening directly beneath it (the real shadow falls behind, from the
 * key). Together they seat the jacket in the studio.
 */
function GroundOcclusion({ floorY, opacity = 0.42 }: { floorY: number; opacity?: number }) {
  const texture = useMemo(getGroundTexture, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, floorY + 0.001, 0.02]} renderOrder={-1}>
      <planeGeometry args={[0.9, 0.36]} />
      <meshBasicMaterial
        color="#0B1A26"
        alphaMap={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Jackets

const raycaster = new Raycaster();
const tmp = new Vector3();
const toCamera = new Vector3();

type Anchor = { id: AnchorId; local: Vector3; normal: Vector3 };

/**
 * The main jacket: carries the whole story. Its pose (position, turn)
 * follows the shots; it also drives its embroidery's stitching-in and
 * publishes where its annotated parts are on screen.
 */
function MainJacket({
  appearance,
  url,
  layout,
  scroll,
  alive,
  anchorTarget,
  anchorListener,
}: {
  appearance: JacketAppearance;
  url: string;
  layout: HeroLayout;
  scroll?: RefObject<number>;
  alive: boolean;
  anchorTarget?: RefObject<HTMLElement | null>;
  anchorListener?: RefObject<AnchorListener | null>;
}) {
  const group = useRef<Group>(null);
  const turn = useRef<Group>(null);
  const anchors = useRef<Anchor[] | null>(null);
  const points = useMemo(
    () =>
      Object.fromEntries((Object.keys(ANCHORS) as AnchorId[]).map((id) => [id, { x: 0, y: 0, v: 0 }])) as Record<
        AnchorId,
        AnchorPoint
      >,
    []
  );
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const first = layout.shots[0].jacket;

  useFrame(({ clock }) => {
    const node = group.current;
    const inner = turn.current;
    if (!node || !inner) return;
    const p = scroll?.current ?? 0;

    const { a, b, t } = shotsAround(layout.shots, p);
    const pose = { x: 0, z: 0, yaw: 0 };
    for (const k of JACKET_KEYS) pose[k] = MathUtils.lerp(a.jacket[k], b.jacket[k], t);
    const { lift, sway } = life(alive ? clock.elapsedTime : 0, 0);
    node.position.set(pose.x, 0, pose.z);
    inner.position.y = lift;
    inner.rotation.y = pose.yaw + sway;

    // Embroidery stitching in (reverses exactly on the way back).
    const back = segment(p, HERO_TIMELINE.stitchBack);
    for (const { id, from, to } of BACK_STITCH) setStitchReveal(id, MathUtils.clamp((back - from) / (to - from), 0, 1));

    publishAnchors(inner);
  });

  /** Projects the annotated parts to screen pixels as CSS variables. */
  function publishAnchors(inner: Group) {
    const el = anchorTarget?.current;
    if (!el) return;
    if (!anchors.current) anchors.current = findAnchors(inner);
    if (!anchors.current) return;
    inner.updateWorldMatrix(true, false);
    for (const { id, local, normal } of anchors.current) {
      tmp.copy(local).applyMatrix4(inner.matrixWorld);
      toCamera.copy(camera.position).sub(tmp).normalize();
      const facing = normal.clone().transformDirection(inner.matrixWorld).dot(toCamera);
      tmp.project(camera);
      const point = points[id];
      point.x = ((tmp.x + 1) / 2) * size.width;
      point.y = ((1 - tmp.y) / 2) * size.height;
      point.v = MathUtils.smoothstep(facing, -0.2, 0.15);
      el.style.setProperty(`--a-${id}-x`, `${point.x}px`);
      el.style.setProperty(`--a-${id}-y`, `${point.y}px`);
      el.style.setProperty(`--a-${id}-v`, point.v.toFixed(3));
    }
    anchorListener?.current?.(points);
  }

  return (
    <group ref={group} position={[first.x, 0, first.z]}>
      <group ref={turn}>
        <JacketModel appearance={appearance} silhouette="male" url={url} castShadow />
      </group>
      <GroundOcclusion floorY={layout.floorY} />
    </group>
  );
}

/**
 * Finds the real surface under each anchor by ray-casting the jacket
 * from the front (once, after it has loaded). Stored in the jacket's
 * own space, so they follow every movement.
 */
function findAnchors(inner: Group): Anchor[] | null {
  const meshes: Mesh[] = [];
  inner.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  if (!meshes.length) return null;

  inner.updateWorldMatrix(true, true);
  const inverse = inner.matrixWorld.clone().invert();
  const forward = new Vector3(0, 0, -1).transformDirection(inner.matrixWorld);
  const backward = forward.clone().negate();
  return (Object.keys(ANCHORS) as AnchorId[]).map((id) => {
    const [x, y] = ANCHORS[id];
    const back = BACK_ANCHORS.includes(id);
    const side = back ? -1 : 1;
    raycaster.set(new Vector3(x, y, 2 * side).applyMatrix4(inner.matrixWorld), back ? backward : forward);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const local = hit ? hit.point.clone().applyMatrix4(inverse) : new Vector3(x, y, 0.1 * side);
    const normal =
      hit?.face?.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .transformDirection(inverse) ?? new Vector3(0, 0, side);
    return { id, local, normal };
  });
}
