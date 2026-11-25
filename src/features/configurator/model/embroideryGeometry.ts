/**
 * THE EMBROIDERY ZONES — the single source of truth for where embroidery
 * goes, shared by the configurator UI, the 3D jacket, the saved order and
 * the production sheet / PDF, so what is made is exactly what was shown.
 *
 * The jacket has ten FIXED zones. Each is a locked production template:
 * a box at a fixed place on the garment. A customer assigns one design to
 * a zone; the design is fitted into the box (proportions kept, centred)
 * and can't be moved, turned or resized.
 *
 * Positions are on the REFERENCE JACKET: the 3D model in its normalised
 * space (metres, hem at y = 0, centred, x + = wearer's left, front +z;
 * see three/embroidery/surfacePlacement.ts). The same for every size.
 * Pure data: no DOM or 3D. Display names here are the English fallbacks;
 * the UI shows catalog.placement.<id> / catalog.placementGroup.<group>.
 */
import type { CameraView, EmbroideryElement, EmbroideryImage, PlacementId, ZoneSide, ZoneTransform } from "./types";

/**
 * Text a zone takes: at most this many characters (line breaks not
 * counted), on at most TEXT_MAX_LINES lines the customer breaks by hand.
 * The lettering block is fitted into the zone like a design.
 */
export const TEXT_MAX_CHARS = 42;
export const TEXT_MAX_LINES = 4;

/** Files a zone accepts (what the upload step can read: embroidery/prepareUpload.ts). */
export const ZONE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/svg+xml"] as const;

/** Where on the jacket a zone is, for grouping in the UI (catalog.placementGroup.<id>). */
export type ZoneGroup = "front" | "back" | "leftSleeve" | "rightSleeve";

export type EmbroideryZone = {
  id: PlacementId;
  /** "Left Chest", "Left Sleeve — Upper"… (English fallback). */
  name: string;
  /** Compact label (review rows). */
  shortName: string;
  group: ZoneGroup;
  /**
   * What the zone takes: an image design (upload or ready-made) and/or
   * typed text in a library font. Each zone holds one of them at a time.
   */
  accepts: { design: boolean; text: boolean };
  /** Allowed image types (none when the zone takes no designs). */
  accept: readonly string[];
  /** Longest text the zone takes (characters, line breaks not counted). */
  textMaxLength: number;
  /** The garment face it sits on. */
  side: ZoneSide;
  /** Box centre: x (+ = wearer's left) and y (up from the hem), metres. */
  point: [number, number];
  /** The fixed box, [width, height] on the garment, metres. */
  box: [number, number];
  /**
   * Sleeve zones: the depth (z) of the sleeve's outer side at this height —
   * the zone faces straight out from the sleeve there (measured on the
   * reference model, fidelio_varsity_v09.glb).
   */
  aimZ?: number;
  /** The camera angle that shows it. */
  view: CameraView;
  /** File-name key on the production sheet ("…_LEFT_CHEST_…"). */
  productionKey: string;
};

const IMAGES = ZONE_IMAGE_TYPES;
const DESIGN_OR_TEXT = { design: true, text: true } as const;

/**
 * Garment landmarks of the reference jacket (public/models/fidelio_varsity_v09.glb
 * in the normalised space above), measured on the model —
 * checked by the 2026-10-09 zone-alignment review (scripts/techflat/zone-alignment-review.mjs,
 * retired 2026-11-25; restore it from git commit 3e5e26c to re-run).
 * Zones are also expressed relative to them (normalisedZone): the placement
 * the RFQ technical drawing reproduces on its own flat, so the website and
 * the drawing show the same zones. Model geometry, not garment measurements.
 */
