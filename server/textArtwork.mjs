// Text embroidery in orders (server side).
//
// An order stores text embroidery as data (text, font id, zone, size). For
// production and digitizing the lettering is drawn here from that data, with
// the SAME code the configurator uses (src/features/embroidery/text/textArtwork.ts)
// in the headless Chrome / Edge the server already uses, with the library's
// own font files — so the stitched text is exactly what the customer saw.
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

let pageScript;
/** textArtwork.ts + the font library, bundled for the browser (once per process). */
async function bundle() {
  if (pageScript) return pageScript;
  const { build } = await import("esbuild");
  const out = await build({
    stdin: {
      contents: `import { drawTextArtwork } from "./src/features/embroidery/text/textArtwork.ts";
import { EMBROIDERY_FONTS, fontStack, getEmbroideryFont } from "./src/features/embroidery/fonts/fontLibrary.ts";
window.JK = { drawTextArtwork, EMBROIDERY_FONTS, fontStack, getEmbroideryFont };`,
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    write: false,
    logLevel: "silent",
  });
  pageScript = out.outputFiles[0].text;
  return pageScript;
}

/** A library font file as base64 (for the page and the production sheet). */
export function fontFileBase64(font) {
  return readFileSync(join(ROOT, "public", font.file.replace(/^\//, ""))).toString("base64");
}

/**
 * Draws texts: [{ text, fontId }] → [{ src (PNG data URL), widthPx, heightPx, direction, fonts }],
 * in order. Throws when no browser is available or a text can't be drawn.
 */
export async function renderTextArtworks(items, { fontsById }) {
  if (!items.length) return [];
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error("no Chrome/Edge available to draw the text embroidery");
  const script = await bundle();
  const needed = [...new Set(items.flatMap((i) => i.fontIds))].map((id) => fontsById(id));
  const faces = needed.map((f) => ({ family: f.family, data: fontFileBase64(f) }));
  const work = mkdtempSync(join(tmpdir(), "fidelio-text-"));
  try {
    const html = join(work, "text.html");
    writeFileSync(
      html,
      `<!doctype html><html><body><pre id="o"></pre><script>${script}</script><script>
(async () => {
  try {
    const faces = ${JSON.stringify(faces)};
    for (const f of faces) {
      const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      const face = new FontFace(f.family, bin.buffer, { weight: "1 1000" });
      await face.load();
      document.fonts.add(face);
    }
    const items = ${JSON.stringify(items.map(({ text, fontId }) => ({ text, fontId })))};
    const out = items.map(({ text, fontId }) => {
      const a = window.JK.drawTextArtwork(text, fontId, "#000");
      if (!a) return null;
      return { src: a.canvas.toDataURL("image/png"), widthPx: a.canvas.width, heightPx: a.canvas.height, direction: a.direction, fonts: a.fonts.map((f) => f.id) };
    });
    document.getElementById("o").textContent = "OK" + JSON.stringify(out);
  } catch (e) {
    document.getElementById("o").textContent = "ERROR " + e.message;
  }
})();
</script></body></html>`,
      "utf8"
    );
    const { stdout: dom } = await run(browser, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--virtual-time-budget=15000", "--dump-dom", pathToFileURL(html).href], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      timeout: 120_000,
    });
    const m = /<pre id="o">OK([\s\S]*?)<\/pre>/.exec(dom);
    if (!m) throw new Error(`the browser could not draw the text embroidery (${/<pre id="o">([^<]{0,200})/.exec(dom)?.[1] ?? "no output"})`);
    return JSON.parse(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * A copy of the order with every fixed-zone text embroidery's lettering drawn
 * (element.textArtwork = { src, widthPx, heightPx, ... }) — the artwork that
 * production prints and the digitizer stitches. The stored order is unchanged.
 */
export async function withTextArtwork(order) {
  const wanted = (e) => e.kind === "text" && e.textStyle && e.text?.trim() && !e.textArtwork;
  if (!order?.items?.some((i) => i.customization?.embroidery?.some(wanted))) return order;
  const copy = structuredClone(order);
  const els = [];
  for (const item of copy.items) for (const e of item.customization?.embroidery ?? []) if (wanted(e)) els.push(e);
  const shared = await import("./tsModule.mjs").then((m) => m.loadShared());
  const items = els.map((e) => ({ text: e.text, fontId: e.textStyle.fontId, fontIds: shared.fontStack(shared.getEmbroideryFont(e.textStyle.fontId), e.text).map((f) => f.id) }));
  const drawn = await renderTextArtworks(items, { fontsById: (id) => shared.getEmbroideryFont(id) });
  els.forEach((e, i) => { if (drawn[i]) e.textArtwork = drawn[i]; });
  return copy;
}
