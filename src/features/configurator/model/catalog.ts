import type {
  CameraView,
  ColourId,
  ColourZone,
  FitId,
  HardwareFinish,
  PlacementId,
  SizeId,
  MaterialId,
  ThreadId,
} from "./types";
import { EMBROIDERY_ZONE_LIST, EMBROIDERY_ZONES_BY_ID, type EmbroideryZone } from "./embroideryGeometry";

/**
 * Product catalogue: every option the customer can choose from.
 *
 * Kept as data (not hard-coded in components) so it can later be
 * served from a CMS/API without touching the UI.
 */

/** Which material a colour is dyed for: wool felt (and rib knit) or leather. */
export type ColourMaterial = "fabric" | "leather";

export type ColourOption = { id: ColourId; name: string; hex: string; material?: ColourMaterial };

/**
 * THE jacket palette — one list for felt and leather, and for the body,
 * sleeves and trim alike. Each colour has a shade per material: the felt
 * (and rib knit) dye and the leather dye, so the same name looks right on
 * either. Ids are stable (stored in designs and orders): `fabric-<id>` /
 * `leather-<id>`; names show via catalog.palette.<id>.
 */
export const PALETTE: readonly { id: string; name: string; felt: string; leather: string }[] = [
  { id: "pink", name: "Pink", felt: "#B88791", leather: "#B88791" },
  { id: "black", name: "Black", felt: "#171717", leather: "#111111" },
  { id: "purple", name: "Purple", felt: "#5B5B9A", leather: "#5B5B9A" },
  { id: "white", name: "White", felt: "#F4F4F4", leather: "#F1F0E8" },
  { id: "navy", name: "Navy Blue", felt: "#172E70", leather: "#172E70" },
  { id: "beige", name: "Beige", felt: "#D5C79B", leather: "#C8B98A" },
  { id: "dark-brown", name: "Dark Brown", felt: "#3A2117", leather: "#3A2117" },
  { id: "brown", name: "Brown", felt: "#68402B", leather: "#68402B" },
  { id: "burgundy", name: "Burgundy", felt: "#64152B", leather: "#64152B" },
  { id: "red", name: "Red", felt: "#A7192E", leather: "#A7192E" },
  { id: "royal", name: "Royal Blue", felt: "#17479E", leather: "#17479E" },
  { id: "dark-green", name: "Dark Green", felt: "#174F3A", leather: "#174F3A" },
  { id: "forest", name: "Forest Green", felt: "#0F5135", leather: "#0F5135" },
  { id: "gray", name: "Gray", felt: "#555B5E", leather: "#555B5E" },
  { id: "light-gray", name: "Light Gray", felt: "#858B8C", leather: "#858B8C" },
  { id: "mustard", name: "Mustard", felt: "#B7A94A", leather: "#B7A94A" },
];

/** The palette in felt (body / sleeves in felt; also the rib trim, a knit). */
export const FABRIC_COLOURS: readonly ColourOption[] = PALETTE.map(({ id, name, felt }) => ({
  id: `fabric-${id}`,
  name,
  hex: felt,
  material: "fabric",
}));

/** The palette in leather (body / sleeves in leather). */
export const LEATHER_COLOURS: readonly ColourOption[] = PALETTE.map(({ id, name, leather }) => ({
  id: `leather-${id}`,
  name,
  hex: leather,
  material: "leather",
}));

/** The palette a part is coloured from: leather's, or felt's (felt and rib trim). */
export const paletteFor = (material: MaterialId | "rib"): readonly ColourOption[] =>
  material === "leather" ? LEATHER_COLOURS : FABRIC_COLOURS;

/** The PALETTE id behind a palette colour id ("fabric-navy" → "navy"), or null for other ids. */
export const paletteBaseId = (id: ColourId) => /^(?:fabric|leather)-(.+)$/.exec(id)?.[1] ?? null;

/**
 * The original single palette, before the material palettes: still the
 * homepage's colour row, and how designs saved before them (ids like
 * "navy") keep resolving in the cart, admin and production sheet.
 */
