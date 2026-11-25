import { EMBROIDERY_TEXT } from "./catalog";
import { clampInZone, EMBROIDERY_ZONES_BY_ID, imageProductionData, placementData, stitchGridSize } from "./embroideryGeometry";
import type {
  EmbroideryElement,
  EmbroideryImage,
  JacketConfig,
  PlacementId,
  TextEmbroideryStyle,
  ThreadId,
  ZoneTransform,
} from "./types";

export function createDefaultConfig(): JacketConfig {
  return {
    colours: { body: "fabric-navy", sleeves: "leather-white", trim: "fabric-navy" },
    materials: { body: "felt", sleeves: "leather" },
    buttons: "silver",
    zipper: false,
    embroidery: [],
    size: null,
    // The one standard fit (JACKETEK's baggy cut). Not a customer choice; saved
    // drafts and orders keep the fit they were made with.
    fit: "relaxed",
  };
}

/**
 * Normalises raw text input by the rules of text saved before the font
 * library: drops disallowed characters, collapses spaces and enforces the
 * length limit. (New text: textArtwork.ts cleanText.)
 */
export function sanitiseEmbroideryText(raw: string) {
  return Array.from(raw)
    .filter((ch) => EMBROIDERY_TEXT.allowed.test(ch))
    .join("")
    .replace(/ {2,}/g, " ")
    .slice(0, EMBROIDERY_TEXT.maxLength);
}

let counter = 0;
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `emb-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * A design assigned to a fixed zone: fitted into the zone's box (centred,
 * proportions kept) unless placed inside it (`inZone`: smaller, moved —
 * never past the box; the zone itself never changes), and its production
 * size and position recorded from that.
 */
export function createZoneDesign(placement: PlacementId, image: EmbroideryImage, inZone?: ZoneTransform): EmbroideryElement {
  const element: EmbroideryElement = {
    id: newId(),
    kind: "image",
    text: "",
    image,
    placement,
    offset: [0, 0],
    rotation: 0,
    scale: 1,
    thread: null,
    style: "satin",
    ...(inZone ? { inZone } : {}),
  };
  return withProductionData(element);
}

/**
 * Text in a zone: the customer's text in a library font, fitted into the
 * zone's box like a design (centred, proportions kept) — its size and
 * position recorded for production the same way. Keeps the zone's element
 * id when the text is edited (the jacket updates it in place).
 */
export function createZoneText(
  placement: PlacementId,
  text: string,
  style: Omit<TextEmbroideryStyle, "fitScale">,
  thread: ThreadId,
  id = newId(),
  inZone?: ZoneTransform
): EmbroideryElement {
  const element: EmbroideryElement = {
    id,
    kind: "text",
    text,
    image: null,
    placement,
    offset: [0, 0],
    rotation: 0,
    scale: 1,
    thread,
    style: "satin",
    textStyle: { ...style, fitScale: 1 },
    ...(inZone ? { inZone } : {}),
  };
  return withProductionData(element);
}

/** The proportions a zone element is fitted with (as production measures them), when known. */
export function contentAspect(element: EmbroideryElement): number | null {
  if (element.kind === "text") return element.textStyle?.aspect ?? null;
  const image = element.image;
  if (!image) return null;
  if (image.asUploaded || !image.processed) return image.aspect;
  const [w, h] = stitchGridSize(image.processed.widthPx, image.processed.heightPx);
  return w / h;
}

/** The element with its in-zone placement kept valid for its proportions (none stored = the default). */
function withValidPlacement(element: EmbroideryElement): EmbroideryElement {
  const zone = EMBROIDERY_ZONES_BY_ID[element.placement];
  const aspect = contentAspect(element);
  if (!element.inZone || !zone || !aspect) return element;
  return { ...element, inZone: clampInZone(zone.box, aspect, element.inZone) };
}

/** An image or font-set text element with its production size and position (from its zone and in-zone placement) up to date. */
export function withProductionData(input: EmbroideryElement): EmbroideryElement {
  const element = withValidPlacement(input);
  if (element.kind === "text") {
    const zone = EMBROIDERY_ZONES_BY_ID[element.placement];
    if (!element.textStyle || !zone) return element;
    const production = placementData(element, element.textStyle.aspect);
    const fitScale = Math.round((production.physicalSize.heightCm / (zone.box[1] * 100)) * 1000) / 1000;
    return { ...element, ...production, textStyle: { ...element.textStyle, fitScale } };
  }
  const production = element.image ? imageProductionData(element, element.image) : null;
  return production ? { ...element, ...production } : element;
}

/** Elements that actually produce stitching. */
export function getActiveEmbroidery(config: JacketConfig) {
  return config.embroidery.filter((e) =>
    e.kind === "text" ? e.text.trim() !== "" : e.image !== null
  );
}

/**
 * Reasons the design can't be ordered yet, as ids (the UI shows them via
 * configurator.issues.<id>). Empty when ready.
 */
export type ConfigIssue = "selectSize";

export function getConfigIssues(config: JacketConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (!config.size) issues.push("selectSize");
  return issues;
}