export const REFERENCE_LANDMARKS = {
  /** High point shoulder (REFERENCE_HPS_Y). */
  hpsY: 0.683,
  /** Top of the waistband rib. */
  waistbandTopY: 0.1217,
  /** Half the body's width at the waistband. */
  waistbandHalfWidth: 0.1833,
  /** Top of the sleeve (shoulder point) and the sleeve-to-cuff-rib seam. */
  sleeveTopY: 0.5972,
  cuffSeamY: 0.0923,
  /**
   * The sleeve's front-to-back depth down its length, [y, depth] — measured on
   * the left sleeve (the right mirrors it within 2%; the drawing's left sleeve
   * is the mirror of its right).
   */
  sleeveDepth: [
    [0.105, 0.1019], [0.125, 0.1016], [0.145, 0.1043], [0.165, 0.1089], [0.185, 0.114], [0.205, 0.1164], [0.225, 0.1192],
    [0.245, 0.1212], [0.265, 0.1245], [0.285, 0.1276], [0.305, 0.1297], [0.325, 0.1311], [0.345, 0.1333], [0.365, 0.1346],
    [0.385, 0.1358], [0.405, 0.136], [0.425, 0.1347], [0.445, 0.1319], [0.465, 0.128], [0.485, 0.134], [0.505, 0.1427],
    [0.525, 0.146], [0.545, 0.14], [0.565, 0.1149], [0.585, 0.082],
  ] as readonly (readonly [number, number])[],
} as const;
const L = REFERENCE_LANDMARKS;
/** HPS → top of the waistband rib: body zones' vertical unit. */
const BODY_LENGTH = L.hpsY - L.waistbandTopY;
/** Shoulder point → cuff seam: sleeve zones' unit along the sleeve. */
const SLEEVE_LENGTH = L.sleeveTopY - L.cuffSeamY;

/**
 * A back zone, centred, from its approved normalised height: `v` = HPS →
 * box centre as a share of HPS → waistband top.
 */
const backBox = (v: number, box: [number, number]) => ({ point: [0, L.hpsY - v * BODY_LENGTH] as [number, number], box });

/*
 * Chest: the two boxes keep the chest zone centres used since the first
 * jacket (clear of the snap placket at the centre front). Back: a large
 * main box between the shoulder blades, and below it a wide, short text
 * box (typed text only) — above where the back gathers into the
 * waistband; both placed by their approved normalised geometry (zone
 * alignment review, 2026-10-09). Sleeves: the leather runs from y ≈ 0.58
 * (shoulder) to 0.084 (cuff rib); three boxes are spaced down its outer
 * side, each facing straight out.
 */
const sleeveZone = (
  side: "left" | "right",
  level: "Upper" | "Middle" | "Lower",
  y: number,
  /** Depth of the box centre; the upper box sits a little toward the sleeve's middle (see below). */
  aimZ = -0.006
): EmbroideryZone => {
  const left = side === "left";
  return {
    id: `${side}Sleeve${level}` as PlacementId,
    name: `${left ? "Left" : "Right"} Sleeve — ${level}`,
    shortName: `${left ? "L" : "R"}. Sleeve ${level}`,
    group: left ? "leftSleeve" : "rightSleeve",
    accepts: DESIGN_OR_TEXT,
    accept: IMAGES,
    textMaxLength: TEXT_MAX_CHARS,
    side: left ? "leftSleeve" : "rightSleeve",
    point: [left ? 0.29 : -0.29, y],
    // 8.4 × 11.2 cm: inside the sleeve's clean outer side, 2.8 cm between boxes,
    // clear of the shoulder curve above and the cuff rib below.
    box: [0.084, 0.112],
    aimZ,
    view: left ? "left" : "right",
    productionKey: `${left ? "LEFT" : "RIGHT"}_SLEEVE_${level.toUpperCase()}`,
  };
};

/** The ten zones, in the order the configurator lists them. */
export const EMBROIDERY_ZONE_LIST: readonly EmbroideryZone[] = [
  {
    id: "leftChest", name: "Left Chest", shortName: "L. Chest", group: "front", accepts: DESIGN_OR_TEXT, accept: IMAGES,
    textMaxLength: TEXT_MAX_CHARS, side: "front", point: [0.11, 0.54], box: [0.1, 0.1], view: "front", productionKey: "LEFT_CHEST",
  },
  {
    id: "rightChest", name: "Right Chest", shortName: "R. Chest", group: "front", accepts: DESIGN_OR_TEXT, accept: IMAGES,
    textMaxLength: TEXT_MAX_CHARS, side: "front", point: [-0.11, 0.54], box: [0.1, 0.1], view: "front", productionKey: "RIGHT_CHEST",
  },
  {
    id: "mainBack", name: "Main Back", shortName: "Back", group: "back", accepts: DESIGN_OR_TEXT, accept: IMAGES,
    // Centre at 0.43 of HPS → waistband top, 0.52 of it tall (same width as before).
    textMaxLength: TEXT_MAX_CHARS, side: "back", ...backBox(0.43, [0.3, 0.52 * BODY_LENGTH]), view: "back", productionKey: "MAIN_BACK",
  },
  {
    // Text embroidery only: the customer's text in a library font, fitted into the box.
    id: "backQuote", name: "Lower Back Text", shortName: "Back Text", group: "back", accepts: { design: false, text: true },
    // Centre at 0.8125 of HPS → waistband top (box unchanged): clear below Main Back and above the rib.
    accept: [], textMaxLength: TEXT_MAX_CHARS, side: "back", ...backBox(0.8125, [0.3, 0.07]), view: "back", productionKey: "BACK_QUOTE",
  },
  // The upper boxes: 1.4 cm back from the sleeve's outermost line, toward
  // its middle (z ≈ −0.033 there), clear of where the sleeve curves
  // forward into the chest. Same on both sleeves.
  sleeveZone("left", "Upper", 0.465, -0.02),
  sleeveZone("left", "Middle", 0.325),
  sleeveZone("left", "Lower", 0.185),
  sleeveZone("right", "Upper", 0.465, -0.02),
  sleeveZone("right", "Middle", 0.325),
  sleeveZone("right", "Lower", 0.185),
];

