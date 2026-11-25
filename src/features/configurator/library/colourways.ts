import { getThread, THREADS } from "../model/catalog";
import type { ColourwaySelection, ColourwaySlotId, EmbroideryImage, ThreadId } from "../model/types";
import { recolourPixels, type ColourwayRegionRef } from "./colourwayRecolour";
import { libraryImage, type LibraryDesign } from "./library";
import { LIBRARY_URL } from "./root";

/**
 * COLOURWAYS — ready-made designs whose colour regions the customer can
 * change independently (letters, outline, number, border…), keeping the
 * stitch shading. One architecture for every editable design:
 *
 * - Plain designs: a colourway generated offline (scripts/colourways/build.mjs,
 *   or authored with the design — scripts/embroidery-fixtures/build.mjs) in
 *   <library>/colourways/<designId>/ (root.ts):
 *     colourway.json — its colour slots (stable ids, labels, semantic key, the
 *                      design's own colour per slot, reference shading, the
 *                      threads allowed), keepOriginal;
 *     regions.png    — per pixel: which slot it belongs to (or "keep original").
 * - Front Letters designs: the same slots in their letter template
 *   (template.json `colourway`), with a region map per glyph — composed
 *   exactly like the letters (frontLetters.ts).
 *
 * A design is editable only with that metadata; a flattened image without
 * it is never recoloured. The original file is never changed: with every
 * slot on its own colour the design IS the original file; a changed colour
 * produces a recoloured image (colourwayRecolour.ts — the same code the
 * server rebuilds the production artwork with), which then goes through
 * the embroidery renderer like any design. Colours are embroidery threads
 * (THREADS: the jacket palette's colours, production-safe ids).
 */

const ROOT = `${LIBRARY_URL}/colourways`;

export type ColourwaySlot = {
  id: ColourwaySlotId;
  index: number;
  /** The slot's name in the data (English; production prints it). */
  label: string;
  role: string;
  /**
   * What the slot is, for the customer's label (catalog.colourwaySlot.<key>:
   * "fill", "outline", "shadow", "border", "detail"…; the design's `subject`
   * — letters, number, text — refines fill / outline: "Letter fill").
   * Without one the label's own key is tried, then "Colour N".
   */
  key?: string;
  /** Threads the slot may take (default: every thread). */
  allowed?: ThreadId[];
  /** The design's own colour in this slot. */
  defaultColor: string;
  /**
   * Designs authored in threads (letters, years, words, crests drawn for
   * the configurator): the thread that own colour is. The slot then shows
   * it as the chosen swatch (no separate "original" choice) and production
   * names it.
   */
  defaultThread?: ThreadId;
  method: "shading-preserving";
  ref: ColourwayRegionRef;
};

export type Colourway = {
  version: number;
  type: "colourway";
  designId: string;
  libraryId: string;
  originalFileName: string;
  asset: string;
  width: number;
  height: number;
  regionMap: string;
  subject?: ColourwaySubject;
  keepOriginal: true;
  /**
   * "override": generated optional colours for a flat design
   * (scripts/colourways/override-layers.mjs). Until a colour is chosen the
   * design is used exactly as it is — preview and production; a chosen
   * colour recolours its layer and is stitched in that thread.
   */
  mode?: "override";
  slots: ColourwaySlot[];
};

/** What the colour editor needs of any editable design: its slots. */
export type DesignColourway = { kind: "image" | "front-letters"; designId: string; version: number; subject?: ColourwaySubject; slots: ColourwaySlot[] };

/**
 * What a design's lettering is, when it is lettering: names its fill and
 * outline slots for the customer ("Letter fill", "Number outline"…).
 */
export type ColourwaySubject = "letters" | "number" | "text";

export type Colours = Partial<Record<ColourwaySlotId, ThreadId | null>>;

type ColourwayIndex = { version: number; designs: Record<string, { file: string; slots: ColourwaySlotId[] }> };

let indexRequest: Promise<ColourwayIndex | null> | null = null;
export function loadColourwayIndex(): Promise<ColourwayIndex | null> {
  indexRequest ??= fetch(`${ROOT}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<ColourwayIndex>) : null))
    .catch(() => null);
  return indexRequest;
}

const definitions = new Map<string, Promise<Colourway>>();
export function loadColourway(designId: string): Promise<Colourway> {
  let p = definitions.get(designId);
  if (!p) {
    p = fetch(`${ROOT}/${designId}/colourway.json`).then((r) => {
      if (!r.ok) throw new Error(`No colourway for ${designId}.`);
      return r.json() as Promise<Colourway>;
    });
    p.catch(() => definitions.delete(designId));
    definitions.set(designId, p);
  }
  return p;
}

/** The plain colourway of a design, when it has one (null: none). */
export async function designColourway(designId: string): Promise<DesignColourway | null> {
  const index = await loadColourwayIndex();
  if (!index?.designs[designId]) return null;
  const cw = await loadColourway(designId);
  return { kind: "image", designId, version: cw.version, subject: cw.subject, slots: cw.slots };
}

/** The threads a slot offers, in palette order. */
export const slotThreads = (slot: Pick<ColourwaySlot, "allowed">) =>
  slot.allowed?.length ? THREADS.filter((t) => slot.allowed!.includes(t.id)) : THREADS;

const pixels = new Map<string, Promise<Uint8ClampedArray>>();
/** An image's RGBA pixels at its own size (cached). */
function pixelsOf(src: string, width: number, height: number): Promise<Uint8ClampedArray> {
  let p = pixels.get(src);
  if (!p) {
    p = new Promise<Uint8ClampedArray>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const x = c.getContext("2d", { willReadFrequently: true });
        if (!x) return reject(new Error("Canvas is not available."));
        x.drawImage(img, 0, 0, width, height);
        resolve(x.getImageData(0, 0, width, height).data);
      };
      img.onerror = () => reject(new Error(`Couldn't load ${src}`));
      img.src = src;
    });
    p.catch(() => pixels.delete(src));
    pixels.set(src, p);
  }
  return p;
}

