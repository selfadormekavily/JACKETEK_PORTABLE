// Builds the embroidery library's TEST SUBSET: original JACKETEK designs (no
// third-party artwork — drawn here from shapes and the site's own SIL OFL
// embroidery fonts), in exactly the formats of the full library, so every
// library path can be exercised without shipping licensed designs:
//
//   designs with COLOUR LAYERS (each layer drawn separately, with a region
//   map — red = layer number, green/blue = blended edges — and the layer's
//   reference shading; defaults are embroidery threads):
//   - a FRONT LETTERS monogram: letter fill + outline, every letter A–Z with
//     its own region map (letter-templates/<id>/);
//   - a graduation year "2027": number fill + outline (colourways/<id>/);
//   - a word "SENIORS": text fill + outline;
//   - a crest: border + fill + detail;
//   designs WITHOUT colour layers (flattened; stay as drawn):
//   - a "Class of 2027" banner, and a "27" number patch.
//
// Lettering: the OUTLINE layer is the lettering stroked (its contour) and
// filled, in the outline thread; the FILL layer is the glyph itself on top.
// The outline's width is the template's (OUTLINE_SHARE of the font size,
// recorded in the metadata), so it can be tuned per style later.
//
//   node scripts/embroidery-fixtures/build.mjs [outDir]
//
// outDir defaults to the library folder (runtime-assets/embroidery-library, or
// EMBROIDERY_LIBRARY_DIR) and is wiped first, so the script refuses a folder
// that holds the full library rather than a test subset. Needs Chrome or Edge (the
// drawing runs in a headless browser, like the server's own artwork code).
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { LIBRARY_DIR } from "../../server/embroideryLibrary.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(process.argv[2] ?? LIBRARY_DIR);
// The output folder is wiped first: never let that be the full licensed library.
if (existsSync(join(OUT, "library.json")) && !/^TEST SUBSET/.test(JSON.parse(readFileSync(join(OUT, "library.json"), "utf8")).note ?? "")) {
  console.error(`${OUT} holds the full embroidery library, not a test subset; refusing to overwrite it. Pass another outDir.`);
  process.exit(1);
}
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

// Stable ids (stored in orders that use these designs). The Front Letters
// category uses the library's real Front Letters id, so the configurator
// treats the monogram exactly as it treats the full library's (frontLetters.ts).
const FRONT_LETTERS_LIBRARY = "23ff73fd-b78f-4718-9109-2b8f73076954";
const TEST_LIBRARY = "6b1e0c52-5d3a-4c1e-9a77-0f1a2b3c4d5e";
const IDS = {
  banner: "0a7d4c1e-2b3f-4e5a-8b6c-7d8e9f0a1b2c",
  number: "1b8e5d2f-3c4a-4f6b-9c7d-8e9f0a1b2c3d",
  crest: "2c9f6e3a-4d5b-4a7c-8d8e-9f0a1b2c3d4e",
  monogram: "3d0a7f4b-5e6c-4b8d-9e9f-0a1b2c3d4e5f",
  year: "4e1b8a5c-6f7d-4c9e-8f0a-1b2c3d4e5f60",
  word: "5f2c9b6d-7a8e-4d0f-9a1b-2c3d4e5f6071",
};
const SLEEVES = ["leftSleeveUpper", "leftSleeveMiddle", "leftSleeveLower", "rightSleeveUpper", "rightSleeveMiddle", "rightSleeveLower"];

/** The lettering outline's width: a share of the font size (each side of the contour gets half). */
const OUTLINE_SHARE = 0.12;

// The brand's own colours (src/styles/index.css) for the flattened designs.
const NAVY = "#0b2340";
const CRIMSON = "#c1121f";
const CREAM = "#fcf0d6";

const font = (id) => readFileSync(join(ROOT, "public", "fonts", "embroidery", `${id}.ttf`)).toString("base64");

