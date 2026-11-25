// OPTIONAL COLOUR OVERRIDES for flat ready-made designs (no hand-made colour
// layers): generated colour layers, written to the colour layers overlay
// (embroidery-library-layers/colourways/…) — the licensed library is never written to.
//
// For every design of the given libraries that has no colourway yet, the
// artwork is measured (headless Chrome decodes it: PNG and WebP alike) and
// one of three outcomes is chosen, deterministically:
//
//   layers   2–3 clean, distinct colours covering the design (e.g. a number's
//            fill + outline): one layer each (fill / outline / detail; the
//            outline is the colour along the silhouette);
//   single   one dominant colour (a silhouette design): one "Colour" layer,
//            i.e. Original or one thread;
//   original anything with shading or many colours (one thread would destroy
//            the drawing): no layers — Original only.
//
// Generated colourways carry `mode: "override"`: the design stays exactly
// as it is (preview and production) until the customer picks a colour; then
// the layer is recoloured (stitch shading kept) and stitched in that thread
// (server/colourways.mjs). The overlay's colourways/index.json is the
// library's own index plus the generated entries; report.json records every
// decision with its measurements.
//
//   node scripts/colourways/override-layers.mjs --libraries <libraryId,…> [--subject-number <libraryId,…>] [--dry]

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const lib = await import(pathToFileURL(join(ROOT, "server", "embroideryLibrary.mjs")).href);
const run = promisify(execFile);

const libraries = (arg("--libraries") ?? "").split(",").filter(Boolean);
const numberLibraries = new Set((arg("--subject-number") ?? "").split(",").filter(Boolean));
const dry = process.argv.includes("--dry");
if (!libraries.length) {
  console.error("usage: node scripts/colourways/override-layers.mjs --libraries <libraryId,…> [--subject-number <libraryId,…>] [--dry]");
  process.exit(1);
}

// Decision thresholds (shares of the design's opaque pixels; ΔE in CIELAB).
// Distances weigh lightness less than hue: stitch shading (one thread, lighter and
// darker) is not another colour; a different hue is.
const RULES = {
  layerMin: 0.025, // a colour counts as a layer from 2.5 % of the design (a thin outline)
  coverLayers: 0.93, // 2–3 layers must explain ≥ 93 % of the design…
  maxResidual: 0.06, // …with ≤ 6 % of pixels near none of them (gradients, extra colours)
  near: 16, // "near" a layer's colour (shading-weighted distance)
  minSeparation: 14, // colours closer than this are one thread
  accentShare: 0.004, // a small coloured accent (≥ 0.4 %) of another hue: an ornament → Original only
  accentChroma: 20,
  accentHue: 25,
  single: 0.86, // one colour ≥ 86 % of the design: a silhouette, one thread
  outlineEdge: 0.6, // the colour holding ≥ 60 % of the silhouette's edge is the outline
};

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("No Chrome/Edge found (set CHROME_PATH).");

const library = JSON.parse(readFileSync(join(lib.LIBRARY_DIR, "library.json"), "utf8"));
const ownIndexFile = join(lib.LIBRARY_DIR, "colourways", "index.json");
const ownIndex = existsSync(ownIndexFile) ? JSON.parse(readFileSync(ownIndexFile, "utf8")) : { version: 1, designs: {} };
const targets = library.designs
  .filter((d) => libraries.includes(d.libraryId) && !ownIndex.designs[d.designId])
  .sort((a, b) => a.designId.localeCompare(b.designId));
console.log(`${targets.length} designs without colour layers in ${libraries.length} libraries`);

