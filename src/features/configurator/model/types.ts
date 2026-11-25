/**
 * Core domain types for the jacket configurator.
 *
 * `JacketConfig` is the single source of truth for what the customer
 * has designed. It is plain, serialisable data — the UI edits it, the
 * viewer (placeholder today, Three.js later) renders it, and eventually
 * the cart/checkout will submit it. Nothing in here knows about React
 * or 3D.
 */

/** Regions of the jacket that take an independent colour. */
export type ColourZone = "body" | "sleeves" | "trim";

/**
 * The jacket's ten fixed embroidery zones (defined, with their boxes, in
 * model/embroideryGeometry.ts): two on the chest, two on the back, three
 * down each sleeve. Each holds at most one design, fitted into its box.
 */
export type PlacementId =
  | "leftChest"
  | "rightChest"
  | "mainBack"
  | "backQuote"
  | "leftSleeveUpper"
  | "leftSleeveMiddle"
  | "leftSleeveLower"
  | "rightSleeveUpper"
  | "rightSleeveMiddle"
  | "rightSleeveLower";

/**
 * Zones of designs saved before the fixed zones (free placement). Drafts
 * are migrated off them (state/draft.ts); cart items and orders placed
 * then keep them, and the cart, admin and production read them through
 * LEGACY_ZONES (model/embroideryGeometry.ts).
 */
export type LegacyPlacementId = "centerChest" | "upperBack";

/** The garment face a zone sits on (sleeve zones: the sleeve's outer side). */
export type ZoneSide = "front" | "back" | "leftSleeve" | "rightSleeve";

/**
 * Fixed camera angles the viewer can be asked to show. "left"/"right"
 * are the wearer's sides (used to present sleeve embroidery).
 */
export type CameraView = "front" | "threeQuarter" | "back" | "left" | "right";

export type ColourId = string;
export type ThreadId = string;
/** Material for a zone that offers a choice (body, sleeves). */
export type MaterialId = "leather" | "felt";
/** Zones whose material the customer chooses. */
export type MaterialZone = "body" | "sleeves";
/** Metal finish of the snaps. */
export type HardwareFinish = "black" | "silver" | "gold" | "gunmetal";
export type SizeId = "XS" | "S" | "M" | "L" | "XL" | "XXL";
export type FitId = "regular" | "relaxed";

/** Surface finish hint the 3D renderer maps to material properties. */
export type Finish = "felt" | "leather" | "rib" | "thread";

export type EmbroideryKind = "text" | "image";

/** Stitch treatment. Only satin today; tatami / chain etc. can follow. */
export type EmbroideryStyle = "satin";

/**
 * An image design: a customer upload or a ready-made library design.
 *
 * Customer uploads: `src` is the processed transparent PNG the configurator
 * stitches (background removed, downscaled; size in `processed`) and
 * `original` the file exactly as uploaded.
 * Library designs (`asUploaded: true`): `src` is the design's own file,
 * unchanged — nothing is converted, cropped, resized or recoloured.
 */
