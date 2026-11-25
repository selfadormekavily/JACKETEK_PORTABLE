// Jacket designs sent to group orders: checked, bounded and reduced to
// what other members may see. Pure functions (no database).
//
// A design is the configurator's JacketConfig, stored exactly as sent apart
// from two production-only fields the server derives itself and never
// stores (`textArtwork`, `image.colourRegions`).
//
// Limits (uploaded artwork travels inside the design as data URLs; the
// configurator accepts files up to 15 MB — prepareUpload.ts):
//   one data URL (artwork)      ≤ 21 MB of text (a 15 MB file in base64 + header)
//   one design (JSON)           ≤ 45 MB
//   one item request            ≤ 48 MB
//   one import request          ≤ 100 MB and ≤ 20 jackets (what one checkout accepts)
//   one preview (still image)   ≤ 2 MB decoded, PNG / JPEG / WebP only
//   any other string            ≤ 4096 characters; data URLs only where artwork belongs
import { createHash } from "node:crypto";

export const LIMITS = {
  dataUrlChars: 21 * 1024 * 1024,
  configBytes: 45 * 1024 * 1024,
  itemRequestBytes: 48 * 1024 * 1024,
  importRequestBytes: 100 * 1024 * 1024,
  importItems: 20,
  previewBytes: 2 * 1024 * 1024,
  plainString: 4096,
  embroidery: 12,
  arrayLength: 64,
  objectKeys: 64,
  depth: 10,
};

/** The configurator's upload types (embroideryGeometry.ts ZONE_IMAGE_TYPES). */
const ARTWORK_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/svg+xml"]);
const PREVIEW_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Where artwork may be embedded: embroidery[i].image.src and embroidery[i].image.original.src. */
const ARTWORK_PATH = /^embroidery\.\d+\.image(\.original)?\.src$/;
const LIBRARY_PATH = /^(?:\/embroidery-library\/|assets\/)[A-Za-z0-9._\-/]{1,300}$/;

const CONFIG_KEYS = new Set(["colours", "materials", "buttons", "zipper", "embroidery", "size", "fit"]);
const ELEMENT_KEYS = new Set(["id", "kind", "text", "image", "placement", "offset", "rotation", "scale", "thread", "style", "physicalSize", "referencePosition", "textStyle", "inZone"]);
const IMAGE_KEYS = new Set(["src", "aspect", "asUploaded", "library", "frontLetters", "colourway", "processed", "original"]);
/** Production-only fields (added by the server on a copy, never stored). */
const STRIP_ELEMENT = ["textArtwork"];
const STRIP_IMAGE = ["colourRegions"];

export class DesignError extends Error {
  constructor(issues) {
    super(issues.map((i) => `${i.path || "design"}: ${i.message}`).join(" "));
    this.issues = issues;
  }
}

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);

/** First bytes of each raster type ("magic numbers"). */
function sniff(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.toString("latin1", 0, 6))) return "image/gif";
  if (bytes.length >= 2 && bytes.toString("latin1", 0, 2) === "BM") return "image/bmp";
  return null;
}

const DATA_URL = /^data:([a-z0-9.+/-]+);base64,/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * A base64 data URL of an allowed image type whose bytes really are that
 * type. Returns { type, bytes } or an error message.
 */
function checkDataUrl(value, types, maxBytes) {
  const m = DATA_URL.exec(value);
  if (!m) return { error: "must be a base64 data URL." };
  const type = m[1].toLowerCase();
  if (!types.has(type)) return { error: `type ${type} is not allowed.` };
  const body = value.slice(m[0].length);
  if (!body || body.length % 4 !== 0 || !BASE64.test(body)) return { error: "is not valid base64." };
  if ((body.length / 4) * 3 > maxBytes + 2) return { error: "is too large." };
  const bytes = Buffer.from(body, "base64");
  if (bytes.length > maxBytes) return { error: "is too large." };
  if (type === "image/svg+xml") {
    if (!/^\s*(<\?xml|<svg|<!--)/i.test(bytes.toString("utf8", 0, 256).replace(/^﻿/, ""))) return { error: "is not an SVG image." };
  } else if (sniff(bytes) !== type) return { error: `content is not ${type}.` };
  return { type, bytes };
}

/**
 * Bounds every value in the design: depth, sizes, and data URLs only where
 * artwork belongs (so nothing large or executable hides in another field).
 */
