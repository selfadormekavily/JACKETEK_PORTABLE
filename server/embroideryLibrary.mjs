// Where the embroidery library's files are on disk (server side).
//
// The site serves the library under one URL prefix, /embroidery-library/
// (src/features/configurator/library/root.ts); orders store paths under it.
// The library lives OUTSIDE public/ — in runtime-assets/embroidery-library at
// the project root — so `npm run build` does not copy its ~1.7 GB into dist/.
// The Node server (production) and the Vite dev server (vite.config.ts) both
// serve the prefix from this one folder: library.json, assets/, colourways/
// and letter-templates/. EMBROIDERY_LIBRARY_DIR (in .env.local; relative to
// the project root, or absolute) points it at another folder instead.
//
// COLOUR LAYERS OVERLAY: colour masks authored for library designs that were
// flattened (e.g. the Front Letters templates: their glyphs' fill / outline
// region maps) live in an overlay folder that mirrors the library's paths —
// embroidery-library-layers/ at the project root (git-ignored: derived from
// the licensed artwork; built by scripts/front-letters/colour-layers.mjs), or
// EMBROIDERY_LAYERS_DIR. A file there is served and read in place of the
// library's own; the library itself is never written to.
import "./env.mjs";
import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configured = process.env.EMBROIDERY_LIBRARY_DIR?.trim();
const layers = process.env.EMBROIDERY_LAYERS_DIR?.trim();

/** The URL prefix library files are served (and stored in orders) under. */
export const LIBRARY_URL = "/embroidery-library";

/** The default library folder, relative to the project root. */
export const DEFAULT_LIBRARY_DIR = join("runtime-assets", "embroidery-library");

/** The library folder on disk. */
export const LIBRARY_DIR = resolve(ROOT, configured || DEFAULT_LIBRARY_DIR);

/** The colour layers overlay folder (may not exist). */
export const LAYERS_DIR = layers ? resolve(ROOT, layers) : join(ROOT, "embroidery-library-layers");

const isFile = (f) => existsSync(f) && statSync(f).isFile();

/**
 * A path inside `base` for a library-relative path, or null when it would
 * leave it. Hidden names (a segment starting with ".") are never served.
 */
function inside(base, rel) {
  if (typeof rel !== "string" || rel.includes("\0") || rel.split(/[\\/]/).some((seg) => seg.startsWith("."))) return null;
  const file = resolve(base, rel);
  const r = relative(base, file);
  return r && !r.startsWith("..") && !isAbsolute(r) ? file : null;
}

/**
 * A library-relative path ("letter-templates/<id>/template.json") → its file
 * on disk: the colour layers overlay's when it has one, else the library's.
 * Null when the path would leave the library.
 */
export function libraryPath(rel) {
  const own = inside(LIBRARY_DIR, rel);
  if (!own) return null;
  const overlay = inside(LAYERS_DIR, rel);
  return overlay && isFile(overlay) ? overlay : own;
}

/**
 * A library URL path ("/embroidery-library/assets/…") → its file on disk
 * (overlay first), or null when it isn't one or would leave the library
 * folder (or `subdir` of it).
 */
export function libraryFile(urlPath, subdir = "") {
  if (typeof urlPath !== "string" || !urlPath.startsWith(`${LIBRARY_URL}/`)) return null;
  let rest;
  try {
    rest = decodeURIComponent(urlPath.slice(LIBRARY_URL.length + 1).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (subdir) {
    const r = relative(subdir, rest);
    if (!r || r.startsWith("..") || isAbsolute(r)) return null;
  }
  return libraryPath(rest);
}

/**
 * True for a raw request target under the library prefix that tries to leave
 * it or reach a hidden name ("/embroidery-library/../x", "%2e%2e", "%2E%2E",
 * "..%5c", double-encoded "%252e"…). URL parsing resolves such paths to
 * somewhere outside the prefix before the library handler sees them (and the
 * site page would answer), so the server checks the raw target first.
 */
export function isLibraryTraversal(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  let path = rawUrl.split(/[?#]/)[0].replace(/^[\\/]+/, "/");
  for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(path); i++) {
    try {
      path = decodeURIComponent(path);
    } catch {
      break;
    }
  }
  if (!path.startsWith(LIBRARY_URL)) return false;
  const rest = path.slice(LIBRARY_URL.length);
  if (rest && !/^[\\/]/.test(rest)) return false; // "/embroidery-libraryX" is not the library
  return rest.includes("\0") || rest.split(/[\\/]/).some((seg) => seg.startsWith("."));
}

/** An existing regular file for a library URL path (for serving; overlay first), or null. */
export function servableLibraryFile(urlPath) {
  const file = libraryFile(urlPath);
  return file && isFile(file) ? file : null;
}
