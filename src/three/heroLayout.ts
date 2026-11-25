/**
 * Homepage story scene: jackets, camera and scroll choreography.
 *
 * ONE pinned 3D scene tells the whole story as the user scrolls. The
 * jacket hangs in a real studio, always at the same height above its
 * floor (so its contact shadow stays true); the story is FILMED: a
 * camera trucks, pushes in and goes macro, while the jacket turns.
 *
 *   HERO       one jacket, right; the words and call to action left
 *   01 IDEA    it crosses the frame and is framed left
 *   02 JACKET  centred in the dark studio, turning — annotated
 *   03 CRAFT   macro: collar, snaps, rib, leather (in a panel)
 *   04 STITCH  it turns its back; the embroidery stitches in
 *   05 YOURS   facing again — "Made for your moment."
 *
 * Plain data + maths (no three.js import). Shots are authored in
 * SCREEN terms (where the jacket sits in the frame, how close the
 * camera is), then solved into a camera for the current viewport.
 *
 * The jacket GLB is normalised to ~0.72–0.74 m tall, hem at y = 0.
 */

export const JACKET_HEIGHT = 0.74;
const JACKET_WIDTH = 0.66;
/** Height of the jacket's centre above its hem. */
const CENTRE_Y = JACKET_HEIGHT / 2;

export const HERO_FOV = 24;
/** Product-photography camera: a few degrees above, looking gently down. */
export const CAMERA_PITCH = (7 * Math.PI) / 180;

/** The opening studio's mid tone (behind everything, before the gradients paint): Cream. */
export const STUDIO_COLOUR = "#FCF0D6";
/** The floor sits this far under the hems — close enough to ground them. */
const HANG = 0.022;

// ---------------------------------------------------------------------------
// Jackets

/** `stripe`: the rib stripes' own colour (omitted: the sleeves'). */
export type Colourway = { body: string; sleeves: string; trim: string; stripe?: string };

/**
 * The site's jacket: dark navy wool body; off-white leather sleeves;
 * rib trim (collar, cuffs, waistband) knit in alternating navy — the
 * body's — and white stripes.
 */
const NAVY_WHITE: Colourway = { body: "#16223A", sleeves: "#F2EFE8", trim: "#16223A", stripe: "#F2EFE8" };
/** Deep navy wool body; ivory leather sleeves; navy trim. */
const NAVY_IVORY: Colourway = { body: "#16223A", sleeves: "#E9E3D7", trim: "#16223A" };
const BURGUNDY_IVORY: Colourway = { body: "#4E1820", sleeves: "#E9E3D7", trim: "#4E1820" };
const FOREST_CAMEL: Colourway = { body: "#1F3A2E", sleeves: "#AE8A5E", trim: "#1F3A2E" };

/**
 * The colourways offered in the opening frame ("The Varsity — 01"): the
 * front jacket takes the visitor's pick until the story begins.
 */
export const HERO_COLOURWAYS = [
  // `id`: the display name's key (locales: hero.colourway.<id>).
  { colours: NAVY_WHITE, id: "navyOffWhite" },
  { colours: NAVY_IVORY, id: "navyIvory" },
  { colours: BURGUNDY_IVORY, id: "maroonIvory" },
  { colours: FOREST_CAMEL, id: "forestCamel" },
] as const;

/**
 * Embroidery on the main jacket's back — the senior design ("SENIORS /
 * CLASS OF / 27 / Twenty Seven / THE FUTURE IS OURS", a crest): maroon
 * tackle twill with cream satin (the satin artwork's own colours are in
 * public/assets/embroidery/back) — and a small chest mark.
 */
export const HERO_EMBROIDERY = {
  /** Cream satin thread: the twill pieces' borders (brand Cream). */
  thread: "#FCF0D6",
  /** Oxblood tackle twill: "SENIORS" and "27" (brand Oxblood). */
  twill: "#780000",
  chest: "Jacketek",
};

// ---------------------------------------------------------------------------
// Scroll timeline (0 → 1 across the pinned track). Pure functions of
// scroll position: they move at the user's pace and reverse exactly.

export type Range = readonly [number, number];

/** Text beats: [in-start, in-end, out-start, out-end]. */
export type Beat = readonly [number, number, number, number];