export const EMBROIDERY_ZONES_BY_ID = Object.fromEntries(EMBROIDERY_ZONE_LIST.map((z) => [z.id, z])) as Record<
  PlacementId,
  EmbroideryZone
>;

/**
 * A zone relative to the garment (REFERENCE_LANDMARKS) — what the RFQ
 * technical drawing places on its own flat, so it shows the website's zones.
 * Body: u = centre from the centre line ÷ half body width at the waistband
 * (+ = wearer's left), v = HPS → centre ÷ HPS → waistband top, w = box width ÷
 * body width at the waistband, h = box height ÷ HPS → waistband top, aspect =
 * the box's own width ÷ height (the drawing keeps it: the flat-laid body is
 * wider for its length than the 3D model's front).
 * Sleeve: s = shoulder point → centre ÷ shoulder point → cuff seam (along the
 * sleeve), w = box width ÷ the sleeve's depth there, h = box height ÷ shoulder
 * point → cuff seam, aspect = the box's own width ÷ height — the drawing keeps
 * it, since a flat sleeve's width is not the 3D sleeve's side-face depth. Shares
 * and ratios, not measurements.
 */
export type NormalisedZone =
  | { kind: "body"; u: number; v: number; w: number; h: number; aspect: number }
  | { kind: "sleeve"; s: number; w: number; h: number; aspect: number };

