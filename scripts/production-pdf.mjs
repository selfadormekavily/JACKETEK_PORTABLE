#!/usr/bin/env node
// Production PDF — SERVER-SIDE ONLY (Node; never bundled for the browser).
//
//   website Order  →  orderToProductionOrder()  →  production-drawing/build/populate.mjs  →  PDF
//
// This file only feeds the generator: it writes the production sheet JSON
// and the artwork files, then runs it. Nothing is sent anywhere: the PDF (and any uploaded
// embroidery artwork) is written to the output folder for an admin to
// download and pass to the supplier by hand.
//
// CLI:
//   node scripts/production-pdf.mjs --order <website-order.json> [--line 0] [--out-dir production-output]
// Module (used by server/index.mjs):
//   import { generateProductionPdf } from "./scripts/production-pdf.mjs";
//   const result = await generateProductionPdf(order, { lineIndex, outDir });
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { digitizeOrder } from "../server/digitize.mjs";
import { withLibraryAssets } from "../server/libraryAssets.mjs";
import { withTextArtwork } from "../server/textArtwork.mjs";
import { withColourways } from "../server/colourways.mjs";
import { loadShared } from "../server/tsModule.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATOR = join(ROOT, "production-drawing", "build", "populate.mjs");
export const DEFAULT_OUT_DIR = join(ROOT, "production-output");

export class MissingOrderDataError extends Error {
  constructor(missing) {
    super(
      "Production PDF cannot be generated because the following order data is missing:\n" +
        missing.map((m) => `- ${m}`).join("\n")
    );
    this.missing = missing;
  }
}

// One headless browser at a time: runs queue here.
let queue = Promise.resolve();

/**
 * Generates the 4-page tech pack PDF for one line of a website order.
 * Throws MissingOrderDataError (and writes nothing) if order data the
 * sheet needs is missing. What the website doesn't store prints as
 * TO BE CONFIRMED (returned in `gaps`).
 */