export type EmbroideryImage = {
  /** The artwork the jacket shows (data URL, or a library asset path). */
  src: string;
  /** width / height. */
  aspect: number;
  /**
   * `src` is the artwork file itself, unchanged (a ready-made library
   * design's own file — see `library`). Absent on customer uploads.
   */
  asUploaded?: true;
  /**
   * A ready-made design from the embroidery library (src/features/configurator/
   * library): `src` is its asset path under the library root, not an
   * embedded file — the server reads that file for production.
   */
  library?: LibraryDesignRef;
  /**
   * A Front Letters design with the customer's two letters (library/frontLetters.ts):
   * which letter template and which letters. `src` is the design's own file for
   * "A A", otherwise the letters drawn into it; production rebuilds the file
   * from this selection.
   */
  frontLetters?: FrontLettersSelection;
  /**
   * A ready-made design with a colourway (library/colourways.ts) whose colours
   * the customer changed: which thread per colour slot. Present only when at
   * least one slot differs from the design's own colours (otherwise `src` is
   * the original file, untouched). Production rebuilds the artwork from the
   * original file + the design's region map + these colours.
   */
  colourway?: ColourwaySelection;
  /**
   * Production only (added on a copy by the server, never stored): a design
   * with colour layers — its region map (data URL, the artwork's layers) and
   * each layer's thread, so the digitizer stitches each layer in its own
   * thread (server/colourways.mjs).
   */
  colourRegions?: { regions: string; threads: { hex: string; name: string }[] };
  /** Pixel size of the processed PNG in `src` (uploads). Absent on designs uploaded before it was recorded. */
  processed?: { widthPx: number; heightPx: number };
  /**
   * The source file: the customer's upload exactly as uploaded (absent on
   * designs uploaded before it was kept), or a library design's file.
   */
  original?: {
    /** Uploads: data URL of the uploaded file, byte for byte. Library designs: absent (the file is `library.asset`). */
    src?: string;
    fileName: string;
    mimeType: string;
    /** Intrinsic pixel size; null when the file has none (e.g. an SVG without one). */
    widthPx: number | null;
    heightPx: number | null;
  };
};

/** A colourway's colour slot ids (stable; stored in orders). */
/**
 * A colour slot's id, from the design's metadata (stable; stored in orders):
 * semantic ("fill", "outline", "shadow", "border", "detail") on designs
 * authored with colour layers; "color1"… on colourways generated from
 * flattened artwork.
 */
export type ColourwaySlotId = string;

/** The customer's colours on a ready-made design with colour layers (a colourway). */
export type ColourwaySelection = {
  type: "colourway";
  /** The library design (= the colourway's id; for Front Letters, the template's). */
  designId: string;
  colourwayVersion: number;
  /** The thread chosen per slot; a slot left out keeps the design's own colour (its `defaultThread`, if it has one). */
  colours: Partial<Record<ColourwaySlotId, ThreadId>>;
  /**
   * The design's slots as ordered, for production: label (English), semantic
   * key, the design's own colour, and the thread that colour is (when the
   * design was authored in threads).
   */
  slots: { id: ColourwaySlotId; label: string; key?: string; defaultColor: string; defaultThread?: ThreadId }[];
};

/** The customer's choice on a Front Letters design: the template (= the library design) and two letters A–Z. */
export type FrontLettersSelection = {
  type: "front-letters";
  /** The Front Letters design / letter template id (the library design's designId). */
  templateId: string;
  libraryId: string;
  letter1: string;
  letter2: string;
  /** The template's style name ("Brush script", "Pixel block"…). */
  style: string;
  templateVersion: number;
};

/** What an order keeps of a ready-made library design (enough to produce it and trace its source). */
export type LibraryDesignRef = {
  /** Stable JACKETEK id ("ojisan:<designId>"). */
  id: string;
  /** The source's own design id and library. */
  designId: string;
  libraryId: string;
  libraryTitle: string;
  /** The source's production / lab code for the library. */
  productionName: string | null;
  originalFileName: string | null;
  /** Asset paths, relative to the library root (library/library.ts). */
  asset: string;
  thumbnail: string;
  source: { provider: string; placements: number[] };
};

/**
 * One embroidered element. Plain data: it can be saved, sent to the
 * cart, or used to generate production artwork later.
 */
