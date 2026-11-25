// Ready-made library designs in orders (server side).
//
// An order stores a library design by reference: its image `src` is the
// design's library URL path (/embroidery-library/assets/…), not an
// embedded file (the library folder: embroideryLibrary.mjs). Production and
// digitizing work from the file itself, so
// before they run, each library design's asset is read from disk and put in
// place of the path — on a copy of the order; the stored order is unchanged.
// Front Letters designs are rebuilt from their template + letters (frontLetters.mjs).
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { libraryFile } from "./embroideryLibrary.mjs";
import { composeFrontLetters } from "./frontLetters.mjs";

const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

/** A library asset path (as stored in the order) → its file on disk, only inside the library's assets folder. */
const assetFile = (src) => libraryFile(src, "assets");

/**
 * A copy of the order with every library design's asset embedded (as the
 * production / digitizing code expects). Throws if a referenced asset is missing.
 */
export function withLibraryAssets(order) {
  if (!order?.items?.some((i) => i.customization?.embroidery?.some((e) => e.image?.frontLetters || (e.image?.library && !e.image.src?.startsWith("data:"))))) return order;
  const copy = structuredClone(order);
  for (const item of copy.items) {
    for (const e of item.customization?.embroidery ?? []) {
      // Front Letters: the artwork is rebuilt from the template + the two letters
      // (never taken from the picture the browser showed).
      if (e.image?.frontLetters) {
        const built = composeFrontLetters(e.image.frontLetters);
        if (built) {
          e.image.src = `data:image/png;base64,${built.png.toString("base64")}`;
          e.image.original = {
            fileName: `${(e.image.library?.originalFileName ?? built.template.templateId).replace(/\.[^.]+$/, "")}_LETTERS_${built.letters}.png`,
            mimeType: "image/png",
            widthPx: built.width,
            heightPx: built.height,
          };
          continue;
        }
        // "A A": the design's own file, as for any library design.
        e.image.src = e.image.library?.asset ?? e.image.src;
      }
      if (!e.image?.library || e.image.src?.startsWith("data:")) continue;
      const file = assetFile(e.image.src);
      if (!file || !existsSync(file)) throw new Error(`Library design ${e.image.library.id}: asset ${e.image.src} is not in the embroidery library.`);
      e.image.src = `data:${MIME[extname(file).toLowerCase()] ?? "application/octet-stream"};base64,${readFileSync(file).toString("base64")}`;
    }
  }
  return copy;
}