export const HERO_TIMELINE = {
  /** Hero labels / tagline leave as the story begins. */
  chromeExit: [0.02, 0.07] as Range,
  /** The phones' wordmark leaves upward as the story begins. */
  wordmarkExit: [0.05, 0.13] as Range,

  // Text beats (01–05; "Yours" is the conclusion).
  idea: [0.14, 0.2, 0.265, 0.295] as Beat,
  jacket: [0.305, 0.34, 0.455, 0.48] as Beat,
  craft: [0.5, 0.54, 0.585, 0.61] as Beat,
  stitch: [0.63, 0.665, 0.72, 0.745] as Beat,
  finale: [0.765, 0.81, 2, 2] as Beat,

  /** Back embroidery stitching in, row by row. */
  stitchBack: [0.645, 0.7] as Range,
  /** Chest mark stitching in (as the jacket faces front again, in 05). */
  stitchChest: [0.775, 0.8] as Range,
};

/**
 * Where the story ends (in timeline units): the pinned track maps its
 * whole length onto 0 → STORY_END, so nothing is left to scroll through
 * after the last beat has settled.
 */
export const STORY_END = 0.86;

/** Until here, a colourway picked in the opening frame wins. */
export const HERO_PICK_END = 0.1;

// ---------------------------------------------------------------------------
// Atmosphere — which studio the story is in (keyed to the same progress
// as the shots, interpolated, so it reverses exactly). The backgrounds
// are the design's CSS studios behind a transparent canvas; the jacket
// itself is never touched.
//
//   world  the section's colour world: a cream room in order Studio,
//          Cream, Cream paper, Navy (one dramatic chapter), Cream. The
//          background gradient (centre / mid / edge), the light behind
//          the jacket, and the text roles that read on it. Interpolated, so
//          one world melts into the next.
//   paper  0 -> 1: 03 The craft (the macro is clipped to its panel)
//   rim    warm rim light on the jacket's edges (the dark grounds)

/**
 * The palette (the brand's source of truth; mirrored as --brand-* in
 * styles/index.css). Navy anchors, Cream is the light surface, Crimson
 * acts, Oxblood deepens, Red details, Dusty Blue supports.
 */
export const PALETTE = {
  navy: "#003049",
  cream: "#FCF0D6",
  crimson: "#C1121F",
  oxblood: "#780000",
  red: "#AE1F23",
  dusty: "#669BBC",
  /** Derived (navy x dusty, 50/50): secondary type on cream, 5.5:1. */
  navySoft: "#336683",
} as const;

/** One colour world: its ground, light and type. */
export type Mood = {
  center: string;
  mid: string;
  edge: string;
  glow: string;
  glowStrength: number;
  /** 1 on dark grounds (the nav goes transparent, the grain softer). */
  dark: number;
  /** Dusty-blue ambient light in the cream room (0..1). */
  ambient: number;
  /** The faint pinstripe wall behind the jacket (0..1). */
  wall: number;
  /** Text roles: headline, its second line, body, labels, numerals. */
  head: string;
  accent: string;
  body: string;
  muted: string;
  numeral: string;
  /** Text on a headline-coloured fill (the logo tag's letter). */
  onHead: string;
  /** Primary button fill, label and hover; link hover / focus / selection. */
  btn: string;
  btnText: string;
  btnHover: string;
  link: string;
  /** Decorative rules and details. */
  rule: string;
  /** The logo tag's stitched edge. */
  stitch: string;
};

const P = PALETTE;

/**
 * Type per ground, chosen for contrast (WCAG, computed):
 *  - on Navy: Cream ink (12:1), Dusty Blue secondary (4.6:1). Crimson
 *    only as fills and thread: as text on navy it would read 2.2:1.
 *  - on Cream: Navy ink (12:1), Crimson accent (5.5:1), soft-navy
 *    secondary and numerals (5.5:1), supporting Red accent rules.
 * The primary action is Crimson with a Cream label on every ground,
 * deepening to Oxblood on hover.
 */
const ACTION = { btn: P.crimson, btnText: P.cream, btnHover: P.oxblood };
const ON_NAVY = {
  head: P.cream, accent: P.dusty, body: P.cream, muted: P.dusty, numeral: P.dusty,
  onHead: P.navy, link: P.dusty, rule: P.crimson, stitch: P.crimson, ...ACTION,
};
const ON_CREAM = {
  head: P.navy, accent: P.crimson, body: P.navy, muted: P.navySoft, numeral: P.navySoft,
  onHead: P.cream, link: P.crimson, rule: P.red, stitch: P.crimson, ...ACTION,
};