function walk(value, path, depth, issues) {
  if (issues.length > 20) return;
  if (depth > LIMITS.depth) return issues.push({ path, message: "is nested too deeply." });
  if (typeof value === "string") {
    if (ARTWORK_PATH.test(path)) {
      if (value.startsWith("data:")) {
        if (value.length > LIMITS.dataUrlChars) return issues.push({ path, message: "artwork is too large (max 15 MB per file)." });
        const r = checkDataUrl(value, ARTWORK_TYPES, LIMITS.dataUrlChars);
        if (r.error) issues.push({ path, message: `artwork ${r.error}` });
      } else if (!LIBRARY_PATH.test(value) || value.includes("..")) issues.push({ path, message: "must be an uploaded image or a library design path." });
      return;
    }
    if (value.startsWith("data:")) return issues.push({ path, message: "may not contain embedded files." });
    if (value.length > LIMITS.plainString) issues.push({ path, message: "is too long." });
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) issues.push({ path, message: "must be a finite number." });
    return;
  }
  if (value === null || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length > LIMITS.arrayLength) return issues.push({ path, message: "has too many entries." });
    value.forEach((v, i) => walk(v, path ? `${path}.${i}` : String(i), depth + 1, issues));
    return;
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (keys.length > LIMITS.objectKeys) return issues.push({ path, message: "has too many fields." });
    for (const k of keys) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        issues.push({ path, message: `field "${k}" is not allowed.` });
        continue;
      }
      walk(value[k], path ? `${path}.${k}` : k, depth + 1, issues);
    }
    return;
  }
  issues.push({ path, message: "has an unsupported value." });
}

/** Unknown fields are tolerated only as plain values (older designs); never objects or arrays. */
function unknownFields(obj, known, path, issues) {
  for (const [k, v] of Object.entries(obj)) {
    if (!known.has(k) && v !== null && typeof v === "object") issues.push({ path: path ? `${path}.${k}` : k, message: "is not a known design field." });
  }
}

/**
 * Checks a design for a group order against the catalog (`S`: the shared
 * module from server/tsModule.mjs). Returns the design to store (production-
 * only fields removed) or throws DesignError with every issue found.
 */
export function validateConfig(raw, S) {
  const issues = [];
  if (!isObject(raw)) throw new DesignError([{ path: "config", message: "is missing." }]);

  // Production-only fields are dropped from the stored copy.
  const config = { ...raw };
  if (Array.isArray(raw.embroidery)) {
    config.embroidery = raw.embroidery.map((e) => {
      if (!isObject(e)) return e;
      const el = { ...e };
      for (const k of STRIP_ELEMENT) delete el[k];
      if (isObject(e.image)) {
        el.image = { ...e.image };
        for (const k of STRIP_IMAGE) delete el.image[k];
      }
      return el;
    });
  }

  walk(config, "", 0, issues);
  if (issues.length) throw new DesignError(issues);
  unknownFields(config, CONFIG_KEYS, "", issues);

  const ids = (list) => new Set(list.map((x) => (typeof x === "string" ? x : x.id)));
  const colourIds = ids(S.ALL_COLOURS);
  const need = (cond, path, message) => {
    if (!cond) issues.push({ path, message });
  };

  need(isObject(config.colours), "colours", "is missing.");
  if (isObject(config.colours)) for (const z of ["body", "sleeves", "trim"]) need(colourIds.has(config.colours[z]), `colours.${z}`, "is not a catalog colour.");
  need(isObject(config.materials), "materials", "is missing.");
  if (isObject(config.materials)) for (const z of ["body", "sleeves"]) need(ids(S.MATERIALS).has(config.materials[z]), `materials.${z}`, "is not a catalog material.");
  need(ids(S.BUTTON_FINISHES).has(config.buttons), "buttons", "is not a catalog finish.");
  need(typeof config.zipper === "boolean", "zipper", "must be true or false.");
  need(ids(S.SIZES).has(config.size), "size", "select a size.");
  need(ids(S.FITS).has(config.fit), "fit", "is not a catalog fit.");

  need(Array.isArray(config.embroidery), "embroidery", "must be a list.");
  if (Array.isArray(config.embroidery)) {
    need(config.embroidery.length <= LIMITS.embroidery, "embroidery", "has too many designs.");
    const seenIds = new Set();
    const seenZones = new Set();
    config.embroidery.forEach((e, i) => {
      const p = `embroidery.${i}`;
      if (!isObject(e)) return issues.push({ path: p, message: "must be an object." });
      unknownFields(e, ELEMENT_KEYS, p, issues);
      need(typeof e.id === "string" && e.id.length >= 1 && e.id.length <= 100 && !seenIds.has(e.id), `${p}.id`, "must be a unique id.");
      seenIds.add(e.id);
      need(e.kind === "text" || e.kind === "image", `${p}.kind`, "must be text or image.");
      const fixed = Object.hasOwn(S.EMBROIDERY_ZONES_BY_ID, e.placement);
      need(fixed || Object.hasOwn(S.LEGACY_ZONES, e.placement), `${p}.placement`, "is not an embroidery zone.");
      if (fixed) {
        need(!seenZones.has(e.placement), `${p}.placement`, "holds more than one design.");
        seenZones.add(e.placement);
      }
      need(typeof e.text === "string" && e.text.length <= 400, `${p}.text`, "must be text (max 400 characters).");
      need(e.thread === null || e.thread === undefined || (typeof e.thread === "string" && e.thread.length <= 64), `${p}.thread`, "is not a thread.");
      if (e.offset !== undefined) need(Array.isArray(e.offset) && e.offset.length === 2 && e.offset.every(finite), `${p}.offset`, "must be two numbers.");
      for (const k of ["rotation", "scale"]) if (e[k] !== undefined) need(finite(e[k]), `${p}.${k}`, "must be a number.");
      if (e.kind === "image") {
        if (!isObject(e.image)) return issues.push({ path: `${p}.image`, message: "is missing." });
        unknownFields(e.image, IMAGE_KEYS, `${p}.image`, issues);
        need(typeof e.image.src === "string" && e.image.src.length > 0, `${p}.image.src`, "is missing.");
        need(finite(e.image.aspect) && e.image.aspect > 0, `${p}.image.aspect`, "must be a positive number.");
      } else need(e.image === null || e.image === undefined, `${p}.image`, "must be empty for text.");
    });
  }
  if (issues.length) throw new DesignError(issues);
  return config;
}

