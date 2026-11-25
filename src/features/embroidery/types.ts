/**
 * Auto-digitized embroidery (prototype). Plain data, shared by the
 * server (digitizing, DST export, production PDF) and the admin pages.
 */

/** Shown wherever the output appears: it is not a factory-ready file. */
export const DIGITIZING_STATUS = "Auto-digitized prototype — requires professional digitizing review";
/** Bump when the algorithm changes: stored designs from an older engine are redone. */
export const DIGITIZER_ENGINE = "fidelio-autodigitize/0.2";

export type StitchCommand = "stitch" | "jump" | "trim" | "color" | "end";

/**
 * One needle event. Absolute position in mm, design centre at 0,0, y up.
 * `b`: index into metadata.blocks of the block it belongs to; -1 for
 * travel, tie-in / tie-off, jumps, trims and colour changes.
 */
export type Stitch = { x: number; y: number; cmd: StitchCommand; b?: number };

export type StitchType = "running" | "satin" | "fill";

/** A run of stitches of one kind (in sewing order). */
export type StitchBlock = {
  seq: number;
  colour: number;
  type: StitchType | "underlay";
  /** Underlay / fill detail, e.g. "tatami 2.0 mm" or "centre walk". */
  detail: string;
  stitches: number;
  /** Stitch direction, degrees from the design's x axis (before rotation). */
  angle: number | null;
};

export type ThreadColour = {
  index: number;
  hex: string;
  /** "Design colour" (from the artwork) or the chosen thread's name. */
  name: string;
  stitches: number;
  areaMm2: number;
  types: StitchType[];
};

export type DigitizedMetadata = {
  designId: string;
  engine: string;
  status: string;
  createdAt: string;
  stitchCount: number;
  jumps: number;
  trims: number;
  colourChanges: number;
  /** Extents of the stitch field as sewn (rotation applied), mm. */
  widthMm: number;
  heightMm: number;
  extents: { minX: number; maxX: number; minY: number; maxY: number };
  /** The artwork's intended size before rotation (from the order), mm. */
  designWidthMm: number;
  designHeightMm: number;
  rotationDeg: number;
  /** The stitch file is written in the orientation it is sewn on the jacket. */
  rotationApplied: true;
  /** Sleeve zones: side "leftSleeve" / "rightSleeve", placed by belowSpCm (below the shoulder point). */
  placement: {
    zone: string;
    zoneName: string;
    side: "front" | "back" | "leftSleeve" | "rightSleeve";
    fromCentreCm: number | null;
    belowHpsCm: number | null;
    belowSpCm?: number | null;
  } | null;
  threads: ThreadColour[];
  stitchTypes: Record<StitchType | "underlay", number>;
  density: { fillSpacingMm: number; fillStitchMm: number; satinSpacingMm: number; runStitchMm: number; pullCompMm: number; maxStitchMm: number };
  underlay: { fill: string; satin: string };
  blocks: StitchBlock[];
  source: { widthPx: number; heightPx: number; colourMode: "design colours" | "single thread" | "design layers" };
  warnings: string[];
};

export type DigitizedDesign = { metadata: DigitizedMetadata; stitches: Stitch[] };