/**
 * The worlds (see styles/index.css for how they're painted). The site is a
 * CREAM ROOM: a softly lit studio the jacket hangs in. Gradient stops are
 * the palette and blends of it (cream lifted toward white for light pools,
 * cream with a breath of navy/oxblood for the shadowed edges), never a new
 * hue. Navy appears as ONE dramatic chapter (04), so it lands.
 */
export const MOODS = {
  /** Hero + 01: the warm cream studio, lit from the upper left. */
  studio: {
    center: "#FFF8EA", mid: P.cream, edge: "#DFCDB4", glow: "#FFFBF2", glowStrength: 0.7, dark: 0, ambient: 0.42, wall: 1,
    ...ON_CREAM,
  },
  /** 02 The jacket: cream with the dusty-blue ambient turned up. */
  cream: {
    center: "#FEF6E6", mid: "#F6E8CF", edge: "#D3C6B3", glow: "#FFFBF2", glowStrength: 0.6, dark: 0, ambient: 0.5, wall: 0.7,
    ...ON_CREAM,
  },
  /** 03 The craft: cream paper (the macro sits in its Navy panel). */
  paper: {
    center: P.cream, mid: "#F4E6CD", edge: "#DCC9B3", glow: P.cream, glowStrength: 0.5, dark: 0, ambient: 0.1, wall: 0.25,
    ...ON_CREAM,
  },
  /** 04 Embroidery: the one dramatic Navy chapter, lit from within. */
  navy: {
    center: "#1F506B", mid: P.navy, edge: "#00131D", glow: "#A2BDC6", glowStrength: 0.4, dark: 1, ambient: 0, wall: 0,
    ...ON_NAVY,
  },
  /** 05 Yours: back into the cream room (the oxblood MOMENT sits on it). */
  finale: {
    center: "#FFF8EA", mid: P.cream, edge: "#DCC8AE", glow: "#FFFBF2", glowStrength: 0.65, dark: 0, ambient: 0.32, wall: 0.55,
    ...ON_CREAM,
  },
} satisfies Record<string, Mood>;

export type AtmosphereKey = { at: number; paper: number; rim: number; mood: Mood };

export const ATMOSPHERE: readonly AtmosphereKey[] = [
  // HERO and 01 IDEA — the cream studio; a soft rim separates the jacket.
  { at: 0, paper: 0, rim: 0.6, mood: MOODS.studio },
  { at: 0.05, paper: 0, rim: 0.6, mood: MOODS.studio },
  { at: 0.16, paper: 0, rim: 0.5, mood: MOODS.studio },
  { at: 0.29, paper: 0, rim: 0.5, mood: MOODS.studio },
  // 02 JACKET — cream, dusty-blue ambient.
  { at: 0.315, paper: 0, rim: 0.4, mood: MOODS.cream },
  { at: 0.475, paper: 0, rim: 0.4, mood: MOODS.cream },
  // 03 CRAFT — cream paper; the macro sits in its Navy panel.
  { at: 0.5, paper: 1, rim: 1, mood: MOODS.paper },
  { at: 0.598, paper: 1, rim: 1, mood: MOODS.paper },
  // 04 EMBROIDERY — the dramatic Navy chapter; a strong rim keeps the jacket's edges.
  { at: 0.625, paper: 0, rim: 1.1, mood: MOODS.navy },
  { at: 0.75, paper: 0, rim: 1.1, mood: MOODS.navy },
  // 05 YOURS — back to cream (the footer below is Navy, through a stitched seam).
  { at: 0.78, paper: 0, rim: 0.5, mood: MOODS.finale },
  { at: 1, paper: 0, rim: 0.5, mood: MOODS.finale },
];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return x.map((v, i) => Math.round(v + (y[i] - v) * t)) as [number, number, number];
};

const COLOUR_KEYS = ["center", "mid", "edge", "glow", "head", "accent", "body", "muted", "numeral", "onHead", "btn", "btnText", "btnHover", "link", "rule", "stitch"] as const;
export type WorldColours = Record<(typeof COLOUR_KEYS)[number], [number, number, number]>;

/**
 * Type roles never blend: each is always one exact palette colour,
 * switching halfway through a change of world (grounds blend).
 */
const TYPE_KEYS: ReadonlySet<string> = new Set(["head", "accent", "body", "muted", "numeral", "onHead", "btnText", "link", "rule", "stitch"]);