export type EmbroideryElement = {
  id: string;
  kind: EmbroideryKind;
  /** Text elements. */
  text: string;
  /** Image elements. */
  image: EmbroideryImage | null;
  /**
   * The fixed zone it is assigned to: the zone alone sets its position
   * and size (fitted into the zone's box, centred, proportions kept).
   * Cart items and orders placed before the fixed zones may hold a
   * LegacyPlacementId here (read through LEGACY_ZONES).
   */
  placement: PlacementId;
  /**
   * Always [0, 0], 0 and 1 for designs made with the fixed zones — the
   * customer can't move, turn or resize a design. Kept because designs
   * saved before the fixed zones store free positions here (centre
   * offset in metres facing the zone; degrees counter-clockwise; size
   * multiplier), and production reads them from those orders.
   */
  offset: [number, number];
  rotation: number;
  scale: number;
  /**
   * Thread colour of text embroidery. Image designs are stitched in their
   * own colours (null); designs saved when a single thread could be chosen
   * for an image may still carry one, and production honours it.
   */
  thread: ThreadId | null;
  style: EmbroideryStyle;
  /**
   * Final size on the garment, as the configurator shows it — the design
   * fitted into its zone's box (model/embroideryGeometry.ts). Absent on
   * designs saved before it was recorded.
   */
  physicalSize?: { widthCm: number; heightCm: number };
  /**
   * The artwork centre on the reference jacket (x from the centre line,
   * + = wearer's left; y up from the hem) — its zone's centre. The basis
   * for manufacturing measurements. Absent on older designs.
   */
  referencePosition?: { side: ZoneSide; xCm: number; yCm: number };
  /**
   * Text elements set in a library font: the lettering (font, layout, fit).
   * With it, `physicalSize` / `referencePosition` are recorded like an
   * image's. Absent on text saved before the font library.
   */
  textStyle?: TextEmbroideryStyle;
  /**
   * The customer's placement of the content INSIDE its fixed zone (the zone
   * itself never moves or changes size). Absent = the default: auto-fitted
   * (as large as the zone's box allows, proportions kept) and centred. See
   * ZoneTransform and model/embroideryGeometry.ts (zoneContent).
   */
  inZone?: ZoneTransform;
  /**
   * Production only (added on a copy by the server, never stored): the text
   * drawn in its font — the artwork the sheet prints and the digitizer sews.
   */
  textArtwork?: { src: string; widthPx: number; heightPx: number; direction: "ltr" | "rtl"; fonts: string[] };
};

/**
 * Content placement inside a fixed zone, relative to the zone — never
 * screen pixels — so the configurator, the 3D jacket and production read
 * it the same way:
 * - `scale`: the content's size as a share of its auto-fit size (the
 *   largest that fits the box; 1 = that, the default; never larger);
 * - `x`, `y`: the content centre's offset from the zone centre, as a share
 *   of the box's width / height, facing the zone (x → right, y → up).
 * Always kept so the whole content stays inside the box (clampInZone).
 */
export type ZoneTransform = { scale: number; x: number; y: number };

/** How a text embroidery is set (src/features/embroidery/text/textArtwork.ts draws it). */
export type TextEmbroideryStyle = {
  /** Font library id (src/features/embroidery/fonts/fontLibrary.ts). */
  fontId: string;
  /** The font's name when ordered. */
  fontName: string;
  /** Library fonts used for scripts the chosen face doesn't draw (e.g. Arabic in a Latin face). */
  fallbackFontIds: string[];
  /** Centred in the zone (the only alignment the zones offer today). */
  alignment: "center";
  /** Base direction, from the first strong letter (Arabic → right-to-left). */
  direction: "ltr" | "rtl";
  /** width / height of the lettering, as drawn. */
  aspect: number;
  /** The lettering's height as a share of the zone box's height (1 = fills it; long text is smaller). */
  fitScale: number;
};

export type JacketConfig = {
  colours: Record<ColourZone, ColourId>;
  /** Chosen independently: e.g. felt body with leather sleeves. */
  materials: Record<MaterialZone, MaterialId>;
  /** Snap finish. */
  buttons: HardwareFinish;
  /** A zipper hidden beneath the snap placket. */
  zipper: boolean;
  embroidery: EmbroideryElement[];
  size: SizeId | null;
  fit: FitId;
};

/** What the viewer should draw attention to, if anything. */
export type FocusTarget =
  | { kind: "zone"; id: ColourZone }
  | { kind: "placement"; id: PlacementId };