/** The page that measures each design and draws its region map (runs in headless Chrome). */
const PAGE = String.raw`
const RULES = __RULES__;
const s2l = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const lab = (r, g, b) => { const R = s2l(r), G = s2l(g), B = s2l(b); const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883); return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
const luma = (r, g, b) => 0.2126 * s2l(r) + 0.7152 * s2l(g) + 0.0722 * s2l(b);
// Shading-weighted distance²: lightness counts less than hue (stitch shading within one
// thread). WL = how much less: 2 (shading-tolerant: decides eligibility and layers), 1.6
// (stricter: re-checks a "one colour" design for separate tones, e.g. grey + white).
let WL = 2;
const d2 = (a, b) => ((a[0] - b[0]) / WL) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const chroma = (c) => Math.hypot(c[1], c[2]);
const hueGap = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);
const hex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function load(src) { return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("image " + src)); i.src = src; }); }

async function analyse(job) {
  const img = await load(job.src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  const N = W * H;
  // Opaque pixels, in Lab (a deterministic sample for clustering).
  const opaque = [];
  for (let i = 0; i < N; i++) if (px[i * 4 + 3] >= 128) opaque.push(i);
  if (opaque.length < 500) return { id: job.id, decision: "original", why: "almost no artwork" };
  const step = Math.max(1, Math.floor(opaque.length / 60000));
  const sample = [];
  for (let k = 0; k < opaque.length; k += step) { const o = opaque[k] * 4; sample.push(lab(px[o], px[o + 1], px[o + 2])); }
  // k-means (k = 6), seeded by farthest points from the darkest sample: deterministic.
  const K = 6;
  let centres = [sample.reduce((m, p) => (p[0] < m[0] ? p : m), sample[0]).slice()];
  while (centres.length < K) {
    let best = null, bestD = -1;
    for (const p of sample) { const d = Math.min(...centres.map((c) => d2(p, c))); if (d > bestD) { bestD = d; best = p; } }
    centres.push(best.slice());
  }
  let assign = new Int8Array(sample.length);
  for (let it = 0; it < 14; it++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    sample.forEach((p, i) => { let k = 0, m = Infinity; centres.forEach((c, j) => { const d = d2(p, c); if (d < m) { m = d; k = j; } }); assign[i] = k; const s = sum[k]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    centres = centres.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c));
  }
  // Merge near-identical clusters, then rank by share.
  let clusters = centres.map((c, j) => ({ lab: c, n: 0, members: [j] }));
  assign.forEach((k) => clusters[k].n++);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let a = 0; a < clusters.length; a++) for (let b = a + 1; b < clusters.length; b++) {
      if (Math.sqrt(d2(clusters[a].lab, clusters[b].lab)) < RULES.minSeparation) {
        const A = clusters[a], B = clusters[b], n = A.n + B.n || 1;
        clusters[a] = { lab: A.lab.map((v, i) => (v * A.n + B.lab[i] * B.n) / n), n: A.n + B.n, members: [...A.members, ...B.members] };
        clusters.splice(b, 1); merged = true; break outer;
      }
    }
  }
  clusters.sort((a, b) => b.n - a.n);
  const total = sample.length;
  const major = clusters.filter((c) => c.n / total >= RULES.layerMin).slice(0, 3);
  // How well the major colours explain the design: pixels near none of them (nor between two) are residual.
  const near = (p) => {
    let i1 = -1, i2 = -1, m1 = Infinity, m2 = Infinity;
    major.forEach((c, j) => { const d = d2(p, c.lab); if (d < m1) { m2 = m1; i2 = i1; m1 = d; i1 = j; } else if (d < m2) { m2 = d; i2 = j; } });
    let t = 1, perp = Math.sqrt(m1);
    if (i2 >= 0) { const A = major[i1].lab, B = major[i2].lab, AB = d2(A, B) || 1; const tt = ((p[0] - A[0]) * (B[0] - A[0]) + (p[1] - A[1]) * (B[1] - A[1]) + (p[2] - A[2]) * (B[2] - A[2])) / AB; const tc = Math.max(0, Math.min(1, tt)); const proj = [A[0] + tc * (B[0] - A[0]), A[1] + tc * (B[1] - A[1]), A[2] + tc * (B[2] - A[2])]; const pd = Math.sqrt(d2(p, proj)); if (pd < perp && tc > 0.04 && tc < 0.96) { perp = pd; t = 1 - tc; } }
    return { i1, i2, m1: Math.sqrt(m1), t, perp };
  };
  let residual = 0;
  for (const p of sample) { const r = near(p); if (r.perp > RULES.near) residual++; }
  const residualShare = residual / total;
  const shares = major.map((c) => +(c.n / total).toFixed(4));
  const cover = shares.reduce((a, b) => a + b, 0);
  const metrics = { colours: clusters.length, shares, cover: +cover.toFixed(4), residual: +residualShare.toFixed(4) };

  // A small accent of another hue (a flower, a bow, a sun on a number): an ornament the layers would repaint.
  const accent = clusters.find((c) => !major.includes(c) && c.n / total >= RULES.accentShare && chroma(c.lab) >= RULES.accentChroma && major.every((m) => hueGap(c.lab, m.lab) >= RULES.accentHue));
  if (accent) return { id: job.id, decision: "original", metrics: { ...metrics, accent: +(accent.n / total).toFixed(4) }, why: "ornament of another colour" };
  // Real layers first (a thin outline stays its own thread); one thread only for a true silhouette.
  let decision = "original";
  if (major.length >= 2 && cover >= RULES.coverLayers && residualShare <= RULES.maxResidual) decision = "layers";
  else if (shares[0] >= RULES.single && residualShare <= RULES.maxResidual) decision = "single";
  if (decision === "original") return { id: job.id, decision, metrics, why: residualShare > RULES.maxResidual ? "shading / many colours" : "colours too mixed" };
  const layers = decision === "single" ? [major[0]] : major;

  // The silhouette's edge: which colour holds it (the outline).
  const edgeCount = layers.map(() => 0);
  let edges = 0;
  const at = (x, y) => px[(y * W + x) * 4 + 3] >= 128;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    if (!at(x, y)) continue;
    if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) continue;
    const o = (y * W + x) * 4; const p = lab(px[o], px[o + 1], px[o + 2]);
    let k = 0, m = Infinity; layers.forEach((c, j) => { const d = d2(p, c.lab); if (d < m) { m = d; k = j; } });
    edgeCount[k]++; edges++;
  }
  const edgeShare = edgeCount.map((n) => (edges ? n / edges : 0));

  // The region map at full size: R = layer (1…), G = second layer on blends, B = share of the first.
  const regions = new Uint8ClampedArray(N * 4);
  const refY = layers.map(() => []), refLab = layers.map(() => [[], [], []]), rgbSum = layers.map(() => [0, 0, 0, 0]);
  const L1 = decision === "single";
  for (let i = 0; i < N; i++) {
    const o = i * 4; regions[o + 3] = 255;
    if (px[o + 3] === 0) continue;
    if (L1) { regions[o] = 1; }
    else {
      const p = lab(px[o], px[o + 1], px[o + 2]);
      const r = near.call(null, p);
      // map major index → layer index (same order)
      regions[o] = r.i1 + 1;
      if (r.t < 1 && r.i2 >= 0) { regions[o + 1] = r.i2 + 1; regions[o + 2] = Math.round(r.t * 255); }
      if (r.t < 0.97 || px[o + 3] < 250 || (i % 3)) continue; // reference: solid core pixels, sampled
      refY[r.i1].push(luma(px[o], px[o + 1], px[o + 2])); refLab[r.i1][0].push(p[0]); refLab[r.i1][1].push(p[1]); refLab[r.i1][2].push(p[2]);
      const s = rgbSum[r.i1]; s[0] += px[o]; s[1] += px[o + 1]; s[2] += px[o + 2]; s[3]++;
      continue;
    }
    if (px[o + 3] >= 250 && i % 3 === 0) { const p = lab(px[o], px[o + 1], px[o + 2]); refY[0].push(luma(px[o], px[o + 1], px[o + 2])); refLab[0][0].push(p[0]); refLab[0][1].push(p[1]); refLab[0][2].push(p[2]); const s = rgbSum[0]; s[0] += px[o]; s[1] += px[o + 1]; s[2] += px[o + 2]; s[3]++; }
  }
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  out.getContext("2d").putImageData(new ImageData(regions, W, H), 0, 0);
  const png = out.toDataURL("image/png").split(",")[1];
  const slots = layers.map((c, j) => ({
    share: +(c.n / total).toFixed(4),
    edge: +edgeShare[j].toFixed(3),
    defaultColor: hex(rgbSum[j][3] ? rgbSum[j].slice(0, 3).map((v) => v / rgbSum[j][3]) : [128, 128, 128]),
    ref: { y: +median(refY[j]).toFixed(6), lab: refLab[j].map((xs) => +median(xs).toFixed(3)) },
  }));
  return { id: job.id, decision, metrics: { ...metrics, edgeShare: edgeShare.map((v) => +v.toFixed(3)) }, width: W, height: H, slots, png };
}

(async () => {
  const results = [];
  for (const job of __JOBS__) {
    try {
      WL = 2;
      const tolerant = await analyse(job);
      let chosen = tolerant;
      // A "one colour" design with separate tones (an outline in grey on white…) gets its layers instead.
      if (tolerant.decision === "single") {
        WL = 1.6;
        const strict = await analyse(job);
        if (strict.decision === "layers") chosen = { ...strict, metrics: { ...strict.metrics, recheckedFromSingle: true } };
      }
      results.push(chosen);
    } catch (e) { results.push({ id: job.id, decision: "original", why: String(e.message || e) }); }
  }
  const pre = document.createElement("pre"); pre.id = "out"; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
})();
`;