/** The atmosphere at p (eased between keys); colours as [r, g, b]. */
export function atmosphereAt(p: number) {
  let i = 0;
  while (i < ATMOSPHERE.length - 2 && p >= ATMOSPHERE[i + 1].at) i++;
  const a = ATMOSPHERE[i];
  const b = ATMOSPHERE[i + 1];
  let t = Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at)));
  t = t * t * (3 - 2 * t);
  const colours = Object.fromEntries(COLOUR_KEYS.map((k) => [k, TYPE_KEYS.has(k) ? rgb(t < 0.5 ? a.mood[k] : b.mood[k]) : mix(a.mood[k], b.mood[k], t)])) as WorldColours;
  return {
    dark: a.mood.dark + (b.mood.dark - a.mood.dark) * t,
    paper: a.paper + (b.paper - a.paper) * t,
    rim: a.rim + (b.rim - a.rim) * t,
    glowStrength: a.mood.glowStrength + (b.mood.glowStrength - a.mood.glowStrength) * t,
    ambient: a.mood.ambient + (b.mood.ambient - a.mood.ambient) * t,
    wall: a.mood.wall + (b.mood.wall - a.mood.wall) * t,
    colours,
  };
}

/** The chapter the story has reached at p (for the chapter index). */
export function chapterAt(p: number): number {
  let reached = -1;
  STORY_BEATS.forEach((id, i) => {
    if (p >= HERO_TIMELINE[id][0]) reached = i;
  });
  return reached;
}

// ---------------------------------------------------------------------------
// Anchors — points on the garment that annotations point at (jacket
// space: x across, +x = wearer's left = viewer's right; y up from hem).
// Depth is found at runtime by ray-casting the real surface.

export const ANCHORS = {
  body: [-0.1, 0.44],
  sleeve: [0.265, 0.42],
  fit: [-0.15, 0.13],
  snaps: [0.0, 0.27],
  // The craft macro's tags: collar, a chest snap, the near sleeve.
  collar: [-0.07, 0.68],
  placket: [0.0, 0.5],
  sleeveNear: [-0.265, 0.42],
  /** The end of the back's arched "SENIORS" (found from behind; see BACK_ANCHORS). */
  backK: [-0.14, 0.55],
} as const;
export type AnchorId = keyof typeof ANCHORS;
/** Anchors on the back of the garment: ray-cast from behind. */
export const BACK_ANCHORS: readonly AnchorId[] = ["backK"];

// ---------------------------------------------------------------------------
// Story beats, in order (text + the chapter rail): 01–05.

export const STORY_BEATS = ["idea", "jacket", "craft", "stitch", "finale"] as const;
export type StoryBeatId = (typeof STORY_BEATS)[number];

/** Which beat is interactive at progress p (a little inside its window). */
export function beatAt(p: number): StoryBeatId | null {
  for (const id of STORY_BEATS) {
    const [a, b, c] = HERO_TIMELINE[id];
    if (p >= a + (b - a) * 0.5 && p <= c) return id;
  }
  return null;
}

/**
 * How far into a beat's in-window its section counts as arrived: the
 * jacket has all but reached its new framing (each beat's in-window ends
 * as its shot lands). From here its words play in on their own (HeroStory)
 * — scroll moves between sections, it doesn't reveal them line by line.
 */
const ARRIVED_AT = 0.75;

/** Whether a beat's section has arrived and not yet fully left at p. */
export function hasArrived([a, b, , outEnd]: Beat, p: number): boolean {
  return p >= a + (b - a) * ARRIVED_AT && (outEnd > 1 || p <= outEnd);
}

/** The section that has arrived at p (its words shown), if any. */
export function arrivedAt(p: number): StoryBeatId | null {
  return STORY_BEATS.find((id) => hasArrived(HERO_TIMELINE[id], p)) ?? null;
}

// ---------------------------------------------------------------------------
// Shots

type JacketPose = { x: number; z: number; yaw: number };

/**
 * Where the jacket sits in the frame. The point `fy` of the jacket
 * (height above the hem; default: its centre) lands at screen (sx, sy),
 * 0–1 from the top-left. `zoom` 1 = the establishing shot; 2 = twice as
 * close. `cx` pins the camera's world x instead of `sx`.
 */
type Frame = { sx?: number; cx?: number; sy: number; zoom: number; fy?: number };

type Shot = { at: number; jacket: JacketPose; frame: Frame };