/** A display-only still of the jacket: null, or { type, bytes }. */
export function validatePreview(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") throw new DesignError([{ path: "preview", message: "must be an image data URL or null." }]);
  if (raw.length > Math.ceil(LIMITS.previewBytes / 3) * 4 + 64) throw new DesignError([{ path: "preview", message: "is too large (max 2 MB)." }]);
  const r = checkDataUrl(raw, PREVIEW_TYPES, LIMITS.previewBytes);
  if (r.error) throw new DesignError([{ path: "preview", message: r.error }]);
  return r;
}

export function validateQuantity(raw, max) {
  if (!Number.isInteger(raw) || raw < 1 || raw > max) throw new DesignError([{ path: "quantity", message: `must be a whole number from 1 to ${max}.` }]);
  return raw;
}

/** Same JSON for the same design, whatever order its fields were written in. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

/**
 * Identifies a request's content for idempotency: the design and quantity.
 * The preview is left out (it is display-only and may be re-taken on a retry).
 */
export const requestHash = (config, quantity) => createHash("sha256").update(stable({ config, quantity })).digest("hex");

/**
 * What OTHER members see of a design: the choices and visible embroidery
 * (zone, text, thread, which library design) — never uploaded artwork,
 * its file names, or anything needed to edit or reproduce it.
 */
export function visibleDesign(config) {
  return {
    size: config.size ?? null,
    fit: config.fit ?? null,
    colours: config.colours,
    materials: config.materials,
    buttons: config.buttons,
    zipper: config.zipper,
    embroidery: (config.embroidery ?? [])
      .filter((e) => (e.kind === "text" ? typeof e.text === "string" && e.text.trim() !== "" : !!e.image?.src))
      .map((e) => {
        if (e.kind === "text") return { placement: e.placement, kind: "text", text: e.text, thread: e.thread ?? null };
        const img = e.image;
        const design = img.library
          ? { source: "library", libraryTitle: img.library.libraryTitle ?? null, designId: img.library.designId ?? null }
          : { source: "upload" };
        if (img.frontLetters) design.frontLetters = { letter1: img.frontLetters.letter1, letter2: img.frontLetters.letter2, style: img.frontLetters.style };
        return { placement: e.placement, kind: "image", thread: e.thread ?? null, design };
      }),
  };
}
