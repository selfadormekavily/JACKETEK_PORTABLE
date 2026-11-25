#!/usr/bin/env node
// Ready-made embroidery library import (licensed OJISAN designs).
//
//   catalog.json (captured from the authorised OJISAN session)
//     → <library>/assets/<designId>/{full,thumbnail}.<ext>   (one copy per design)
//     → <library>/library.json                              (JACKETEK's library data)
//   <library> = runtime-assets/embroidery-library, or EMBROIDERY_LIBRARY_DIR
//   (server/embroideryLibrary.mjs).
//
// Assets are fetched with plain GET requests from the URLs in the catalog
// (the licensed source: the storage URLs OJISAN returned to the authorised
// session). No authentication, signing or CORS is involved or worked around:
// any non-200 response stops the import. Files are saved byte for byte —
// original format, dimensions and transparency.
//
// Only designs whose files are present locally are written to library.json,
// so the picker never shows a design it can't render or produce.
//
// Thumbnails: the source's "thumbnail" URLs serve the full-size file, so they
// aren't downloaded. Instead a small thumbnail (thumb.webp, ≤ THUMB_PX on its
// longest side, transparency kept) is generated locally from each full file —
// with the headless Chrome / Edge the production PDF already uses — and stored
// next to it. The picker shows only thumb.webp; selecting a design uses the
// full file, which is never altered.
//
// CLI:
//   node scripts/import-embroidery-library.mjs --catalog <catalog.json> --designs <id,id,…>   (download these)
//   node scripts/import-embroidery-library.mjs --catalog <catalog.json> --all                 (download every design)
//   node scripts/import-embroidery-library.mjs --catalog <catalog.json>                       (rebuild library.json only)
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { LIBRARY_DIR } from "../server/embroideryLibrary.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = LIBRARY_DIR;
const ASSETS = join(OUT, "assets");
const PUBLIC_BASE = "/embroidery-library/assets";
/** Generated picker thumbnail: longest side (px), file name, WebP quality. */
const THUMB_PX = 256;
const THUMB_NAME = "thumb.webp";
const THUMB_QUALITY = 0.85;
/** Thumbnails generated per browser run (keeps each page's embedded images small). */
const THUMB_BATCH = 24;
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
const run = promisify(execFile);

/**
 * OJISAN placement number → JACKETEK fixed zone (src/features/configurator/
 * model/embroideryGeometry.ts). OJISAN's sleeve slot 4 (10, 11), inner lining
 * (12) and full sleeve have no JACKETEK zone, so they map to nothing.
 */
export const PLACEMENT_TO_ZONE = {
  1: "leftChest",
  2: "rightChest",
  3: "leftSleeveUpper",
  4: "leftSleeveMiddle",
  5: "leftSleeveLower",
  6: "rightSleeveUpper",
  7: "rightSleeveMiddle",
  8: "rightSleeveLower",
  9: "mainBack",
};

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const catalogPath = opt("--catalog");
if (!catalogPath) {
  console.error("usage: node scripts/import-embroidery-library.mjs --catalog <catalog.json> [--designs id,id | --all]");
  process.exit(1);
}
const catalog = JSON.parse(readFileSync(resolve(catalogPath), "utf8"));
const wanted = args.includes("--all") ? null : new Set((opt("--designs") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const download = args.includes("--all") || wanted.size > 0;

/** Width, height and alpha of a PNG or WebP (from its header). */
function inspect(buf) {
  if (buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a") {
    const colourType = buf[25];
    return { format: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), transparent: colourType === 4 || colourType === 6 || buf.includes(Buffer.from("tRNS")) };
  }
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return { format: "webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), transparent: (buf[20] & 0x10) !== 0 };
    }
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { format: "webp", width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff), transparent: ((b >> 28) & 1) === 1 };
    }
    if (chunk === "VP8 ") return { format: "webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, transparent: false };
  }
  return null;
}

const extOf = (url) => (url.match(/\.(png|webp|jpe?g|svg)$/i)?.[1] ?? "bin").toLowerCase();

async function fetchAsset(url) {
  const res = await fetch(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url} — stopping (no workaround is attempted)`);
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") };
}

const designs = catalog.libraries.flatMap((lib) =>
  lib.status === "complete" ? lib.images.filter((img) => !img.isHidden).map((img) => ({ lib, img })) : []
);

if (download) {
  const todo = designs.filter(({ img }) => !wanted || wanted.has(img.id));
  if (wanted && todo.length !== wanted.size) {
    const found = new Set(todo.map(({ img }) => img.id));
    throw new Error(`not in the catalog's complete libraries: ${[...wanted].filter((id) => !found.has(id)).join(", ")}`);
  }
  for (const { img } of todo) {
    const dir = join(ASSETS, img.id);
    mkdirSync(dir, { recursive: true });
    // The full artwork only (the source thumbnail is the same full-size file).
    const file = join(dir, `full.${extOf(img.full)}`);
    if (existsSync(file)) continue;
    const { buf, type } = await fetchAsset(img.full);
    const info = inspect(buf);
    if (!info) throw new Error(`${img.full}: not a PNG/WebP (${type})`);
    writeFileSync(file, buf);
    console.log(`saved ${img.id}/full.${extOf(img.full)}  ${type}  ${info.width}×${info.height}  ${info.transparent ? "transparent" : "opaque"}  ${buf.length} B`);
  }
}