/** The thread a slot shows: the chosen one, else the design's own thread (null: its own, unnamed colour). */
export const slotThread = (slot: Pick<ColourwaySlot, "id" | "defaultThread">, colours: Partial<Record<ColourwaySlotId, ThreadId>>): ThreadId | null =>
  colours[slot.id] ?? slot.defaultThread ?? null;

/**
 * Only the slots set to a thread the slot offers and that the design has
 * (an empty result = the design's own colours).
 */
export function changedColours(colours: Colours, slots?: readonly ColourwaySlot[]): Partial<Record<ColourwaySlotId, ThreadId>> {
  return Object.fromEntries(
    Object.entries(colours).filter(([id, t]) => {
      if (!t || !THREADS.some((x) => x.id === t)) return false;
      if (!slots) return true;
      const slot = slots.find((s) => s.id === id);
      // A slot set to its own thread is unchanged.
      return !!slot && t !== slot.defaultThread && slotThreads(slot).some((x) => x.id === t);
    })
  ) as Partial<Record<ColourwaySlotId, ThreadId>>;
}

/** What the order keeps of the chosen colours: the design, and the thread per changed slot. */
export const colourwaySelection = (
  designId: string,
  version: number,
  slots: readonly ColourwaySlot[],
  changed: Partial<Record<ColourwaySlotId, ThreadId>>
): ColourwaySelection => ({
  type: "colourway",
  designId,
  colourwayVersion: version,
  colours: changed,
  slots: slots.map((s) => ({
    id: s.id,
    label: s.label,
    ...(s.key ? { key: s.key } : {}),
    defaultColor: s.defaultColor,
    ...(s.defaultThread ? { defaultThread: s.defaultThread } : {}),
  })),
});

/**
 * Artwork pixels + its region map → a canvas with the changed slots
 * recoloured (shading kept; everything else exactly as it was).
 */
export function recolouredCanvas(
  src: Uint8ClampedArray,
  regions: Uint8ClampedArray,
  width: number,
  height: number,
  slots: readonly ColourwaySlot[],
  changed: Partial<Record<ColourwaySlotId, ThreadId>>
): HTMLCanvasElement {
  const refs = [null, ...slots.map((s) => s.ref)];
  const targets = slots.map((s) => (changed[s.id] ? getThread(changed[s.id]!).hex : null));
  const out = recolourPixels(src, regions, refs, targets);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const x = c.getContext("2d");
  if (!x) throw new Error("Canvas is not available.");
  const data = x.createImageData(width, height);
  data.data.set(out);
  x.putImageData(data, 0, 0);
  return c;
}

/**
 * The design with these colours, as the zone's image. No changed slot → the
 * design's own file, exactly as before (never a regenerated copy).
 */
export async function colourwayImage(design: LibraryDesign, colours: Colours): Promise<EmbroideryImage> {
  const base = libraryImage(design);
  if (!Object.keys(changedColours(colours)).length) return base;
  const cw = await loadColourway(design.designId);
  const changed = changedColours(colours, cw.slots);
  if (!Object.keys(changed).length) return base;
  const [src, regions] = await Promise.all([
    pixelsOf(design.asset, cw.width, cw.height),
    pixelsOf(`${ROOT}/${cw.designId}/${cw.regionMap}`, cw.width, cw.height),
  ]);
  const canvas = recolouredCanvas(src, regions, cw.width, cw.height, cw.slots, changed);
  return {
    ...base,
    // The preview's file (the server rebuilds the production file from the original + these colours).
    src: canvas.toDataURL("image/webp", 0.92),
    original: {
      fileName: `${(design.originalFileName ?? design.designId).replace(/\.[^.]+$/, "")}_COLOURWAY.webp`,
      mimeType: "image/webp",
      widthPx: cw.width,
      heightPx: cw.height,
    },
    colourway: colourwaySelection(cw.designId, cw.version, cw.slots, changed),
  };
}