async function analyseBatch(batch) {
  const work = mkdtempSync(join(tmpdir(), "jk-colourways-"));
  try {
    const jobs = batch.map((d) => {
      const file = lib.libraryFile(d.asset);
      if (!file || !existsSync(file)) throw new Error(`Missing asset for ${d.designId}`);
      const mime = file.toLowerCase().endsWith(".png") ? "image/png" : "image/webp";
      return { id: d.designId, src: `data:${mime};base64,${readFileSync(file).toString("base64")}` };
    });
    const html = join(work, "page.html");
    writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script>${PAGE.replace("__RULES__", JSON.stringify(RULES)).replace("__JOBS__", JSON.stringify(jobs))}</script></body>`);
    const { stdout } = await run(CHROME, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--virtual-time-budget=120000", "--dump-dom", pathToFileURL(html).href], { maxBuffer: 512 * 1024 * 1024, timeout: 300000 });
    const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(stdout);
    if (!m) throw new Error("the measuring page returned nothing");
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Customer-facing keys and English production labels for the layers: the
 * largest is the fill; a different colour holding more of the silhouette's
 * edge than the fill is the outline; the others get distinct names (a
 * number's light band is its inner line).
 */
const NAMES = {
  fill: { label: "Fill", role: "The design's main colour" },
  outline: { label: "Outline", role: "The colour along the design's edge" },
  inline: { label: "Inner line", role: "The band inside the outline" },
  detail: { label: "Detail", role: "A further colour of the design" },
  colour: { label: "Colour", role: "Another colour of the design" },
};
function nameLayers(slots, number) {
  if (slots.length === 1) return [{ key: "colour", label: "Colour", role: "The whole design (one thread)" }];
  const fill = slots.map((_, i) => i).sort((a, b) => slots[b].share - slots[a].share)[0];
  const others = slots.map((_, i) => i).filter((i) => i !== fill);
  const edgy = others.filter((i) => slots[i].edge >= 0.35 && slots[i].edge > slots[fill].edge).sort((a, b) => slots[b].edge - slots[a].edge)[0];
  const extras = (number ? ["inline", "detail"] : ["detail", "colour"]).slice();
  return slots.map((_, i) => {
    const key = i === fill ? "fill" : i === edgy ? "outline" : extras.shift() ?? "detail";
    return { key, ...NAMES[key] };
  });
}

const report = [];
const generated = {};
const BATCH = 6;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  const results = await analyseBatch(batch);
  for (const r of results) {
    const d = batch.find((x) => x.designId === r.id);
    report.push({ designId: r.id, libraryId: d.libraryId, file: d.originalFileName, decision: r.decision, why: r.why, metrics: r.metrics });
    if (r.decision === "original") continue;
    const names = nameLayers(r.slots, numberLibraries.has(d.libraryId));
    const colourway = {
      version: 1,
      type: "colourway",
      designId: r.id,
      libraryId: d.libraryId,
      originalFileName: d.originalFileName,
      asset: d.asset,
      width: r.width,
      height: r.height,
      regionMap: "regions.png",
      ...(numberLibraries.has(d.libraryId) ? { subject: "number" } : {}),
      keepOriginal: true,
      mode: "override",
      slots: r.slots.map((s, j) => ({
        id: `color${j + 1}`,
        index: j + 1,
        label: names[j].label,
        role: names[j].role,
        key: names[j].key,
        defaultColor: s.defaultColor,
        method: "shading-preserving",
        ref: s.ref,
      })),
      generated: { by: "scripts/colourways/override-layers.mjs", decision: r.decision, metrics: r.metrics },
    };
    generated[r.id] = colourway;
    if (!dry) {
      const dir = join(lib.LAYERS_DIR, "colourways", r.id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "colourway.json"), JSON.stringify(colourway, null, 1));
      writeFileSync(join(dir, "regions.png"), Buffer.from(r.png, "base64"));
    }
  }
  console.log(`${Math.min(i + BATCH, targets.length)}/${targets.length}`);
}

// The overlay's index replaces the library's: the library's own designs, then the generated ones.
const index = { version: ownIndex.version ?? 1, designs: { ...ownIndex.designs } };
for (const [id, cw] of Object.entries(generated))
  index.designs[id] = { file: `${id}/colourway.json`, originalFileName: cw.originalFileName, slots: cw.slots.map((s) => s.id), generated: true };
const summary = Object.fromEntries(libraries.map((l) => [l, ["layers", "single", "original"].map((k) => [k, report.filter((r) => r.libraryId === l && r.decision === k).length])]));
if (!dry) {
  mkdirSync(join(lib.LAYERS_DIR, "colourways"), { recursive: true });
  writeFileSync(join(lib.LAYERS_DIR, "colourways", "index.json"), JSON.stringify(index, null, 1));
  writeFileSync(join(lib.LAYERS_DIR, "colourways", "report.json"), JSON.stringify({ rules: RULES, summary, designs: report }, null, 1));
}
console.log(JSON.stringify(summary));