type LayoutSpec = {
  /** Jacket height as a fraction of the viewport height at zoom 1. */
  jacketFraction: number;
  /** Visible width needed at zoom 1 (world units). */
  widthNeeded: number;
  /** The main jacket's story, one shot per key. */
  shots: readonly Shot[];
};

const TURN = Math.PI * 2;

/** Desktop / landscape. */
const WIDE: LayoutSpec = {
  jacketFraction: 0.72,
  widthNeeded: (0.8 + JACKET_WIDTH) / 0.9,
  // Resting framings follow the design (1440 × 900 mockup bounds).
  shots: [
    // HERO — the one jacket anchors the right of the frame (the words and
    // call to action hold the left), turned a touch toward them; then a
    // slow push-in.
    { at: 0, jacket: { x: -0.14, z: 0.06, yaw: -0.22 }, frame: { sx: 0.7, sy: 0.49, zoom: 0.92 } },
    { at: 0.05, jacket: { x: -0.14, z: 0.06, yaw: -0.22 }, frame: { sx: 0.7, sy: 0.49, zoom: 0.95 } },
    // 01 IDEA — framed left, turned toward the words.
    { at: 0.19, jacket: { x: -0.14, z: 0.06, yaw: 0.36 }, frame: { sx: 0.32, sy: 0.495, zoom: 1.04 } },
    { at: 0.28, jacket: { x: -0.14, z: 0.06, yaw: 0.46 }, frame: { sx: 0.32, sy: 0.495, zoom: 1.06 } },
    // 02 JACKET — centred in the dark studio, turning slowly under the
    // annotations (smaller, so the callouts sit beside it).
    { at: 0.34, jacket: { x: -0.14, z: 0.06, yaw: -0.42 }, frame: { sx: 0.5, sy: 0.456, zoom: 0.93 } },
    { at: 0.46, jacket: { x: -0.14, z: 0.06, yaw: 0.42 }, frame: { sx: 0.5, sy: 0.456, zoom: 0.95 } },
    // 03 CRAFT — macro on collar, snaps and sleeve head, in the panel
    // (centred right of it, so the near sleeve enters at its left edge).
    { at: 0.53, jacket: { x: -0.14, z: 0.06, yaw: 0.2 }, frame: { sx: 0.8, sy: 0.54, fy: 0.5, zoom: 2 } },
    { at: 0.6, jacket: { x: -0.14, z: 0.06, yaw: 0.34 }, frame: { sx: 0.8, sy: 0.54, fy: 0.5, zoom: 2.1 } },
    // 04 STITCH — its back, large and cropped by the bottom edge.
    { at: 0.655, jacket: { x: -0.14, z: 0.06, yaw: Math.PI - 0.14 }, frame: { sx: 0.354, sy: 0.68, zoom: 1.5 } },
    { at: 0.73, jacket: { x: -0.14, z: 0.06, yaw: Math.PI + 0.1 }, frame: { sx: 0.354, sy: 0.68, zoom: 1.52 } },
    // 05 YOURS — facing again, centred between the words.
    { at: 0.8, jacket: { x: -0.14, z: 0.06, yaw: TURN - 0.06 }, frame: { sx: 0.51, sy: 0.457, zoom: 0.86 } },
    { at: STORY_END, jacket: { x: -0.14, z: 0.06, yaw: TURN + 0.02 }, frame: { sx: 0.51, sy: 0.457, zoom: 0.84 } },
  ],
};

/**
 * Mobile / portrait. The opening frame: one jacket, centred (≈ 44 % of the
 * stage tall), in front of the embroidered wordmark — whose letters show
 * above its shoulders — with the intro under it (no colour row: colours
 * are chosen in Design Your Jacket). Then
 * the whole jacket stays in the upper part of the stage — its hem just
 * above 58 %, where the words' area begins (HeroStory's LOWER) — and the
 * story turns it rather than cropping in, so it never runs into the text.
 * (Fractions of the stage, so phones of any height keep the composition.)
 */