export const COLOURS: readonly ColourOption[] = [
  { id: "black", name: "Black", hex: "#141414" },
  { id: "ivory", name: "Ivory", hex: "#ECE7DC" },
  { id: "navy", name: "Navy", hex: "#1C2940" },
  { id: "burgundy", name: "Burgundy", hex: "#5A1C26" },
  { id: "forest", name: "Forest", hex: "#1F3A2E" },
  { id: "royal", name: "Royal", hex: "#233E8B" },
  { id: "grey", name: "Grey Melange", hex: "#8D8D8B" },
  { id: "camel", name: "Camel", hex: "#AE8A5E" },
];

export type ThreadOption = { id: ThreadId; name: string; hex: string };

/** A thread in one of the jacket palette's colours: the palette's id, name and (felt) shade. */
const paletteThread = (id: string): ThreadOption => {
  const p = PALETTE.find((c) => c.id === id)!;
  return { id: p.id, name: p.name, hex: p.felt };
};

/**
 * THE embroidery thread palette — every colour stitching can be in: text,
 * an upload stitched in one thread, and the colour slots of ready-made
 * designs. Ids are stable (stored in orders; production reads them). The
 * four original threads keep their ids; the rest are the jacket palette's
 * colours (PALETTE ids, names shown via catalog.palette.<id>), so a
 * customer picks embroidery colours from the colours they know.
 */
export const THREADS: readonly ThreadOption[] = [
  { id: "ivory", name: "Ivory", hex: "#ECE7DC" },
  paletteThread("white"),
  { id: "black", name: "Black", hex: "#141414" },
  paletteThread("gray"),
  paletteThread("light-gray"),
  { id: "silver", name: "Silver", hex: "#A8A8A6" },
  { id: "gold", name: "Gold", hex: "#B8975A" },
  paletteThread("mustard"),
  paletteThread("beige"),
  paletteThread("brown"),
  paletteThread("dark-brown"),
  paletteThread("burgundy"),
  paletteThread("red"),
  paletteThread("pink"),
  paletteThread("purple"),
  paletteThread("navy"),
  paletteThread("royal"),
  paletteThread("dark-green"),
  paletteThread("forest"),
];

export type ZoneOption = { id: ColourZone; name: string; description: string };

export const ZONES: readonly ZoneOption[] = [
  { id: "body", name: "Body", description: "Body colour" },
  { id: "sleeves", name: "Sleeves", description: "Sleeve colour" },
  { id: "trim", name: "Trim", description: "Collar, cuffs & waistband rib" },
];

export type MaterialOption = { id: MaterialId; name: string; description: string };

/** Materials offered for the body and the sleeves (chosen separately). */
export const MATERIALS: readonly MaterialOption[] = [
  { id: "leather", name: "Leather", description: "Structured leather with a soft, natural sheen." },
  { id: "felt", name: "Cotton Fabric", description: "Dense, soft cotton fabric with a matte finish." },
];

export type ButtonFinishOption = { id: HardwareFinish; name: string; hex: string };

/** Snap finishes (applied to the jacket's own snap meshes). */
export const BUTTON_FINISHES: readonly ButtonFinishOption[] = [
  { id: "black", name: "Black", hex: "#1c1c1f" },
  { id: "silver", name: "Silver", hex: "#c9cbcd" },
  { id: "gold", name: "Gold", hex: "#c09a5c" },
  { id: "gunmetal", name: "Gunmetal", hex: "#55585e" },
];

/**
 * The hidden zipper (beneath the snap placket) — set aside for now: its
 * controls are hidden and the jacket never opens. The implementation is
 * kept (three/jacket/frontRig.ts, JacketClosure.tsx) for later.
 */
export const ZIPPER_ENABLED = false;

export const getButtonFinish = (id: HardwareFinish) =>
  BUTTON_FINISHES.find((b) => b.id === id) ?? BUTTON_FINISHES[1];

