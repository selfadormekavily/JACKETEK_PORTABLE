import type {
  CameraView,
  ColourZone,
  EmbroideryImage,
  EmbroideryKind,
  Finish,
  FocusTarget,
  HardwareFinish,
  JacketConfig,
  LegacyPlacementId,
  PlacementId,
  TextEmbroideryStyle,
  ZoneTransform,
} from "../model/types";

/**
 * THE contract between the configurator UI and whatever renders the
 * jacket. The placeholder viewer implements it today; the real
 * Three.js / R3F viewer (in src/three/) will implement the exact same
 * props, so swapping it in requires no UI changes.
 */
export type JacketViewerProps = {
  appearance: JacketAppearance;
  view: CameraView;
  /**
   * Increments on every view request, so re-selecting the current view
   * (after the user has dragged the jacket) still turns it back.
   */
  viewRequest?: number;
  focus: FocusTarget | null;
  className?: string;
  /** The embroidery zone being edited: its fixed box is outlined on the jacket. */
  selectedZone?: PlacementId | null;
  /** The user picked a design on the jacket: select its zone (designs can't be moved). */
  onSelectZone?: (placement: PlacementId) => void;
  /**
   * The selected zone's content was dragged on the jacket: its new centre,
   * relative to the zone (x, y as shares of the box, facing the zone). The
   * receiver keeps it inside the zone (clampInZone).
   */
  onMoveInZone?: (placement: PlacementId, x: number, y: number) => void;
  /** The user zoomed in to inspect the jacket (or returned to the full view). */
  onZoomedChange?: (zoomed: boolean) => void;
  /** Show the jacket open (front panels apart). Needs the zipper. */
  jacketOpen?: boolean;
  /**
   * Framing: how much air around the jacket (1 = edge to edge; default
   * 1.32), and a band at the top of the viewer (px) that UI floats over
   * (the phone step map) — the jacket is framed below it.
   */
  frame?: { margin: number; insetTop: number };
};

export type SurfaceAppearance = {
  hex: string;
  finish: Finish;
};

/**
 * Where a rendered element can sit: the configurator's ten fixed zones,
 * plus spots used only by display jackets (the homepage): the upper back
 * (free-sized back designs) and the shoulders (sleeve numbers).
 */
export type DisplayPlacementId = PlacementId | LegacyPlacementId | "leftSleeve" | "rightSleeve";

/** Tackle-twill varsity lettering: twill fill, satin border, optional outline. */
export type VarsityAppearance = {
  fill: string;
  border: string;
  outline?: string;
  borderWeight?: number;
  /** "collegiate" block letters or "athletic" numerals. */
  face?: "collegiate" | "athletic";
  /** Cap height on the garment, metres. */
  capHeight: number;
};

/** One embroidery element, render-ready. */
export type EmbroideryAppearance = {
  id: string;
  kind: EmbroideryKind;
  /** Text elements. */
  text: string;
  /** Image elements: the isolated design (transparent PNG). */
  image: EmbroideryImage | null;
  placement: DisplayPlacementId;
  /** Text sewn as varsity tackle-twill lettering instead of satin script. */
  varsity?: VarsityAppearance;
  /** Text in a text zone: set in this library font, fitted into the zone's box. */
  textStyle?: TextEmbroideryStyle;
  /** Fixed zones: the content's placement inside the zone (absent: auto-fit, centred). */
  inZone?: ZoneTransform;
  /** Metres on the garment from the zone centre, facing the zone. */
  offset: [number, number];
  /** Radians, counter-clockwise facing the zone. */
  rotation: number;
  scale: number;
  /** Single thread colour, or null for an image's own colours. */
  threadHex: string | null;
};

/**
 * Render-ready description of the jacket, derived from JacketConfig.
 * Renderers consume this instead of the raw config, so they never
 * need to look anything up in the catalogue.
 */
export type JacketAppearance = {
  surfaces: Record<ColourZone, SurfaceAppearance>;
  /** The rib stripes' colour. Omitted: the sleeve colour (as sewn). */
  stripe?: string;
  embroidery: EmbroideryAppearance[];
  /** Kept for renderers that want to vary the silhouette by fit. */
  fit: JacketConfig["fit"];
  /** Snap finish. Omitted: the asset's own snaps are left as they are. */
  hardware?: HardwareFinish;
  /** Closure options. Omitted: a display-only jacket (never opens). */
  closure?: { zipper: boolean };
};