export function generateProductionPdf(sourceOrder, { lineIndex = 0, outDir = DEFAULT_OUT_DIR, designs = null } = {}) {
  const job = queue.then(async () => {
    // Ready-made library designs: their local files, in place of their paths;
    // text embroidery: its text drawn in its font (from the order's data);
    // colourway designs: rebuilt from their original file + the chosen threads.
    const order = await withColourways(await withTextArtwork(withLibraryAssets(sourceOrder)));
    const { orderToProductionOrder, productionPdfName } = await loadShared();
    const result = orderToProductionOrder(order, lineIndex);
    if (result.missing.length) throw new MissingOrderDataError(result.missing);

    mkdirSync(outDir, { recursive: true });
    const pdfName = productionPdfName(result.productionId);
    const pdfPath = join(outDir, pdfName);
    const jsonPath = join(outDir, pdfName.replace(/\.pdf$/, ".production-order.json"));

    const artworkFiles = result.artwork.map(({ fileName, dataUrl }) => {
      const match = /^data:[^;]+;base64,(.*)$/.exec(dataUrl);
      if (!match) throw new Error(`Artwork ${fileName} is not stored as an embedded image.`);
      const path = join(outDir, fileName);
      writeFileSync(path, Buffer.from(match[1], "base64"));
      return path;
    });

    // Auto-digitized embroidery (prototype): the stored designs (server), or
    // digitized here (CLI). Written next to the PDF; page 4 shows them.
    const lineDesigns = (designs ?? (await digitizeOrder(order))).filter((d) => d.line === lineIndex);
    const shared = await loadShared();
    for (const img of result.sheet.images) {
      const d = lineDesigns.find((x) => x.elementId === img.elementId);
      if (!d) continue;
      // …_ARTWORK.png (older uploads), …_ORIGINAL.<ext> (the upload itself) or …_TEXT.png (text) → …_EMBROIDERY
      const base = img.processed.file.replace(/_(ARTWORK|ORIGINAL|TEXT)\.[A-Za-z0-9]+$/, "_EMBROIDERY");
      const files = { dstFile: `${base}.dst`, previewFile: `${base}_PREVIEW.svg`, metadataFile: `${base}.json` };
      writeFileSync(join(outDir, files.dstFile), d.dst);
      writeFileSync(join(outDir, files.previewFile), d.previewSvg, "utf8");
      writeFileSync(join(outDir, files.metadataFile), JSON.stringify(d.metadata, null, 2), "utf8");
      artworkFiles.push(...Object.values(files).map((f) => join(outDir, f)));
      img.digitized = { designId: d.designId, status: d.metadata.status, ...files, metadata: d.metadata };

      // Stitch map (page 5+): drawn from the stored stitch list — the same data the DST
      // was written from — and checked against the DST bytes themselves.
      if (!d.stitchData) continue;
      const design = { metadata: d.metadata, stitches: shared.unpackStitches(d.stitchData) };
      const verification = shared.verifyAgainstDst(design, shared.decodeDst(new Uint8Array(d.dst)));
      const window = shared.pickDetailWindow(design, 14, 10);
      const map = shared.digitizingMapSvg(design, { detail: window });
      const detail = shared.digitizingDetailSvg(design, window);
      const mapFiles = { mapFile: `${base}_DIGITIZING_MAP.svg`, detailFile: `${base}_DIGITIZING_DETAIL.svg` };
      writeFileSync(join(outDir, mapFiles.mapFile), map.svg, "utf8");
      writeFileSync(join(outDir, mapFiles.detailFile), detail.svg, "utf8");
      // colour separation: one thread's cells and stitches at a time
      const separations = d.metadata.threads.map((_, k) => {
        const sep = shared.colourSeparationSvg(design, k);
        const file = `${base}_DIGITIZING_COLOUR_${String(k + 1).padStart(2, "0")}.svg`;
        writeFileSync(join(outDir, file), sep.svg, "utf8");
        return { file, mm: [sep.widthMm, sep.heightMm] };
      });
      artworkFiles.push(...[...Object.values(mapFiles), ...separations.map((x) => x.file)].map((f) => join(outDir, f)));
      img.digitized.stitchMap = {
        ...mapFiles,
        mapMm: [map.widthMm, map.heightMm],
        detailMm: [detail.widthMm, detail.heightMm],
        cellMm: shared.mapCellMm(design),
        separations,
        window,
        verification,
        sections: shared.colourSections(design),
      };
    }
    writeFileSync(jsonPath, JSON.stringify(result.sheet, null, 2), "utf8");

    // The generator reads the sheet and its artwork files from outDir and
    // reports what it printed as TO BE CONFIRMED.
    const { stdout } = await run(process.execPath, [GENERATOR, "--order", jsonPath, "--out", pdfPath], { timeout: 120_000 });
    const tbc = JSON.parse(/^tbc: (.*)$/m.exec(stdout)?.[1] ?? "[]");
    const gaps = [...new Set([...result.gaps, ...tbc])];
    return { pdfPath, pdfName, jsonPath, artworkFiles, gaps, productionId: result.productionId };
  });
  queue = job.catch(() => undefined);
  return job;
}

// ---- CLI ----
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const opt = (k) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const orderPath = opt("--order");
  if (!orderPath) {
    console.error("usage: node scripts/production-pdf.mjs --order <website-order.json> [--line 0] [--out-dir <dir>]");
    process.exit(1);
  }
  const order = JSON.parse(readFileSync(resolve(orderPath), "utf8").replace(/^﻿/, ""));
  try {
    const r = await generateProductionPdf(order, {
      lineIndex: Number(opt("--line") ?? 0),
      outDir: resolve(opt("--out-dir") ?? DEFAULT_OUT_DIR),
    });
    console.log(JSON.stringify(r, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(err instanceof MissingOrderDataError ? 2 : 1);
  }
}
