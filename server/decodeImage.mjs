// Reads an uploaded image's pixels for the auto-digitizer — any format the
// upload accepts (PNG, JPG, WebP, GIF, BMP, SVG). Reading only: the
// customer's file is never changed, replaced or stored in another form.
// PNG is decoded here; other formats by the headless Chrome / Edge the PDF
// printer already uses (Node has no decoder for them). Pixels are sampled
// at up to `maxPx` on the longest side — the stitch resolution the
// digitizer works at.
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { decodePng, decodePngDataUrl } from "./png.mjs";

const run = promisify(execFile);

const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

/** Box-samples an RGBA raster down to at most maxPx on its longest side. */
function sample(r, maxPx) {
  const s = Math.min(1, maxPx / Math.max(r.width, r.height));
  if (s === 1) return r;
  const w = Math.max(1, Math.round(r.width * s)), h = Math.max(1, Math.round(r.height * s));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x / s), x1 = Math.max(x0 + 1, Math.floor((x + 1) / s)), y0 = Math.floor(y / s), y1 = Math.max(y0 + 1, Math.floor((y + 1) / s));
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = y0; yy < Math.min(y1, r.height); yy++)
        for (let xx = x0; xx < Math.min(x1, r.width); xx++) {
          const p = (yy * r.width + xx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += r.data[p + c];
          n++;
        }
      for (let c = 0; c < 4; c++) out[(y * w + x) * 4 + c] = acc[c] / n;
    }
  return { width: w, height: h, data: out };
}

/** data URL of any accepted image → { width, height, data: RGBA } for digitizing. */
export async function decodeImageForDigitizing(dataUrl, maxPx = 768) {
  if (/^data:image\/png;base64,/.test(dataUrl)) return sample(decodePngDataUrl(dataUrl), maxPx);
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error("no Chrome/Edge available to read this image format");
  const work = mkdtempSync(join(tmpdir(), "fidelio-decode-"));
  try {
    const html = join(work, "decode.html");
    writeFileSync(
      html,
      `<!doctype html><html><body><pre id="o"></pre><script>
const img = new Image();
img.onload = () => {
  const w = img.naturalWidth || 1024, h = img.naturalHeight || Math.round(1024 / (img.width / img.height || 1));
  const s = Math.min(1, ${maxPx} / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  document.getElementById("o").textContent = c.toDataURL("image/png");
};
img.onerror = () => { document.getElementById("o").textContent = "ERROR"; };
img.src = ${JSON.stringify(dataUrl)};
</script></body></html>`,
      "utf8"
    );
    const { stdout: dom } = await run(browser, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--virtual-time-budget=10000", "--dump-dom", pathToFileURL(html).href], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      timeout: 60_000,
    });
    const m = /<pre id="o">(data:image\/png;base64,[^<]+)<\/pre>/.exec(dom);
    if (!m) throw new Error("the browser could not read this image");
    return decodePng(Buffer.from(m[1].slice("data:image/png;base64,".length), "base64"));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