/** The sleeve's depth at height y (interpolated in REFERENCE_LANDMARKS.sleeveDepth). */
function sleeveDepthAt(y: number): number {
  const d = L.sleeveDepth;
  if (y <= d[0][0]) return d[0][1];
  for (let i = 1; i < d.length; i++) {
    if (y <= d[i][0]) return d[i - 1][1] + ((d[i][1] - d[i - 1][1]) * (y - d[i - 1][0])) / (d[i][0] - d[i - 1][0]);
  }
  return d[d.length - 1][1];
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

export function normalisedZone(zone: EmbroideryZone): NormalisedZone {
  const [x, y] = zone.point;
  const [w, h] = zone.box;
  if (zone.side === "leftSleeve" || zone.side === "rightSleeve") {
    return { kind: "sleeve", s: r4((L.sleeveTopY - y) / SLEEVE_LENGTH), w: r4(w / sleeveDepthAt(y)), h: r4(h / SLEEVE_LENGTH), aspect: r4(w / h) };
  }
  return { kind: "body", u: r4(x / L.waistbandHalfWidth), v: r4((L.hpsY - y) / BODY_LENGTH), w: r4(w / (2 * L.waistbandHalfWidth)), h: r4(h / BODY_LENGTH), aspect: r4(w / h) };
}

/** The zone groups, in the order the configurator lists them. */
export const ZONE_GROUPS: readonly { id: ZoneGroup; name: string }[] = [
  { id: "front", name: "Front" },
  { id: "back", name: "Back" },
  { id: "leftSleeve", name: "Left sleeve" },
  { id: "rightSleeve", name: "Right sleeve" },
];

/** True for one of the ten fixed zones (not a legacy or unknown id). */
export const isFixedZone = (id: string): id is PlacementId => id in EMBROIDERY_ZONES_BY_ID;

export type LegacyZone = {
  name: string;
  productionKey: string;
  side: "front" | "back";
  point: [number, number];
  /** Capital-letter height of text at scale 1, metres. */
  textHeight: number;
  /** Longest side of an image design at scale 1, metres. */
  imageSize: number;
  /** Widest an element may get here (wider designs shrink to fit), metres. */
  maxWidth: number;
};

/**
 * Zones of designs saved before the fixed zones (free placement: a base
 * size × scale, shrunk to a maximum width, moved by an offset) — the
 * zone geometry those customers saw. Cart items and orders placed then
 * keep these ids; production reads them to rebuild those orders exactly.
 * (The chest ids are also fixed zones now: an element there with a free
 * offset or scale is still produced as placed — see placementData.)
 */
export const LEGACY_ZONES: Record<string, LegacyZone> = {
  leftChest: { name: "Left chest", productionKey: "LEFT_CHEST", side: "front", point: [0.11, 0.54], textHeight: 0.018, imageSize: 0.07, maxWidth: 0.13 },
  rightChest: { name: "Right chest", productionKey: "RIGHT_CHEST", side: "front", point: [-0.11, 0.54], textHeight: 0.018, imageSize: 0.07, maxWidth: 0.13 },
  centerChest: { name: "Center chest", productionKey: "CENTER_CHEST", side: "front", point: [0, 0.47], textHeight: 0.022, imageSize: 0.1, maxWidth: 0.26 },
  upperBack: { name: "Upper back", productionKey: "UPPER_BACK", side: "back", point: [0, 0.53], textHeight: 0.045, imageSize: 0.17, maxWidth: 0.34 },
};

/** A placement's English name: a fixed zone's, a legacy zone's, or the raw id. */
export const zoneName = (id: string) => (isFixedZone(id) ? EMBROIDERY_ZONES_BY_ID[id].name : LEGACY_ZONES[id]?.name ?? id);

/**
 * The reference jacket's high point shoulder (where shoulder and collar
 * meet), metres above y = 0. Measured on the approved orthographic renders
 * (production-drawing/images/view01_front.png and view02_back.png: collar
 * base at 352 px), and consistent with the zone points above. Production
 * expresses body embroidery height as "below HPS" from it.
 */
export const REFERENCE_HPS_Y = REFERENCE_LANDMARKS.hpsY;

/**
 * The reference jacket's shoulder point (top of the sleeve, where it meets
 * the shoulder), metres above y = 0 — measured on the model (the sleeve
 * cap's top at y ≈ 0.60). Sleeve embroidery is placed "below SP".
 */
export const REFERENCE_SP_Y = 0.6;

/** Longest side an image design is stitched at (pixels). */
export const STITCH_IMAGE_MAX_PX = 512;

/** The stitch grid an image of `width` × `height` pixels is converted to. */
export function stitchGridSize(width: number, height: number): [number, number] {
  const s = Math.min(1, STITCH_IMAGE_MAX_PX / Math.max(width, height));
  return [Math.max(8, Math.round(width * s)), Math.max(8, Math.round(height * s))];
}

/**
 * A design's size in a fixed zone, metres [width, height]: as large as
 * fits inside the box with its proportions kept (`aspect` = width / height).
 */
export function fitInZone(box: readonly [number, number], aspect: number): [number, number] {
  const [bw, bh] = box;
  return aspect >= bw / bh ? [bw, bw / aspect] : [bh * aspect, bh];
}

/** The smallest the content may be made: a share of its auto-fit size. */
export const ZONE_SCALE_MIN = 0.2;

/** The default placement: auto-fitted and centred. */
export const ZONE_FIT: ZoneTransform = { scale: 1, x: 0, y: 0 };

const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * A placement kept valid: size between ZONE_SCALE_MIN and the auto-fit
 * size, and the centre where the WHOLE content stays inside the box (the
 * free room each way is what the box has left over at that size).
 */
export function clampInZone(box: readonly [number, number], aspect: number, t: Partial<ZoneTransform> | null | undefined): ZoneTransform {
  const scale = Math.min(1, Math.max(ZONE_SCALE_MIN, finite(t?.scale, 1)));
  const [w, h] = fitInZone(box, aspect);
  const roomX = Math.max(0, (1 - (w * scale) / box[0]) / 2);
  const roomY = Math.max(0, (1 - (h * scale) / box[1]) / 2);
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return {
    scale: r4(scale),
    x: r4(Math.min(roomX, Math.max(-roomX, finite(t?.x, 0)))),
    y: r4(Math.min(roomY, Math.max(-roomY, finite(t?.y, 0)))),
  };
}

/**
 * THE content geometry in a fixed zone — shared by the 3D jacket and the
 * production data: its size (metres) and its centre's offset from the zone
 * centre (metres, facing the zone: x → right, y → up), from its
 * proportions and the (clamped) placement.
 */
export function zoneContent(
  box: readonly [number, number],
  aspect: number,
  t: Partial<ZoneTransform> | null | undefined
): { size: [number, number]; offset: [number, number]; transform: ZoneTransform } {
  const transform = clampInZone(box, aspect, t);
  const [w, h] = fitInZone(box, aspect);
  return {
    size: [w * transform.scale, h * transform.scale],
    offset: [transform.x * box[0], transform.y * box[1]],
    transform,
  };
}

/**
 * Free-placement size (display jackets and designs saved before the fixed
 * zones): `imageSize` × `scale` on the longest side, shrunk to `maxWidth`.
 */
export function imageEmbroiderySize(
  zone: { imageSize: number; maxWidth: number },
  scale: number,
  aspect: number
): [number, number] {
  const longest = zone.imageSize * scale;
  const [w, h] = aspect >= 1 ? [longest, longest / aspect] : [longest * aspect, longest];
  const fit = Math.min(1, zone.maxWidth / w);
  return [w * fit, h * fit];
}

const cm = (metres: number) => Math.round(metres * 10000) / 100;

/**
 * Production data derived from an image element's zone: its final size
 * and its centre on the reference jacket. Null when the image's pixel
 * size isn't recorded (designs uploaded before it was).
 */
export function imageProductionData(
  element: Pick<EmbroideryElement, "placement" | "offset" | "scale">,
  image: EmbroideryImage
): Pick<EmbroideryElement, "physicalSize" | "referencePosition"> | null {
  // Library designs: the file's own proportions (what the jacket shows).
  if (image.asUploaded) return placementData(element, image.aspect);
  // Uploads: the processed PNG's stitch grid (what the jacket shows).
  if (!image.processed) return null;
  const [gw, gh] = stitchGridSize(image.processed.widthPx, image.processed.heightPx);
  return placementData(element, gw / gh);
}

/** True when an element still carries a free placement (saved before the fixed zones). */
export const hasFreePlacement = (element: Pick<EmbroideryElement, "offset" | "scale" | "rotation">) => {
  const offset = element.offset ?? [0, 0];
  return offset[0] !== 0 || offset[1] !== 0 || (element.scale ?? 1) !== 1 || (element.rotation ?? 0) !== 0;
};

/**
 * Size and reference position for a stitch aspect (width / height): the
 * design fitted into its fixed zone, centred on it. For designs saved
 * before the fixed zones, their free placement (legacy zone + offset +
 * scale) — exactly what those customers saw. (Callers check the zone is
 * known: one of the ten, or a LEGACY_ZONES id.)
 */
export function placementData(
  element: Pick<EmbroideryElement, "placement" | "offset" | "scale" | "inZone">,
  aspect: number
): Required<Pick<EmbroideryElement, "physicalSize" | "referencePosition">> {
  const zone = EMBROIDERY_ZONES_BY_ID[element.placement];
  const offset = element.offset ?? [0, 0];
  const free = offset[0] !== 0 || offset[1] !== 0 || (element.scale ?? 1) !== 1;
  if (zone && !(free && LEGACY_ZONES[element.placement])) {
    // The content in its fixed zone, placed by the customer (zoneContent).
    // Body zones: x on the jacket follows the facing (back: mirrored);
    // sleeve zones: the horizontal offset runs along the sleeve's outer
    // side, so the reference x stays the sleeve's (production reads the
    // offset itself: orderToProductionOrder offsetCm).
    const { size, offset: [dx, dy] } = zoneContent(zone.box, aspect, element.inZone);
    const facing = zone.side === "back" ? -1 : 1;
    const sleeve = zone.side === "leftSleeve" || zone.side === "rightSleeve";
    return {
      physicalSize: { widthCm: cm(size[0]), heightCm: cm(size[1]) },
      referencePosition: { side: zone.side, xCm: cm(zone.point[0] + (sleeve ? 0 : dx * facing)), yCm: cm(zone.point[1] + dy) },
    };
  }
  const legacy = LEGACY_ZONES[element.placement];
  const [w, h] = imageEmbroiderySize(legacy, element.scale ?? 1, aspect);
  const facing = legacy.side === "front" ? 1 : -1;
  return {
    physicalSize: { widthCm: cm(w), heightCm: cm(h) },
    referencePosition: {
      side: legacy.side,
      xCm: cm(legacy.point[0] + offset[0] * facing),
      yCm: cm(legacy.point[1] + offset[1]),
    },
  };
}
