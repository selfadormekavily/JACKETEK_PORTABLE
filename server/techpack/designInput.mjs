// The live configurator design sent for a DEVELOPMENT tech pack (server/techpack/development.mjs).
//
// The browser sends the JacketConfig exactly as the configurator holds it. It is checked here
// against the catalog and the embroidery library before anything is built:
//   - every catalog choice is a known id; a size is selected;
//   - every embroidery element sits in a known zone, with finite numbers;
//   - images are either a ready-made library design (its id and asset must be that design's own
//     entry in the library index — the server then reads the library file, never a browser path),
//     or an embedded upload (data URL, image type checked by its magic bytes later);
//   - no other kind of path or URL is accepted anywhere an asset is read.
// The checked design is returned as a deep copy; nothing from the browser reaches the file system.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIBRARY_DIR, LIBRARY_URL, libraryFile } from "../embroideryLibrary.mjs";

export class DesignInputError extends Error {
  constructor(issues) {
    super(`The design can't be used: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
    this.issues = issues;
    this.status = 422;
  }
}

const LIMITS = { depth: 12, keys: 80, string: 25 * 1024 * 1024, embroidery: 20, text: 400, dataUrl: 16 * 1024 * 1024 };
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/;
// Production-only fields the browser must never supply (the server rebuilds them).
const STRIP_ELEMENT = ["textArtwork"];
const STRIP_IMAGE = ["colourRegions"];

let libraryIndex = null;
/** library design id → its index entry (runtime-assets/embroidery-library/library.json). */
function library() {
  if (!libraryIndex) {
    const lib = JSON.parse(readFileSync(join(LIBRARY_DIR, "library.json"), "utf8"));
    libraryIndex = new Map(lib.designs.map((d) => [d.id, d]));
  }
  return libraryIndex;
}

/** Plain JSON only: bounded depth, size and keys; no prototype keys. */
function walk(v, path, depth, issues) {
  if (depth > LIMITS.depth) return issues.push({ path, message: "is nested too deeply." });
  if (v === null || typeof v === "boolean" || finite(v)) return;
  if (typeof v === "number") return issues.push({ path, message: "must be a finite number." });
  if (typeof v === "string") return v.length > LIMITS.string ? issues.push({ path, message: "is too long." }) : undefined;
  if (Array.isArray(v)) {
    if (v.length > 200) return issues.push({ path, message: "has too many entries." });
    return v.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1, issues));
  }
  if (isObject(v)) {
    const keys = Object.keys(v);
    if (keys.length > LIMITS.keys) return issues.push({ path, message: "has too many fields." });
    for (const k of keys) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") issues.push({ path, message: `field "${k}" is not allowed.` });
      else walk(v[k], path ? `${path}.${k}` : k, depth + 1, issues);
    }
    return;
  }
  issues.push({ path, message: "has an unsupported value." });
}

/**
 * Checks the live design. `S` is the shared module (server/tsModule.mjs): catalog and zones.
 * Returns a deep copy, ready for the tech pack, or throws DesignInputError with every issue.
 */
export function validateDevelopmentDesign(raw, S) {
  const issues = [];
  if (!isObject(raw)) throw new DesignInputError([{ path: "config", message: "is missing." }]);
  walk(raw, "config", 0, issues);
  if (issues.length) throw new DesignInputError(issues);
  const config = structuredClone(raw);
  const need = (cond, path, message) => {
    if (!cond) issues.push({ path, message });
  };
  const ids = (list) => new Set(list.map((x) => (typeof x === "string" ? x : x.id)));
  const colours = ids(S.ALL_COLOURS);

  need(isObject(config.colours), "colours", "is missing.");
  if (isObject(config.colours)) for (const z of ["body", "sleeves", "trim"]) need(colours.has(config.colours[z]), `colours.${z}`, "is not a catalog colour.");
  need(isObject(config.materials), "materials", "is missing.");
  if (isObject(config.materials)) for (const z of ["body", "sleeves"]) need(ids(S.MATERIALS).has(config.materials[z]), `materials.${z}`, "is not a catalog material.");
  need(ids(S.BUTTON_FINISHES).has(config.buttons), "buttons", "is not a catalog finish.");
  need(typeof config.zipper === "boolean", "zipper", "must be true or false.");
  need(ids(S.SIZES).has(config.size), "size", "select a size first.");
  need(ids(S.FITS).has(config.fit), "fit", "is not a catalog fit.");

  need(Array.isArray(config.embroidery), "embroidery", "must be a list.");
  if (Array.isArray(config.embroidery)) {
    need(config.embroidery.length <= LIMITS.embroidery, "embroidery", "has too many designs.");
    const seenIds = new Set();
    const seenZones = new Set();
    config.embroidery.forEach((e, i) => {
      const p = `embroidery[${i}]`;
      if (!isObject(e)) return issues.push({ path: p, message: "must be an object." });
      for (const k of STRIP_ELEMENT) delete e[k];
      need(typeof e.id === "string" && e.id.length >= 1 && e.id.length <= 100 && !seenIds.has(e.id), `${p}.id`, "must be a unique id.");
      seenIds.add(e.id);
      need(e.kind === "text" || e.kind === "image", `${p}.kind`, "must be text or image.");
      const fixed = Object.hasOwn(S.EMBROIDERY_ZONES_BY_ID, e.placement);
      need(fixed || Object.hasOwn(S.LEGACY_ZONES, e.placement), `${p}.placement`, "is not an embroidery zone.");
      if (fixed) {
        need(!seenZones.has(e.placement), `${p}.placement`, "holds more than one design.");
        seenZones.add(e.placement);
      }
      need(typeof e.text === "string" && e.text.length <= LIMITS.text, `${p}.text`, `must be text (max ${LIMITS.text} characters).`);
      need(e.thread === null || e.thread === undefined || (typeof e.thread === "string" && e.thread.length <= 64), `${p}.thread`, "is not a thread.");
      if (e.offset !== undefined) need(Array.isArray(e.offset) && e.offset.length === 2 && e.offset.every(finite), `${p}.offset`, "must be two numbers.");
      for (const k of ["rotation", "scale"]) if (e[k] !== undefined) need(finite(e[k]), `${p}.${k}`, "must be a number.");
      if (e.inZone !== undefined) need(isObject(e.inZone) && ["scale", "x", "y"].every((k) => finite(e.inZone[k])), `${p}.inZone`, "must be { scale, x, y } numbers.");
      if (e.kind === "text") {
        need(e.image === null || e.image === undefined, `${p}.image`, "must be empty for text.");
        return;
      }
      const img = e.image;
      if (!isObject(img)) return issues.push({ path: `${p}.image`, message: "is missing." });
      for (const k of STRIP_IMAGE) delete img[k];
      need(finite(img.aspect) && img.aspect > 0, `${p}.image.aspect`, "must be a positive number.");
      need(typeof img.src === "string" && img.src.length > 0, `${p}.image.src`, "is missing.");
      if (typeof img.src !== "string") return;
      if (img.library) {
        // A ready-made design: it must be the library's own entry; production reads the library file.
        const d = isObject(img.library) ? library().get(img.library.id) : null;
        need(!!d, `${p}.image.library`, "is not a design in the embroidery library.");
        if (!d) return;
        need(img.library.asset === d.asset && img.library.designId === d.designId && img.library.libraryId === d.libraryId, `${p}.image.library`, "does not match the library entry.");
        need(!!libraryFile(d.asset, "assets"), `${p}.image.library.asset`, "is not inside the embroidery library.");
        const derived = !!img.frontLetters || !!img.colourway;
        if (img.src.startsWith("data:")) {
          // Only a preview the server rebuilds (Front Letters, recoloured colourway) may be embedded.
          need(derived, `${p}.image.src`, "must be the library design's own file.");
          need(img.src.length <= LIMITS.dataUrl && DATA_IMAGE.test(img.src), `${p}.image.src`, "is not an embedded image.");
        } else {
          need(img.src === d.asset, `${p}.image.src`, "must be the library design's own file.");
        }
        if (img.frontLetters) {
          const fl = img.frontLetters;
          need(isObject(fl) && /^[A-Z]$/.test(fl.letter1) && /^[A-Z]$/.test(fl.letter2) && fl.templateId === d.designId, `${p}.image.frontLetters`, "must be two letters A–Z on this template.");
        }
        if (img.original?.src !== undefined) need(false, `${p}.image.original.src`, "is not used for library designs.");
      } else {
        // A customer upload: embedded image data only.
        need(img.src.startsWith("data:") && img.src.length <= LIMITS.dataUrl && DATA_IMAGE.test(img.src), `${p}.image.src`, "must be an embedded image.");
        need(!img.frontLetters && !img.colourway, `${p}.image`, "an upload can't carry library selections.");
        if (img.original?.src !== undefined) need(typeof img.original.src === "string" && img.original.src.startsWith("data:") && img.original.src.length <= LIMITS.dataUrl, `${p}.image.original.src`, "must be an embedded file.");
      }
      if (img.src.startsWith(LIBRARY_URL) && !img.library) need(false, `${p}.image.src`, "a library path needs its library reference.");
    });
  }
  if (issues.length) throw new DesignInputError(issues);
  return config;
}
