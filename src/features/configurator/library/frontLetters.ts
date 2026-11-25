import type { EmbroideryImage, FrontLettersSelection } from "../model/types";
import {
  changedColours,
  colourwaySelection,
  recolouredCanvas,
  type Colours,
  type ColourwaySlot,
  type ColourwaySubject,
  type DesignColourway,
} from "./colourways";
import { libraryImage, type LibraryDesign } from "./library";
import { LIBRARY_URL } from "./root";

/**
 * FRONT LETTERS — the ready-made "two letters" designs of the library, made
 * customisable: the customer keeps the design's lettering style and chooses
 * the two letters.
 *
 * Each of the 20 Front Letters designs (flattened "A A" artworks) has a LETTER
 * TEMPLATE generated from it by scripts/front-letters/build.mjs, in
 * <library>/letter-templates/<designId>/ (root.ts):
 *   template.json — the two letter slots (where the design's two A's are),
 *                   each glyph's offset in its slot, the style;
 *   glyphs/A-1.png, A-2.png — the design's own two A's, cut out unchanged;
 *   glyphs/B.png … Z.png    — that style's letters, built from its A;
 *   glyphs/band-1/2.png     — designs with a name across the letter: the name.
 * The letters are drawn into the design's own canvas, at the A's places, so
 * the result has the same size and proportions — the Left Chest zone fits it
 * exactly like the original. "AA" is the original file itself, unchanged.
 * No font is used anywhere.
 *
 * COLOURS: a template authored with colour layers also has `colourway` (its
 * slots — letters, outline… — as in colourways.ts) and, next to every glyph,
 * a region map (`regions`: opaque where a slot's pixels are, the slot number
 * in red; transparent elsewhere = keep). The maps are composed exactly like
 * the letters, and the letters recoloured from them — the same rule the
 * server rebuilds the production artwork with (server/frontLetters.mjs).
 * Templates without them keep their own colours.
 */

export const FRONT_LETTERS_LIBRARY_ID = "23ff73fd-b78f-4718-9109-2b8f73076954";
export const DEFAULT_LETTERS = "AA";
const ROOT = `${LIBRARY_URL}/letter-templates`;

/** A placed image, with its region map when the template has colour layers. */
type Placed = { file: string; x: number; y: number; regions?: string };
export type FrontLettersTemplate = {
  version: number;
  type: "front-letters";
  templateId: string;
  libraryId: string;
  originalFileName: string;
  asset: string;
  style: { id: string; name: string; family: string; approximation: boolean; notes: string };
  canvas: { width: number; height: number };
  defaultLetters: string;
  characters: string;
  slots: { x: number; y: number; originalA: Placed & { width: number; height: number }; overlay: Placed | null }[];
  glyphs: Record<string, { file: string; dx: number; dy: number; width: number; height: number; regions?: string }>;
  /**
   * Colour layers the customer can change (with region maps on every
   * glyph), and how they were drawn: `outline.widthShare` = the outline's
   * stroke width as a share of the letter height (template-defined; the
   * generator draws it, so it can be tuned per style later).
   */
  colourway?: { version: number; keepOriginal: true; subject?: ColourwaySubject; outline?: { widthShare: number }; slots: ColourwaySlot[] };
};

type LettersIndex = { version: number; libraryId: string; templates: Record<string, { file: string; style: string; name: string; approximation: boolean }> };

let indexRequest: Promise<LettersIndex | null> | null = null;
/** Which designs have a letter template (fetched once). */
export function loadLettersIndex(): Promise<LettersIndex | null> {
  indexRequest ??= fetch(`${ROOT}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<LettersIndex>) : null))
    .catch(() => null);
  return indexRequest;
}

const templates = new Map<string, Promise<FrontLettersTemplate>>();
export function loadTemplate(templateId: string): Promise<FrontLettersTemplate> {
  let t = templates.get(templateId);
  if (!t) {
    t = fetch(`${ROOT}/${templateId}/template.json`).then((r) => {
      if (!r.ok) throw new Error(`Front Letters template ${templateId} is missing.`);
      return r.json() as Promise<FrontLettersTemplate>;
    });
    t.catch(() => templates.delete(templateId));
    templates.set(templateId, t);
  }
  return t;
}

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Couldn't load ${src}`));
      img.src = src;
    });
    p.catch(() => images.delete(src));
    images.set(src, p);
  }
  return p;
}

/** A library design that is a Front Letters template. */
export const isFrontLettersDesign = (design: { libraryId: string }) => design.libraryId === FRONT_LETTERS_LIBRARY_ID;