/** The site's own code: the recolour maths (browser page) and the thread palette (here). */
async function bundles() {
  const { build } = await import("esbuild");
  const opts = { bundle: true, write: false, logLevel: "silent", alias: { "@": join(ROOT, "src") } };
  const page = await build({
    ...opts,
    stdin: { contents: `import { labOf, lumaOf } from "./src/features/configurator/library/colourwayRecolour.ts"; window.JK = { labOf, lumaOf };`, resolveDir: ROOT, loader: "ts" },
    platform: "browser", format: "iife",
  });
  const node = await build({
    ...opts,
    stdin: { contents: `export { THREADS } from "./src/features/configurator/model/catalog.ts";`, resolveDir: ROOT, loader: "ts" },
    platform: "node", format: "esm",
  });
  const { THREADS } = await import(`data:text/javascript;base64,${Buffer.from(node.outputFiles[0].text).toString("base64")}`);
  return { pageScript: page.outputFiles[0].text, THREADS };
}

/** Everything is drawn in the page; it returns { files: { path: dataUrl }, meta }. */
const DRAW = String.raw`
const C = __COLOURS__;
const T = __THREADS__;
const OUTLINE_SHARE = __OUTLINE_SHARE__;
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const files = {};
const put = (path, c) => { files[path] = c.toDataURL("image/png"); };

/** Satin stitches over what is drawn: fine light / dark lines at an angle (shading the recolour keeps). */
function satin(ctx, w, h, angle, step = 7) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  const R = Math.hypot(w, h);
  for (let x = -R; x < R; x += step) {
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.fillRect(x, -R, step * 0.35, 2 * R);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + step * 0.5, -R, step * 0.3, 2 * R);
  }
  ctx.restore();
}

/** A thumbnail: the artwork fitted into 256 × 256. */
function thumb(src) {
  const k = Math.min(256 / src.width, 256 / src.height);
  const c = canvas(Math.max(1, Math.round(src.width * k)), Math.max(1, Math.round(src.height * k)));
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** One stitched layer: a shape in a colour, with satin texture at its own angle. */
function layer(w, h, draw, colour, angle) {
  const l = canvas(w, h), x = l.getContext("2d");
  x.fillStyle = colour; x.strokeStyle = colour;
  draw(x);
  satin(x, w, h, angle);
  return l;
}

/**
 * Lettering as two stitched layers. OUTLINE: the text stroked (its contour,
 * OUTLINE_SHARE of the font size wide) and filled, so it lies under the whole
 * letter; FILL: the glyphs themselves, on top.
 */
function lettering(w, h, text, family, px, x, y, fill, outline) {
  const set = (c) => { c.font = "400 " + px + "px \"" + family + "\""; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.lineJoin = "round"; };
  return [
    { slot: 2, canvas: layer(w, h, (c) => { set(c); c.lineWidth = px * OUTLINE_SHARE; c.strokeText(text, x, y); c.fillText(text, x, y); }, outline, 0.55) },
    { slot: 1, canvas: layer(w, h, (c) => { set(c); c.fillText(text, x, y); }, fill, -0.55) },
  ];
}

/**
 * Stacked layers (bottom → top, each { slot, canvas }) → the artwork, its
 * region map (red = the top layer's slot; on an edge blended with the layer
 * below: green = that layer's slot, blue = the top layer's share; opaque only
 * where a layer is) and each slot's reference shading (the median of its
 * core pixels).
 */
function compose(w, h, layers, slots) {
  const art = canvas(w, h), ax = art.getContext("2d");
  for (const l of layers) ax.drawImage(l.canvas, 0, 0);
  const A = ax.getImageData(0, 0, w, h).data;
  const L = layers.map((l) => l.canvas.getContext("2d").getImageData(0, 0, w, h).data);
  const map = canvas(w, h), mx = map.getContext("2d"), md = mx.createImageData(w, h);
  const samples = Object.fromEntries(Array.from({ length: slots }, (_, k) => [k + 1, { y: [], L: [], a: [], b: [] }]));
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    let top = -1;
    for (let k = layers.length - 1; k >= 0; k--) if (L[k][o + 3] > 0) { top = k; break; }
    if (top < 0) continue;
    const a = L[top][o + 3];
    let below = -1;
    if (a < 255) for (let k = top - 1; k >= 0; k--) if (L[k][o + 3] > 0) { below = k; break; }
    md.data[o] = layers[top].slot;
    md.data[o + 1] = below >= 0 ? layers[below].slot : 0;
    md.data[o + 2] = below >= 0 ? a : 255;
    md.data[o + 3] = 255;
    if (a === 255 && A[o + 3] === 255) {
      const s = samples[layers[top].slot];
      s.y.push(window.JK.lumaOf(A[o], A[o + 1], A[o + 2]));
      const lab = window.JK.labOf(A[o], A[o + 1], A[o + 2]);
      s.L.push(lab[0]); s.a.push(lab[1]); s.b.push(lab[2]);
    }
  }
  mx.putImageData(md, 0, 0);
  const median = (v) => { const s = [...v].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const refs = Object.fromEntries(Object.entries(samples).map(([k, s]) => [k, { y: Math.round(median(s.y) * 1e6) / 1e6, lab: [r3(median(s.L)), r3(median(s.a)), r3(median(s.b))] }]));
  return { art, map, refs };
}

/** Flattened twill lettering (no layers): navy border, cream border, crimson satin. */
function twill(ctx, text, x, y, px, family, w, h) {
  ctx.font = "400 " + px + "px \"" + family + "\"";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.NAVY; ctx.lineWidth = px * 0.11; ctx.strokeText(text, x, y);
  ctx.strokeStyle = C.CREAM; ctx.lineWidth = px * 0.055; ctx.strokeText(text, x, y);
  const fill = canvas(w, h), f = fill.getContext("2d");
  f.font = ctx.font; f.textAlign = "center"; f.textBaseline = "alphabetic";
  f.fillStyle = C.CRIMSON; f.fillText(text, x, y);
  satin(f, w, h, -0.5);
  ctx.drawImage(fill, 0, 0);
}

async function main() {
  for (const f of __FONTS__) {
    const bin = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0));
    const face = new FontFace(f.family, bin.buffer, { weight: "1 1000" });
    await face.load();
    document.fonts.add(face);
  }
  const meta = {};
  const designMeta = (key, c, refs) => { meta[key] = { width: c.width, height: c.height, thumb: [thumb(c).width, thumb(c).height], refs }; };

  // ---- Flattened: "Class of 2027" banner (Main Back) ----
  {
    const W = 1600, H = 720, c = canvas(W, H), x = c.getContext("2d");
    const ribbon = () => { x.beginPath(); x.moveTo(60, 170); x.lineTo(W - 60, 170); x.lineTo(W - 150, 360); x.lineTo(W - 60, 550); x.lineTo(60, 550); x.lineTo(150, 360); x.closePath(); };
    ribbon(); x.fillStyle = C.NAVY; x.fill();
    x.save(); x.translate(W / 2, H / 2); x.scale(0.94, 0.86); x.translate(-W / 2, -H / 2); ribbon(); x.fillStyle = C.CREAM; x.fill(); x.restore();
    satin(x, W, H, 0.9, 9);
    twill(x, "CLASS OF 2027", W / 2, 418, 142, "JK Graduate", W, H);
    put("assets/${IDS.banner}/full.png", c); put("assets/${IDS.banner}/thumb.png", thumb(c));
    designMeta("banner", c);
  }

  // ---- Flattened: "27" number patch (chest, sleeves) ----
  {
    const W = 900, H = 900, c = canvas(W, H), x = c.getContext("2d");
    twill(x, "27", W / 2, 700, 620, "JK Bowlby", W, H);
    put("assets/${IDS.number}/full.png", c); put("assets/${IDS.number}/thumb.png", thumb(c));
    designMeta("number", c);
  }

  // ---- Layers: graduation year "2027" (number fill navy, outline white) ----
  {
    const W = 1500, H = 600;
    const { art, map, refs } = compose(W, H, lettering(W, H, "2027", "JK Bowlby", 380, W / 2, 440, T.navy.hex, T.white.hex), 2);
    put("assets/${IDS.year}/full.png", art); put("assets/${IDS.year}/thumb.png", thumb(art)); put("colourways/${IDS.year}/regions.png", map);
    designMeta("year", art, refs);
  }

  // ---- Layers: the word "SENIORS" (text fill red, outline white) ----
  {
    const W = 1700, H = 460;
    const { art, map, refs } = compose(W, H, lettering(W, H, "SENIORS", "JK Graduate", 300, W / 2, 330, T.red.hex, T.white.hex), 2);
    put("assets/${IDS.word}/full.png", art); put("assets/${IDS.word}/thumb.png", thumb(art)); put("colourways/${IDS.word}/regions.png", map);
    designMeta("word", art, refs);
  }

  // ---- Layers: crest — border ring (navy), star fill (red), detail ring (gold) ----
  {
    const W = 1024, H = 1024, cx = W / 2, cy = H / 2;
    const ring = (r1, r2) => (x) => { x.beginPath(); x.arc(cx, cy, r1, 0, Math.PI * 2); x.arc(cx, cy, r2, 0, Math.PI * 2); x.fill("evenodd"); };
    const star = (x) => {
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 120 : 300, a = -Math.PI / 2 + (i * Math.PI) / 5;
        x[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      x.closePath(); x.fill();
    };
    const { art, map, refs } = compose(W, H, [
      { slot: 1, canvas: layer(W, H, ring(490, 380), T.navy.hex, 0.6) },
      { slot: 3, canvas: layer(W, H, ring(352, 330), T.gold.hex, 0.2) },
      { slot: 2, canvas: layer(W, H, star, T.red.hex, -0.6) },
    ], 3);
    put("assets/${IDS.crest}/full.png", art); put("assets/${IDS.crest}/thumb.png", thumb(art)); put("colourways/${IDS.crest}/regions.png", map);
    designMeta("crest", art, refs);
  }

  // ---- Front Letters: a varsity monogram, letter fill (burgundy) + outline (white) ----
  {
    const CW = 560, CH = 640, W = 1200, H = 1200, PX = 560;
    const slots = [{ x: 60, y: 60 }, { x: 580, y: 500 }];
    const base = "letter-templates/${IDS.monogram}/";
    const cell = (ch) => compose(CW, CH, lettering(CW, CH, ch, "JK Graduate", PX, CW / 2, 540, T.burgundy.hex, T.white.hex), 2);
    // Glyph maps are composed onto each other: transparent where no layer is.
    const cellMap = (m) => { const x = m.getContext("2d"), d = x.getImageData(0, 0, CW, CH); for (let i = 0; i < CW * CH; i++) if (!d.data[i * 4]) d.data[i * 4 + 3] = 0; x.putImageData(d, 0, 0); return m; };
    const A = cell("A");
    for (const n of [1, 2]) { put(base + "glyphs/A-" + n + ".png", A.art); put(base + "glyphs/A-" + n + ".regions.png", cellMap(A.map)); }
    for (const ch of "BCDEFGHIJKLMNOPQRSTUVWXYZ") { const g = cell(ch); put(base + "glyphs/" + ch + ".png", g.art); put(base + "glyphs/" + ch + ".regions.png", cellMap(g.map)); }
    const c = canvas(W, H), x = c.getContext("2d");
    for (const s of slots) x.drawImage(A.art, s.x, s.y);
    put("assets/${IDS.monogram}/full.png", c); put("assets/${IDS.monogram}/thumb.png", thumb(c));
    meta.monogram = { width: W, height: H, cell: [CW, CH], slots, thumb: [thumb(c).width, thumb(c).height], refs: A.refs };
  }

  return { files, meta };
}
main().then(
  (r) => { document.getElementById("o").textContent = "OK" + JSON.stringify(r); },
  (e) => { document.getElementById("o").textContent = "ERROR " + e.message; }
);
`;