/**
 * Generates thumb.webp for each full file that lacks one: drawn into a canvas
 * at ≤ THUMB_PX (halving in steps for a clean downscale), encoded as WebP with
 * its alpha. The full files are only read. Runs the headless browser in batches.
 */
async function makeThumbnails(fullFiles) {
  if (!fullFiles.length) return;
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error("no Chrome/Edge available to generate thumbnails");
  const MIME = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };
  for (let start = 0; start < fullFiles.length; start += THUMB_BATCH) {
    const batch = fullFiles.slice(start, start + THUMB_BATCH);
    const work = mkdtempSync(join(tmpdir(), "jacketek-thumbs-"));
    try {
      const sources = batch.map((f) => `data:${MIME[extOf(f)] ?? "application/octet-stream"};base64,${readFileSync(f).toString("base64")}`);
      const html = join(work, "thumbs.html");
      writeFileSync(
        html,
        `<!doctype html><html><body><script>
const SRC = ${JSON.stringify(sources)};
const MAX = ${THUMB_PX};
function scale(img) {
  let w = img.naturalWidth, h = img.naturalHeight, c = img;
  const s = Math.min(1, MAX / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  // Halve until within 2× of the target, then one final high-quality step.
  while (w / 2 >= tw && h / 2 >= th) {
    const n = document.createElement("canvas");
    n.width = Math.round(w / 2); n.height = Math.round(h / 2);
    const x = n.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, n.width, n.height);
    c = n; w = n.width; h = n.height;
  }
  const out = document.createElement("canvas");
  out.width = tw; out.height = th;
  const x = out.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, tw, th);
  return out.toDataURL("image/webp", ${THUMB_QUALITY});
}
Promise.all(SRC.map((s) => new Promise((res) => { const i = new Image(); i.onload = () => res(scale(i)); i.onerror = () => res("ERROR"); i.src = s; })))
  .then((r) => { r.forEach((d, k) => { const p = document.createElement("pre"); p.id = "t" + k; p.textContent = d; document.body.appendChild(p); }); });
</script></body></html>`,
        "utf8"
      );
      const { stdout: dom } = await run(browser, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--virtual-time-budget=30000", "--dump-dom", pathToFileURL(html).href], {
        encoding: "utf8",
        maxBuffer: 512 * 1024 * 1024,
        timeout: 180_000,
      });
      batch.forEach((full, k) => {
        const m = new RegExp(`<pre id="t${k}">(data:image/webp;base64,[^<]+)</pre>`).exec(dom);
        if (!m) throw new Error(`could not generate a thumbnail for ${full}`);
        const buf = Buffer.from(m[1].slice("data:image/webp;base64,".length), "base64");
        const info = inspect(buf);
        if (!info || info.format !== "webp") throw new Error(`thumbnail for ${full} is not a WebP`);
        writeFileSync(join(dirname(full), THUMB_NAME), buf);
        console.log(`thumb ${full.split(/[\\/]/).slice(-2).join("/")} → ${THUMB_NAME}  ${info.width}×${info.height}  ${info.transparent ? "transparent" : "opaque"}  ${buf.length} B`);
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}

// Every local full file without a generated thumbnail gets one.
await makeThumbnails(
  designs
    .map(({ img }) => join(ASSETS, img.id, `full.${extOf(img.full)}`))
    .filter((f) => existsSync(f) && !existsSync(join(dirname(f), THUMB_NAME)))
);

// library.json: every design whose files are local, each recorded once.
const records = [];
for (const { lib, img } of designs) {
  const fullFile = join(ASSETS, img.id, `full.${extOf(img.full)}`);
  const thumbFile = join(ASSETS, img.id, THUMB_NAME);
  if (!existsSync(fullFile) || !existsSync(thumbFile)) continue;
  const info = inspect(readFileSync(fullFile));
  const thumbInfo = inspect(readFileSync(thumbFile));
  const sourcePlacements = img.placements;
  const zones = [...new Set(sourcePlacements.map((n) => PLACEMENT_TO_ZONE[n]).filter(Boolean))];
  if (!zones.length) continue;
  records.push({
    id: `ojisan:${img.id}`,
    designId: img.id,
    libraryId: lib.id,
    libraryTitle: lib.title,
    libraryDescription: lib.description ?? "",
    productionName: lib.internalLabName ?? null,
    originalFileName: img.originalFilename ?? null,
    // The original artwork (used when the design is selected) …
    asset: `${PUBLIC_BASE}/${img.id}/full.${extOf(img.full)}`,
    // … and the locally generated picker thumbnail.
    thumbnail: `${PUBLIC_BASE}/${img.id}/${THUMB_NAME}`,
    thumbnailWidth: thumbInfo.width,
    thumbnailHeight: thumbInfo.height,
    format: info.format,
    width: info.width,
    height: info.height,
    transparent: info.transparent,
    zones,
    source: {
      provider: "ojisan",
      libraryId: lib.id,
      designId: img.id,
      placements: sourcePlacements,
      fullSleeve: lib.fullSleeve,
      fullUrl: img.full,
      thumbnailUrl: img.thumbnail,
    },
  });
}
const libraries = [...new Map(records.map((r) => [r.libraryId, { id: r.libraryId, title: r.libraryTitle, description: r.libraryDescription, productionName: r.productionName }])).values()]
  .map((l) => ({ ...l, designCount: records.filter((r) => r.libraryId === l.id).length }));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "library.json"), JSON.stringify({ version: 1, generated: new Date().toISOString(), libraries, designs: records }, null, 1));
console.log(`library.json: ${records.length} designs in ${libraries.length} libraries`);