/** One typed character → an uppercase English letter, or null (digits, symbols, other scripts). */
export function toLetter(input: string): string | null {
  const ch = input.trim().slice(-1).toUpperCase();
  return /^[A-Z]$/.test(ch) ? ch : null;
}

/** The images drawn for two letters, in order: each slot's letter (its own original A for "A"), then its name band. */
function letterLayers(template: FrontLettersTemplate, letters: string): Placed[] {
  return [...letters].flatMap((ch, i) => {
    const slot = template.slots[i];
    if (ch === "A") return [slot.originalA];
    const g = template.glyphs[ch];
    if (!g) throw new Error(`No letter ${ch} in this design.`);
    const out: Placed[] = [{ file: g.file, regions: g.regions, x: slot.x + g.dx, y: slot.y + g.dy }];
    if (slot.overlay) out.push(slot.overlay);
    return out;
  });
}

/** True when the template has colour layers and every letter (and band) has its region map. */
export function colourable(template: FrontLettersTemplate) {
  if (!template.colourway?.slots.length) return false;
  return (
    template.slots.every((s) => s.originalA.regions && (!s.overlay || s.overlay.regions)) &&
    Object.values(template.glyphs).every((g) => g.regions)
  );
}

/**
 * The two letters drawn in the template, at the design's own size — or,
 * with `regions`, their region maps, composed the same way (no smoothing:
 * slot numbers are copied exactly). The same rule as the generator and the
 * server (server/frontLetters.mjs).
 */
export async function composeLetters(template: FrontLettersTemplate, letters: string, regions = false): Promise<HTMLCanvasElement> {
  const base = `${ROOT}/${template.templateId}/`;
  const canvas = document.createElement("canvas");
  canvas.width = template.canvas.width;
  canvas.height = template.canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: regions });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = !regions;
  const layers = letterLayers(template, letters);
  const imgs = await Promise.all(
    layers.map((l) => {
      const file = regions ? l.regions : l.file;
      if (!file) throw new Error("This design has no colour layers.");
      return loadImage(base + file);
    })
  );
  layers.forEach((l, i) => ctx.drawImage(imgs[i], l.x, l.y));
  return canvas;
}

const pixelsOf = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;

/** A Front Letters design's colour slots, when its template has colour layers (null: none). */
export async function lettersColourway(templateId: string): Promise<DesignColourway | null> {
  const template = await loadTemplate(templateId);
  if (!colourable(template)) return null;
  const cw = template.colourway!;
  return { kind: "front-letters", designId: templateId, version: cw.version, subject: cw.subject ?? "letters", slots: cw.slots };
}

/** What the order keeps: the template, the letters and the style. */
export function selection(template: FrontLettersTemplate, letters: string): FrontLettersSelection {
  return {
    type: "front-letters",
    templateId: template.templateId,
    libraryId: template.libraryId,
    letter1: letters[0],
    letter2: letters[1],
    style: template.style.name,
    templateVersion: template.version,
  };
}

/**
 * A Front Letters design with the customer's two letters — and colours, when
 * the template has colour layers (one fill / outline for both letters) — as
 * the zone's image. "AA" in the design's own colours is the design's own file
 * (exactly as before); anything else is drawn into the design's canvas (same
 * size / proportions — fitted the same way).
 */
export async function frontLettersImage(design: LibraryDesign, letters: string, colours: Colours = {}): Promise<EmbroideryImage> {
  const template = await loadTemplate(design.designId);
  const base = libraryImage(design);
  const slots = colourable(template) ? template.colourway!.slots : null;
  const changed = slots ? changedColours(colours, slots) : {};
  const recolour = Object.keys(changed).length > 0;
  if (letters === DEFAULT_LETTERS && !recolour) return { ...base, frontLetters: selection(template, letters) };
  let canvas = await composeLetters(template, letters);
  if (slots && recolour) {
    const map = await composeLetters(template, letters, true);
    canvas = recolouredCanvas(pixelsOf(canvas), pixelsOf(map), canvas.width, canvas.height, slots, changed);
  }
  // The preview's file (the server rebuilds the production file from the template + letters + colours).
  const src = canvas.toDataURL("image/webp", 0.92);
  return {
    ...base,
    src,
    original: {
      fileName: `${(design.originalFileName ?? design.designId).replace(/\.[^.]+$/, "")}_${letters}${recolour ? "_COLOURWAY" : ""}.webp`,
      mimeType: "image/webp",
      widthPx: canvas.width,
      heightPx: canvas.height,
    },
    frontLetters: selection(template, letters),
    ...(slots && recolour ? { colourway: colourwaySelection(template.templateId, template.colourway!.version, slots, changed) } : {}),
  };
}