async function draw(pageScript, THREADS) {
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error("Chrome or Edge is needed to draw the fixtures.");
  const fonts = [
    { family: "JK Graduate", data: font("graduate") },
    { family: "JK Bowlby", data: font("bowlby") },
  ];
  const threads = Object.fromEntries(THREADS.map((t) => [t.id, t]));
  const work = mkdtempSync(join(tmpdir(), "jk-fixtures-"));
  try {
    const html = join(work, "fixtures.html");
    const script = DRAW.replace("__FONTS__", JSON.stringify(fonts))
      .replace("__COLOURS__", JSON.stringify({ NAVY, CRIMSON, CREAM }))
      .replace("__THREADS__", JSON.stringify(threads))
      .replace("__OUTLINE_SHARE__", String(OUTLINE_SHARE));
    writeFileSync(html, `<!doctype html><html><body><pre id="o"></pre><script>${pageScript}</script><script>${script}</script></body></html>`, "utf8");
    const { stdout } = await run(browser, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--virtual-time-budget=90000", "--dump-dom", pathToFileURL(html).href], {
      encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, timeout: 400_000,
    });
    const m = /<pre id="o">OK([\s\S]*?)<\/pre>/.exec(stdout);
    if (!m) throw new Error(`Drawing failed: ${/<pre id="o">([^<]{0,300})/.exec(stdout)?.[1] ?? "no output"}`);
    return JSON.parse(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const write = (path, data) => {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
};
const json = (path, value) => write(path, `${JSON.stringify(value, null, 1)}\n`);

const { pageScript, THREADS } = await bundles();
const thread = (id) => THREADS.find((t) => t.id === id);
const { files, meta } = await draw(pageScript, THREADS);
rmSync(OUT, { recursive: true, force: true });
for (const [path, url] of Object.entries(files)) write(path, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));

const URL_ROOT = "/embroidery-library";
const SOURCE = { provider: "jacketek-test", placements: [] };
const design = (key, libraryId, libraryTitle, productionName, name, zones) => ({
  id: `jacketek:${IDS[key]}`,
  designId: IDS[key],
  libraryId,
  libraryTitle,
  libraryDescription: "JACKETEK test fixture (original artwork, scripts/embroidery-fixtures/build.mjs).",
  productionName,
  originalFileName: `${name}.png`,
  asset: `${URL_ROOT}/assets/${IDS[key]}/full.png`,
  thumbnail: `${URL_ROOT}/assets/${IDS[key]}/thumb.png`,
  thumbnailWidth: meta[key].thumb[0],
  thumbnailHeight: meta[key].thumb[1],
  format: "png",
  width: meta[key].width,
  height: meta[key].height,
  transparent: true,
  zones,
  source: { ...SOURCE, libraryId, designId: IDS[key], fullSleeve: false, fullUrl: "", thumbnailUrl: "" },
});

/** A colour layer: stable id, English label, semantic key, the design's own thread, its reference shading. */
const slot = (key, index, label, role, threadId, refs) => ({
  id: key,
  index,
  label,
  role,
  key,
  defaultColor: thread(threadId).hex,
  defaultThread: threadId,
  method: "shading-preserving",
  ref: refs[index],
});

const lettersTitle = "Front Letters";
const testTitle = "JACKETEK test patches";
const designs = [
  design("monogram", FRONT_LETTERS_LIBRARY, lettersTitle, "TEST-F", "varsity-monogram", ["leftChest", "rightChest"]),
  design("year", TEST_LIBRARY, testTitle, "TEST", "year-2027", ["mainBack", "leftChest", "rightChest", ...SLEEVES]),
  design("word", TEST_LIBRARY, testTitle, "TEST", "seniors", ["mainBack", "leftChest", "rightChest"]),
  design("crest", TEST_LIBRARY, testTitle, "TEST", "star-crest", ["leftChest", "rightChest", "mainBack", ...SLEEVES]),
  design("number", TEST_LIBRARY, testTitle, "TEST", "number-27", ["leftChest", "rightChest", ...SLEEVES]),
  design("banner", TEST_LIBRARY, testTitle, "TEST", "class-of-2027", ["mainBack"]),
];
json("library.json", {
  version: 1,
  generated: new Date().toISOString(),
  note: "TEST SUBSET — original JACKETEK fixtures only. The full library is connected with EMBROIDERY_LIBRARY_DIR (server/embroideryLibrary.mjs).",
  libraries: [
    { id: FRONT_LETTERS_LIBRARY, title: lettersTitle, titles: { en: lettersTitle, "ar-IQ": "الحروف الأمامية" }, description: lettersTitle, productionName: "TEST-F", designCount: 1 },
    { id: TEST_LIBRARY, title: testTitle, titles: { en: testTitle, "ar-IQ": "باتشات تجريبية من جاكيتك" }, description: testTitle, productionName: "TEST", designCount: 5 },
  ],
  designs,
});

// Colourways: the year, the word and the crest.
const colourways = {
  year: { name: "year-2027.png", subject: "number", slots: [slot("fill", 1, "Fill", "Number fill", "navy", meta.year.refs), slot("outline", 2, "Outline", "Number outline", "white", meta.year.refs)] },
  word: { name: "seniors.png", subject: "text", slots: [slot("fill", 1, "Fill", "Text fill", "red", meta.word.refs), slot("outline", 2, "Outline", "Text outline", "white", meta.word.refs)] },
  crest: {
    name: "star-crest.png",
    slots: [slot("border", 1, "Border", "Outer ring", "navy", meta.crest.refs), slot("fill", 2, "Fill", "Star", "red", meta.crest.refs), slot("detail", 3, "Detail", "Inner ring", "gold", meta.crest.refs)],
  },
};
const index = {};
for (const [key, cw] of Object.entries(colourways)) {
  json(`colourways/${IDS[key]}/colourway.json`, {
    version: 2,
    type: "colourway",
    designId: IDS[key],
    libraryId: TEST_LIBRARY,
    originalFileName: cw.name,
    asset: `${URL_ROOT}/assets/${IDS[key]}/full.png`,
    width: meta[key].width,
    height: meta[key].height,
    regionMap: "regions.png",
    keepOriginal: true,
    ...(cw.subject ? { subject: cw.subject, outline: { widthShare: OUTLINE_SHARE } } : {}),
    slots: cw.slots,
  });
  index[IDS[key]] = { file: `${IDS[key]}/colourway.json`, originalFileName: cw.name, slots: cw.slots.map((s) => s.id) };
}
json("colourways/index.json", { version: 1, phase: 1, designs: index });

// Letter template of the monogram (every glyph a full cell: offsets 0), with
// its colour layers and a region map per glyph.
const [CW, CH] = meta.monogram.cell;
const glyphs = Object.fromEntries(
  [..."BCDEFGHIJKLMNOPQRSTUVWXYZ"].map((ch) => [ch, { file: `glyphs/${ch}.png`, regions: `glyphs/${ch}.regions.png`, dx: 0, dy: 0, width: CW, height: CH }])
);
json(`letter-templates/${IDS.monogram}/template.json`, {
  version: 2,
  type: "front-letters",
  templateId: IDS.monogram,
  libraryId: FRONT_LETTERS_LIBRARY,
  originalFileName: "varsity-monogram.png",
  asset: `${URL_ROOT}/assets/${IDS.monogram}/full.png`,
  style: { id: "varsity-block", name: "Varsity block", family: "varsity", approximation: false, notes: "JACKETEK test fixture (Graduate, SIL OFL)." },
  canvas: { width: meta.monogram.width, height: meta.monogram.height },
  defaultLetters: "AA",
  characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  slots: meta.monogram.slots.map((s, i) => ({
    x: s.x,
    y: s.y,
    originalA: { file: `glyphs/A-${i + 1}.png`, regions: `glyphs/A-${i + 1}.regions.png`, x: s.x, y: s.y, width: CW, height: CH },
    overlay: null,
  })),
  glyphs,
  // One fill / outline for both letters (per-letter colours: slots per letter position, later).
  colourway: {
    version: 2,
    keepOriginal: true,
    subject: "letters",
    outline: { widthShare: OUTLINE_SHARE },
    slots: [slot("fill", 1, "Fill", "Letter fill", "burgundy", meta.monogram.refs), slot("outline", 2, "Outline", "Letter outline", "white", meta.monogram.refs)],
  },
});
json("letter-templates/index.json", {
  version: 1,
  libraryId: FRONT_LETTERS_LIBRARY,
  templates: { [IDS.monogram]: { file: `${IDS.monogram}/template.json`, style: "varsity-block", name: "Varsity block", approximation: false } },
});

console.log(`Embroidery test subset: ${Object.keys(files).length} images + JSON → ${OUT}`);
