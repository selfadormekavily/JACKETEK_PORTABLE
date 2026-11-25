// Colourway designs in orders (server side).
//
// An order stores a colourway design as data: the library design + the thread
// chosen per colour slot (image.colourway). For production and digitizing the
// artwork is rebuilt here from the ORIGINAL file (read only), the design's
// region map and those colours — with the same code the configurator uses
// (src/features/configurator/library/colourwayRecolour.ts), in the headless
// Chrome / Edge the server already uses — never taken from the preview the
// browser sent.
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { libraryFile, libraryPath } from "./embroideryLibrary.mjs";
import { composeFrontLetters, letterTemplate, lettersColourway } from "./frontLetters.mjs";
import { loadShared } from "./tsModule.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

/** A design's colourway definition (null when it has none). */
export function colourwayOf(designId) {
  if (!ID.test(designId ?? "")) return null;
  const file = libraryPath(`colourways/${designId}/colourway.json`);
  return file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** A file in the embroidery library (only), as base64. */
function publicFile(path) {
  const file = libraryFile(path);
  if (!file || !existsSync(file)) throw new Error(`${path} is not in the embroidery library.`);
  return readFileSync(file).toString("base64");
}

let pageScript;
async function bundle() {
  if (pageScript) return pageScript;
  const { build } = await import("esbuild");
  const out = await build({
    stdin: { contents: `import { recolourPixels } from "./src/features/configurator/library/colourwayRecolour.ts"; window.recolourPixels = recolourPixels;`, resolveDir: ROOT, loader: "ts" },
    bundle: true, platform: "browser", format: "iife", write: false, logLevel: "silent",
  });
  pageScript = out.outputFiles[0].text;
  return pageScript;
}

/** Recolours jobs [{ asset, assetMime, regions, width, height, refs, targets }] → PNG data URLs, in order. */
async function recolour(jobs) {
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error("no Chrome/Edge available to rebuild colourway designs");
  const script = await bundle();
  const work = mkdtempSync(join(tmpdir(), "fidelio-colourway-"));
  try {
    const html = join(work, "colourway.html");
    writeFileSync(
      html,
      `<!doctype html><html><body><pre id="o"></pre><script>${script}</script><script>
(async () => {
  try {
    const jobs = ${JSON.stringify(jobs)};
    // (onload, not decode(): decode() doesn't settle under --virtual-time-budget.)
    const pixels = async (src, w, h) => { const img = new Image(); await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error("image")); img.src = src; }); const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
    const out = [];
    for (const j of jobs) {
      const src = await pixels("data:" + j.assetMime + ";base64," + j.asset, j.width, j.height);
      const reg = await pixels("data:image/png;base64," + j.regions, j.width, j.height);
      const px = window.recolourPixels(src, reg, j.refs, j.targets);
      const c = document.createElement("canvas"); c.width = j.width; c.height = j.height;
      const x = c.getContext("2d"); const d = x.createImageData(j.width, j.height); d.data.set(px); x.putImageData(d, 0, 0);
      out.push(c.toDataURL("image/png"));
    }
    document.getElementById("o").textContent = "OK" + JSON.stringify(out);
  } catch (e) { document.getElementById("o").textContent = "ERROR " + e.message; }
})();
</script></body></html>`,
      "utf8"
    );
    const { stdout: dom } = await run(browser, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--virtual-time-budget=30000", "--dump-dom", pathToFileURL(html).href], {
      encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, timeout: 180_000,
    });
    const m = /<pre id="o">OK([\s\S]*?)<\/pre>/.exec(dom);
    if (!m) throw new Error(`the browser could not rebuild the colourway design (${/<pre id="o">([^<]{0,200})/.exec(dom)?.[1] ?? "no output"})`);
    return JSON.parse(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * A library design's colour layers (server side): its colourway, or its
 * Front Letters template's — null for designs without them (left as they are).
 */
function layersOf(e) {
  if (e.image?.frontLetters) {
    const cw = lettersColourway(letterTemplate(e.image.frontLetters.templateId));
    return cw ? { kind: "front-letters", slots: cw.slots } : null;
  }
  const id = e.image?.library?.designId ?? e.image?.colourway?.designId;
  const cw = id ? colourwayOf(id) : null;
  return cw ? { kind: "image", cw, slots: cw.slots } : null;
}

/**
 * A copy of the order with every design that has colour layers ready for
 * production: its artwork rebuilt from the ORIGINAL file (or the Front
 * Letters template + letters) + its region map + the chosen threads (PNG),
 * when any colour was changed; and, always, `image.colourRegions` — the
 * region map and each layer's thread — so the digitizer stitches each layer
 * (fill, outline…) in its own named thread. The stored order is unchanged.
 * Throws on an unknown design / thread.
 */
export async function withColourways(order) {
  const layered = (e) => (e.image?.library || e.image?.colourway) && layersOf(e);
  const relevant = (e) => layered(e) || Object.keys(e.image?.colourway?.colours ?? {}).length;
  if (!order?.items?.some((i) => i.customization?.embroidery?.some(relevant))) return order;
  const shared = await loadShared();
  const thread = (designId, id) => {
    const t = shared.THREADS.find((x) => x.id === id);
    if (!t) throw new Error(`Colourway design ${designId}: unknown thread "${id}".`);
    return t;
  };
  const copy = structuredClone(order);
  const jobs = [];
  for (const item of copy.items) {
    for (const e of item.customization?.embroidery ?? []) {
      const layers = layered(e);
      if (!layers) {
        // Colours were chosen, but this server has no colour layers for the
        // design (overlay / library missing): never produce it in its own
        // colours as if they had been chosen.
        if (Object.keys(e.image?.colourway?.colours ?? {}).length)
          throw new Error(`Design ${e.image.colourway.designId}: its colour layers are missing on this server, so the chosen colours can't be produced (see server/embroideryLibrary.mjs).`);
        continue;
      }
      const designId = e.image.frontLetters?.templateId ?? e.image.library?.designId ?? e.image.colourway.designId;
      // Generated optional colours ("override"): nothing chosen → the design exactly as it is
      // (its own colours, as before it had layers); no region map for the digitizer.
      const anyChosen = Object.values(e.image.colourway?.colours ?? {}).some(Boolean);
      if (layers.kind === "image" && layers.cw.mode === "override" && !anyChosen) continue;
      // Slots the design no longer has (metadata changed since the order) are
      // left out — that layer keeps the design's own colour — never blocking production.
      const colours = Object.fromEntries(
        Object.entries(e.image.colourway?.colours ?? {}).filter(([k]) => {
          const known = layers.slots.some((s) => s.id === k);
          if (!known) console.warn(`Colourway design ${designId}: colour slot "${k}" is no longer in its metadata; its own colour is used.`);
          return known;
        })
      );
      const chosen = layers.slots.map((s) => (colours[s.id] ? thread(designId, colours[s.id]) : null));
      let source;
      if (layers.kind === "front-letters") {
        const built = composeFrontLetters(e.image.frontLetters, { regions: true });
        source = {
          asset: built.png.toString("base64"), assetMime: "image/png", regions: built.regionsPng.toString("base64"),
          width: built.width, height: built.height,
          name: `${(e.image.library?.originalFileName ?? designId).replace(/\.[^.]+$/, "")}_LETTERS_${built.letters}`,
        };
      } else {
        const cw = layers.cw;
        source = {
          asset: publicFile(cw.asset), assetMime: cw.asset.endsWith(".png") ? "image/png" : "image/webp",
          regions: publicFile(`/embroidery-library/colourways/${cw.designId}/${cw.regionMap}`),
          width: cw.width, height: cw.height, name: (cw.originalFileName ?? cw.designId).replace(/\.[^.]+$/, ""),
        };
      }
      // Each layer's thread: the chosen one, else the design's own thread (or its own colour, unnamed).
      e.image.colourRegions = {
        regions: `data:image/png;base64,${source.regions}`,
        threads: layers.slots.map((s, i) => {
          const t = chosen[i] ?? (s.defaultThread ? thread(designId, s.defaultThread) : null);
          return t ? { hex: t.hex, name: t.name } : { hex: s.defaultColor, name: `Original (${s.label})` };
        }),
      };
      if (chosen.some(Boolean)) jobs.push({ e, ...source, refs: [null, ...layers.slots.map((s) => s.ref)], targets: chosen.map((t) => t?.hex ?? null) });
    }
  }
  if (jobs.length) {
    const built = await recolour(jobs.map(({ e: _e, ...job }) => job));
    jobs.forEach((job, i) => {
      job.e.image.src = built[i];
      job.e.image.original = { fileName: `${job.name}_COLOURWAY.png`, mimeType: "image/png", widthPx: job.width, heightPx: job.height };
    });
  }
  return copy;
}