/**
 * The ten fixed embroidery zones — defined once, with their boxes, places
 * on the jacket and what each takes, in model/embroideryGeometry.ts.
 */
export type PlacementOption = EmbroideryZone;
export const PLACEMENTS: readonly PlacementOption[] = EMBROIDERY_ZONE_LIST;

/**
 * Text input rules of text saved before the font library (sanitised
 * Latin). New text uses the font library's rules
 * (features/embroidery/text/textArtwork.ts: cleanText, TEXT_MAX_LENGTH).
 */
export const EMBROIDERY_TEXT = {
  maxLength: 20,
  allowed: /[A-Za-z0-9 .,&'!#-]/,
  placeholder: "Jacketek",
};

export const SIZES: readonly SizeId[] = ["XS", "S", "M", "L", "XL", "XXL"];

export type FitOption = { id: FitId; name: string; description: string };

export const FITS: readonly FitOption[] = [
  { id: "regular", name: "Regular", description: "Close to the body, classic varsity cut." },
  { id: "relaxed", name: "Standard Baggy Fit", description: "Our one cut: roomy and relaxed, with a dropped shoulder." },
];

/** Views offered as buttons under the viewer. */
export const CAMERA_VIEWS: readonly { id: CameraView; name: string }[] = [
  { id: "front", name: "Front" },
  { id: "threeQuarter", name: "3/4" },
  { id: "back", name: "Back" },
];

// Lookup helpers. Fall back to the first entry so a stale/unknown id
// (e.g. from a future saved design) never crashes the UI.
/** Every colour a design may hold (both palettes, then the original one). */
export const ALL_COLOURS: readonly ColourOption[] = [...FABRIC_COLOURS, ...LEATHER_COLOURS, ...COLOURS];

export const getColour = (id: ColourId) =>
  ALL_COLOURS.find((c) => c.id === id) ?? FABRIC_COLOURS[0];

/** The original palette's colours that kept their id in PALETTE under another name ("grey" → "gray"…). */
const ORIGINAL_TO_PALETTE: Record<string, string> = { ivory: "white", grey: "gray", camel: "beige" };

/** sRGB hex → CIE Lab (D65): distances there follow how different colours look. */
function hexLab(hex: string): [number, number, number] {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [x, y, z] = [
    (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047,
    0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2],
    (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883,
  ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** How different two colours look (CIE76 ΔE: about 2.3 is just noticeable). */
export function colourDistance(a: string, b: string) {
  const [l1, a1, b1] = hexLab(a), [l2, a2, b2] = hexLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * The colour in `palette` matching `id`, so switching a part's material
 * (or migrating a design saved with the original palette) keeps its look:
 * the same colour if the palette has it (felt Navy Blue → leather Navy
 * Blue; the original "navy" → Navy Blue), else the closest shade as seen.
 */
export function matchColour(id: ColourId, palette: readonly ColourOption[]): ColourOption {
  const current = getColour(id);
  if (palette.some((c) => c.id === current.id)) return current;
  const base = paletteBaseId(current.id) ?? ORIGINAL_TO_PALETTE[current.id] ?? current.id;
  const same = palette.find((c) => paletteBaseId(c.id) === base) ?? palette.find((c) => c.name === current.name);
  if (same) return same;
  const [l, a, b] = hexLab(current.hex);
  const distance = (c: ColourOption) => {
    const [l2, a2, b2] = hexLab(c.hex);
    return (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
  };
  return palette.reduce((best, c) => (distance(c) < distance(best) ? c : best));
}
export const getThread = (id: ThreadId) =>
  THREADS.find((t) => t.id === id) ?? THREADS[0];
export const getPlacement = (id: PlacementId) =>
  EMBROIDERY_ZONES_BY_ID[id] ?? PLACEMENTS[0];
export const getMaterial = (id: MaterialId) =>
  MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
export const getFit = (id: FitId) => FITS.find((f) => f.id === id) ?? FITS[0];