const TALL: LayoutSpec = {
  jacketFraction: 0.46,
  widthNeeded: 0.78,
  shots: [
    // HERO — the single jacket, centred between the wordmark and the call
    // to action.
    { at: 0, jacket: { x: -0.1, z: 0.08, yaw: 0.12 }, frame: { sx: 0.5, sy: 0.47, zoom: 1 } },
    { at: 0.05, jacket: { x: -0.1, z: 0.08, yaw: 0.12 }, frame: { sx: 0.5, sy: 0.47, zoom: 1.02 } },
    { at: 0.19, jacket: { x: -0.1, z: 0.08, yaw: 0.3 }, frame: { sx: 0.5, sy: 0.335, zoom: 1 } },
    { at: 0.28, jacket: { x: -0.1, z: 0.08, yaw: 0.4 }, frame: { sx: 0.5, sy: 0.335, zoom: 1.02 } },
    { at: 0.34, jacket: { x: -0.1, z: 0.08, yaw: -0.42 }, frame: { sx: 0.5, sy: 0.335, zoom: 1 } },
    { at: 0.46, jacket: { x: -0.1, z: 0.08, yaw: 0.42 }, frame: { sx: 0.5, sy: 0.335, zoom: 1.02 } },
    { at: 0.53, jacket: { x: -0.1, z: 0.08, yaw: 0.66 }, frame: { sx: 0.5, sy: 0.335, zoom: 1.02 } },
    { at: 0.6, jacket: { x: -0.1, z: 0.08, yaw: 0.82 }, frame: { sx: 0.5, sy: 0.335, zoom: 1.04 } },
    { at: 0.655, jacket: { x: -0.1, z: 0.08, yaw: Math.PI - 0.1 }, frame: { sx: 0.5, sy: 0.335, zoom: 1 } },
    { at: 0.73, jacket: { x: -0.1, z: 0.08, yaw: Math.PI + 0.1 }, frame: { sx: 0.5, sy: 0.335, zoom: 1.02 } },
    { at: 0.8, jacket: { x: -0.1, z: 0.08, yaw: TURN - 0.06 }, frame: { sx: 0.5, sy: 0.335, zoom: 1 } },
    { at: STORY_END, jacket: { x: -0.1, z: 0.08, yaw: TURN + 0.02 }, frame: { sx: 0.5, sy: 0.335, zoom: 1 } },
  ],
};

/** The solved camera: looks at (x, lookY, focusZ) from `distance` away. */
export type CameraState = { x: number; lookY: number; focusZ: number; distance: number };
export type SolvedShot = { at: number; jacket: JacketPose; camera: CameraState };

export type HeroLayout = {
  shots: readonly SolvedShot[];
  /** Visible area at zoom 1, at the jacket (world units). */
  visible: { width: number; height: number };
  /** Studio floor height. */
  floorY: number;
};

/**
 * Solves the authored shots into cameras for a canvas of the given
 * aspect ratio. `wide` picks the landscape choreography.
 */
export function computeHeroLayout(aspect: number, wide: boolean): HeroLayout {
  const spec = wide ? WIDE : TALL;
  const tanHalf = Math.tan(((HERO_FOV / 2) * Math.PI) / 180);

  let height = JACKET_HEIGHT / spec.jacketFraction;
  if (height * aspect < spec.widthNeeded) height = spec.widthNeeded / aspect;
  const width = height * aspect;

  const shots = spec.shots.map(({ at, jacket, frame }) => {
    const h = height / frame.zoom;
    const w = h * aspect;
    const fy = frame.fy ?? CENTRE_Y;
    const x = frame.cx ?? jacket.x - ((frame.sx ?? 0.5) - 0.5) * w;
    return {
      at,
      jacket,
      camera: {
        x,
        lookY: fy - (0.5 - frame.sy) * h,
        focusZ: jacket.z,
        distance: h / 2 / tanHalf,
      },
    };
  });

  return { shots, visible: { width, height }, floorY: -HANG };
}

/**
 * Life on top of the scroll choreography: subtle, slow, never robotic.
 * Pure additions — the scroll pose stays the source of truth — and off
 * entirely for reduced-motion users.
 */
export const HERO_MOTION = {
  /** Breathing: vertical float (m), sway (rad). */
  float: 0.003,
  sway: 0.018,
  /** Seconds per breath / sway cycle. */
  breathSeconds: 6.5,
  swaySeconds: 11,
  /** Handheld-slow camera drift (m) and its period (s). */
  drift: 0.006,
  driftSeconds: 17,
  /** Cursor response: turn toward the pointer (rad), camera shift (m). */
  pointerYaw: 0.06,
  pointerPitch: 0.02,
  pointerShift: 0.02,
  /** Smoothing per second for the pointer (higher = snappier). */
  pointerEase: 2.2,
};
