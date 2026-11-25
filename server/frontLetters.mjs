// Front Letters in orders (server side).
//
// A Front Letters design is ordered as a template + two letters (the image's
// `frontLetters`). Production never trusts a picture for it: the artwork is
// rebuilt here from the letter template on disk
// (<library>/letter-templates/<templateId>/, embroideryLibrary.mjs) with the same rule
// the configurator and the generator use — each slot gets its letter (the
// design's own original A for "A"), then the slot's name band if the design has
// one. "A A" is the design's original file itself.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { libraryPath } from "./embroideryLibrary.mjs";
import { decodePng, encodePng } from "./png.mjs";

/** A template's file (the colour layers overlay's when it has one: embroideryLibrary.mjs). */
const templateFile = (templateId, file) => libraryPath(`letter-templates/${templateId}/${file}`);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The letter template of a Front Letters design (null when there is none). */
export function letterTemplate(templateId) {
  if (!ID.test(templateId ?? "")) return null;
  const file = templateFile(templateId, "template.json");
  return file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** Draws an RGBA image onto another at (x, y), "source over" (as a canvas does). */
function drawOver(dst, src, x0, y0) {
  for (let y = 0; y < src.height; y++) {
    const Y = y + y0;
    if (Y < 0 || Y >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const X = x + x0;
      if (X < 0 || X >= dst.width) continue;
      const s = (y * src.width + x) * 4, d = (Y * dst.width + X) * 4, as = src.data[s + 3] / 255;
      if (as === 0) continue;
      const ad = dst.data[d + 3] / 255, ao = as + ad * (1 - as);
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round((src.data[s + c] * as + dst.data[d + c] * ad * (1 - as)) / ao);
      dst.data[d + 3] = Math.round(ao * 255);
    }
  }
}

/** Copies a region map's layer pixels (opaque) onto another at (x, y) — exactly, never blended (as a canvas without smoothing does). */
function drawCopy(dst, src, x0, y0) {
  for (let y = 0; y < src.height; y++) {
    const Y = y + y0;
    if (Y < 0 || Y >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const X = x + x0;
      if (X < 0 || X >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      if (src.data[s + 3] === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), (Y * dst.width + X) * 4);
    }
  }
}

/** The images drawn for two letters, in order: each slot's letter (its own original A for "A"), then its name band. */
function letterLayers(t, letters) {
  return [...letters].flatMap((ch, i) => {
    const slot = t.slots[i];
    if (ch === "A") return [slot.originalA];
    const g = t.glyphs[ch];
    if (!g) throw new Error(`Front Letters template ${t.templateId} has no letter ${ch}.`);
    return [{ file: g.file, regions: g.regions, x: slot.x + g.dx, y: slot.y + g.dy }, ...(slot.overlay ? [slot.overlay] : [])];
  });
}

/** A template's colour layers, when it has them and every letter has its region map (null: none). */
export function lettersColourway(t) {
  if (!t?.colourway?.slots?.length) return null;
  const all = t.slots.every((s) => s.originalA.regions && (!s.overlay || s.overlay.regions)) && Object.values(t.glyphs).every((g) => g.regions);
  return all ? t.colourway : null;
}

/**
 * The artwork of a Front Letters selection, as a PNG buffer — or null for "A A"
 * (the design's own file is the artwork). With `regions` (a template with
 * colour layers), always composed, with its region map composed the same
 * way. Throws on an unknown template or letter.
 */
export function composeFrontLetters(sel, { regions = false } = {}) {
  const t = letterTemplate(sel?.templateId);
  if (!t) throw new Error(`Front Letters template ${sel?.templateId} is not in the letter templates.`);
  const letters = `${sel.letter1 ?? ""}${sel.letter2 ?? ""}`;
  if (!/^[A-Z]{2}$/.test(letters)) throw new Error(`Front Letters: "${letters}" is not two letters A–Z.`);
  if (letters === t.defaultLetters && !regions) return null;
  if (regions && !lettersColourway(t)) throw new Error(`Front Letters template ${t.templateId} has no colour layers.`);
  const read = (f) => {
    const file = templateFile(t.templateId, f);
    if (!file || !existsSync(file)) throw new Error(`Front Letters template ${t.templateId}: ${f} is missing.`);
    return decodePng(readFileSync(file));
  };
  const blank = () => ({ width: t.canvas.width, height: t.canvas.height, data: new Uint8Array(t.canvas.width * t.canvas.height * 4) });
  const layers = letterLayers(t, letters);
  const out = blank();
  for (const l of layers) drawOver(out, read(l.file), l.x, l.y);
  let map = null;
  if (regions) {
    map = blank();
    for (const l of layers) drawCopy(map, read(l.regions), l.x, l.y);
  }
  return { png: encodePng(out), regionsPng: map ? encodePng(map) : null, width: out.width, height: out.height, letters, template: t };
}
