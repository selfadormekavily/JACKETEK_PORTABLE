// Auto-digitizing for an order (prototype): every customer-uploaded image →
// stitch design, DST file and stitch preview. No database here: the server
// stores the result (server/index.mjs), the PDF script uses it (or calls this).
import { decodeImageForDigitizing } from "./decodeImage.mjs";
import { decodePngDataUrl } from "./png.mjs";
import { withLibraryAssets } from "./libraryAssets.mjs";
import { withTextArtwork } from "./textArtwork.mjs";
import { withColourways } from "./colourways.mjs";
import { loadShared } from "./tsModule.mjs";

/**
 * Digitizes the order's images. `skip(job)` → true leaves a job out (already stored).
 * Returns [{ line, elementId, designId, engine, metadata, dst: Buffer, previewSvg, stitchData }].
 */
export async function digitizeOrder(sourceOrder, { skip = () => false } = {}) {
  const shared = await loadShared();
  // Ready-made library designs: their local files, in place of their paths;
  // text embroidery: its text drawn in its font; colourway designs: rebuilt
  // from their original file + the chosen threads.
  const order = await withColourways(await withTextArtwork(withLibraryAssets(sourceOrder)));
  const out = [];
  for (const job of shared.embroideryJobs(order)) {
    if (skip(job, shared.DIGITIZER_ENGINE)) continue;
    // the artwork's pixels (any upload format), read for stitching only
    // Designs with colour layers: the layer map decides each stitch colour (fill, outline… each its own thread).
    const regionMap = job.colourRegions ? decodePngDataUrl(job.colourRegions.regions) : null;
    const design = shared.digitizeJob(job, await decodeImageForDigitizing(job.src), undefined, regionMap);
    out.push({
      line: job.line,
      elementId: job.elementId,
      designId: job.designId,
      engine: shared.DIGITIZER_ENGINE,
      metadata: design.metadata,
      dst: Buffer.from(shared.encodeDst(design)),
      previewSvg: shared.stitchPreviewSvg(design),
      // the exact stitch list the DST was written from (the stitch map draws it)
      stitchData: shared.packStitches(design.stitches),
    });
  }
  return out;
}
