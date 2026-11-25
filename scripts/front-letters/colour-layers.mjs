// COLOUR LAYERS for the library's Front Letters templates.
//
// The imported letter templates are glyphs cut from flattened artwork, so
// their colours can't be changed until each glyph has a region map. This
// reads the templates (never writing to the library) and writes, into the
// colour layers overlay (embroidery-library-layers/ — see
// server/embroideryLibrary.mjs), a region map per glyph and the template
// with its `colourway` (frontLetters.ts) — only where the artwork's own
// structure gives the layers deterministically:
//
//   - one tone (the letters, any name band, in one colour) → ONE layer:
//     "Letter colour". No outline is invented.
//   - two tones → the tone around the outside of each letter is the
//     OUTLINE; inside it, the other tone is the FILL — or, when the outline
//     tone also returns inside a line of the other tone (felt patches: dark
//     border, light stitch line, dark felt), three layers: OUTLINE, INNER
//     LINE, FILL. The outline is found by flooding from outside the letter
//     through its tone, stopped by (a slightly widened) other tone.
//
// Every glyph of a template is held to the structure found on its own "A";
// a glyph that doesn't match (a leak through a gap, a missing line…) skips
// the whole template — nothing doubtful is written. Each layer keeps the
// artwork's own colour as its "original" (no thread is claimed for it).
//
//   node scripts/front-letters/colour-layers.mjs [--library DIR] [--out DIR] [--only TEMPLATE_ID]
//
// DIR defaults: the library (runtime-assets/embroidery-library, or EMBROIDERY_LIBRARY_DIR) and the overlay.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const lib = await import(pathToFileURL(join(ROOT, "server", "embroideryLibrary.mjs")).href);
const { decodePng, encodePng } = await import(pathToFileURL(join(ROOT, "server", "png.mjs")).href);
const LIBRARY = resolve(arg("--library") ?? lib.LIBRARY_DIR);
const OUT = resolve(arg("--out") ?? lib.LAYERS_DIR);
const ONLY = arg("--only");

// The site's own colour maths (the same the recolouring uses).
const { build } = await import("esbuild");
const bundled = await build({
  stdin: { contents: `export { labOf, lumaOf, labToHexParts } from "./src/features/configurator/library/colourwayRecolour.ts";`, resolveDir: ROOT, loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { labOf, lumaOf, labToHexParts } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const FILL = 1, OUTLINE = 2, INLINE = 3;
/** Tones closer than this (L*) are one colour with stitch texture. */
const MIN_TONE_GAP = 28;
/** The other tone is widened by this much (px) before flooding the outline, closing hairline gaps. */
const BARRIER_PX = Number(arg("--barrier") ?? 2);

const L = (d, o) => labOf(d[o], d[o + 1], d[o + 2])[0];

/** 2-means on lightness of opaque pixels → [dark, light] centres and the light share. */
function tones(img) {
  const v = [];
  for (let i = 0; i < img.width * img.height; i++) if (img.data[i * 4 + 3] >= 250) v.push(L(img.data, i * 4));
  v.sort((a, b) => a - b);
  let a = v[Math.floor(v.length * 0.1)], b = v[Math.floor(v.length * 0.9)];
  for (let it = 0; it < 20; it++) {
    const t = (a + b) / 2;
    let sa = 0, na = 0, sb = 0, nb = 0;
    for (const x of v) if (x < t) { sa += x; na++; } else { sb += x; nb++; }
    a = na ? sa / na : a; b = nb ? sb / nb : b;
  }
  const t = (a + b) / 2;
  return { dark: a, light: b, lightShare: v.filter((x) => x >= t).length / v.length };
}

/**
 * One glyph → per pixel layer (0 = none) and, on edges between two layers,
 * the other layer and this one's share — by the template's structure.
 */
function segment(img, structure, band = null) {
  const W = img.width, H = img.height, N = W * H, d = img.data;
  const label = new Uint8Array(N);
  if (structure.kind === "single") {
    for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 0) label[i] = FILL;
    return { label, second: new Uint8Array(N), share: new Uint8Array(N).fill(255), stats: null };
  }
  const t = (structure.dark + structure.light) / 2;
  const lum = new Float32Array(N);
  const tone = new Int8Array(N).fill(-1); // 0 dark, 1 light, -1 transparent
  for (let i = 0; i < N; i++) if (d[i * 4 + 3] >= 128) { lum[i] = L(d, i * 4); tone[i] = lum[i] < t ? 0 : 1; }
  const borderTone = structure.borderTone;
  // The other tone, widened: the outline's flood stops there.
  const barrier = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (tone[i] !== 1 - borderTone) continue;
    const x = i % W, y = (i / W) | 0;
    for (let dy = -BARRIER_PX; dy <= BARRIER_PX; dy++) for (let dx = -BARRIER_PX; dx <= BARRIER_PX; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < H) barrier[Y * W + X] = 1;
    }
  }
  // What is outside the letter: transparency reaching the image's edge, or a
  // real counter (the hole of an A, O…). Pinholes in the stitching (small
  // enclosed transparent specks) are not.
  const open = new Uint8Array(N);
  {
    const seen = new Uint8Array(N);
    const minHole = Math.max(64, Math.round(N * 0.0015));
    for (let s0 = 0; s0 < N; s0++) {
      if (seen[s0] || tone[s0] >= 0) continue;
      const comp = [s0];
      seen[s0] = 1;
      let edge = false;
      for (let q = 0; q < comp.length; q++) {
        const i = comp[q], x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= N || seen[j] || tone[j] >= 0) continue;
          seen[j] = 1;
          comp.push(j);
        }
      }
      if (edge || comp.length >= minHole) for (const i of comp) open[i] = 1;
    }
  }
  const outside = (i) => { const x = i % W, y = (i / W) | 0; return x === 0 || y === 0 || x === W - 1 || y === H - 1 || open[i - 1] || open[i + 1] || open[i - W] || open[i + W]; };
  // Distance (px, 4-connected) from outside the letter, for every opaque pixel.
  const dist = new Int32Array(N).fill(-1);
  const dq = [];
  for (let i = 0; i < N; i++) if (tone[i] >= 0 && outside(i)) { dist[i] = 0; dq.push(i); }
  for (let q = 0; q < dq.length; q++) {
    const i = dq[q], x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || dist[j] >= 0 || tone[j] < 0) continue;
      dist[j] = dist[i] + 1;
      dq.push(j);
    }
  }
  if (band !== null) {
    // The border by its measured thickness (a glyph whose dividing line has
    // breaks, so a flood would leak): outline tone within `band` of outside.
    for (let i = 0; i < N; i++) if (tone[i] === borderTone && !barrier[i] && dist[i] <= band) label[i] = OUTLINE;
  } else {
    // Flood the outline from the outside of the letter, through its tone.
    const queue = [];
    for (let i = 0; i < N; i++) if (tone[i] === borderTone && !barrier[i] && outside(i)) { label[i] = OUTLINE; queue.push(i); }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || label[j] || tone[j] !== borderTone || barrier[j]) continue;
        label[j] = OUTLINE;
        queue.push(j);
      }
    }
  }
  // The outline's thickness on this glyph (95th percentile of its distances from outside).
  const od = [];
  for (let i = 0; i < N; i++) if (label[i] === OUTLINE) od.push(dist[i]);
  od.sort((a, b) => a - b);
  const outlineBand = od.length ? od[Math.floor(od.length * 0.95)] : 0;
  let inner = 0, borderAll = 0, other = 0;
  for (let i = 0; i < N; i++) {
    if (tone[i] === borderTone) { borderAll++; if (!label[i] && !barrier[i]) { label[i] = structure.three ? FILL : OUTLINE; inner++; } }
    else if (tone[i] === 1 - borderTone) { label[i] = structure.three ? INLINE : FILL; other++; }
  }
  // Everything still unlabelled (soft outer edge, the widened band) joins its nearest labelled neighbour.
  const front = [];
  for (let i = 0; i < N; i++) if (label[i]) front.push(i);
  for (let q = 0; q < front.length; q++) {
    const i = front[q], x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || label[j] || d[j * 4 + 3] === 0) continue;
      label[j] = label[i];
      front.push(j);
    }
  }
  // Edges between two layers: this layer's share, from where the pixel's lightness sits between the two tones.
  const centre = { [OUTLINE]: borderTone ? structure.light : structure.dark, [FILL]: structure.three ? (borderTone ? structure.light : structure.dark) : (borderTone ? structure.dark : structure.light), [INLINE]: borderTone ? structure.dark : structure.light };
  const second = new Uint8Array(N), share = new Uint8Array(N).fill(255);
  for (let i = 0; i < N; i++) {
    const k = label[i];
    if (!k || d[i * 4 + 3] < 128) continue;
    const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || !label[j] || label[j] === k) continue;
      const a = centre[k], b = centre[label[j]];
      if (Math.abs(a - b) < 1) break;
      const s = Math.max(0, Math.min(1, (lum[i] - b) / (a - b)));
      if (s < 0.95) { second[i] = label[j]; share[i] = Math.round(Math.max(0.5, s) * 255); }
      break;
    }
  }
  return { label, second, share, stats: { innerShare: borderAll ? inner / borderAll : 0, otherShare: other / Math.max(1, borderAll + other), outlineBand } };
}

/** A region map image: red = layer, green = second layer, blue = share; opaque only where a layer is. */
function regionPng(img, seg) {
  const out = new Uint8Array(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    if (!seg.label[i]) continue;
    out.set([seg.label[i], seg.second[i], seg.second[i] ? seg.share[i] : 255, 255], i * 4);
  }
  return encodePng({ width: img.width, height: img.height, data: out });
}

/** Each layer's reference shading and own colour: medians over its core pixels. */
function references(img, seg, layers) {
  const acc = Object.fromEntries(layers.map((k) => [k, { y: [], L: [], a: [], b: [] }]));
  for (let i = 0; i < img.width * img.height; i++) {
    const k = seg.label[i];
    if (!k || seg.second[i] || img.data[i * 4 + 3] < 255) continue;
    const o = i * 4, lab = labOf(img.data[o], img.data[o + 1], img.data[o + 2]);
    acc[k].y.push(lumaOf(img.data[o], img.data[o + 1], img.data[o + 2]));
    acc[k].L.push(lab[0]); acc[k].a.push(lab[1]); acc[k].b.push(lab[2]);
  }
  const med = (v) => { const s = [...v].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
  const r3 = (n) => Math.round(n * 1000) / 1000;
  return Object.fromEntries(layers.map((k) => {
    const lab = [r3(med(acc[k].L)), r3(med(acc[k].a)), r3(med(acc[k].b))];
    const hex = `#${labToHexParts(lab).map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`;
    return [k, { ref: { y: Math.round(med(acc[k].y) * 1e6) / 1e6, lab }, hex }];
  }));
}

const index = JSON.parse(readFileSync(join(LIBRARY, "letter-templates", "index.json"), "utf8"));
const report = [];
for (const templateId of Object.keys(index.templates)) {
  if (ONLY && templateId !== ONLY) continue;
  const dir = join(LIBRARY, "letter-templates", templateId);
  const t = JSON.parse(readFileSync(join(dir, "template.json"), "utf8"));
  const read = (f) => decodePng(readFileSync(join(dir, f)));
  const A = read(t.slots[0].originalA.file);
  // The structure is read on a generated glyph (clean lines), else the A.
  const P = t.glyphs.Y ? read(t.glyphs.Y.file) : A;
  const tn = tones(P);
  const kind = tn.light - tn.dark < MIN_TONE_GAP || tn.lightShare < 0.04 || tn.lightShare > 0.96 ? "single" : "layers";
  let structure = { kind };
  if (kind === "layers") {
    // Which tone lies around the outside of the letter.
    const t0 = (tn.dark + tn.light) / 2;
    let darkOut = 0, lightOut = 0;
    for (let i = 0; i < P.width * P.height; i++) {
      if (P.data[i * 4 + 3] < 128) continue;
      const x = i % P.width;
      const edge = [i - 1, i + 1, i - P.width, i + P.width].some((j) => j < 0 || j >= P.width * P.height || (x === 0 && j === i - 1) || P.data[j * 4 + 3] < 128);
      if (edge) L(P.data, i * 4) < t0 ? darkOut++ : lightOut++;
    }
    structure = { kind, dark: tn.dark, light: tn.light, borderTone: darkOut >= lightOut ? 0 : 1, three: false };
    const probe = segment(P, structure).stats;
    structure.three = probe.innerShare >= 0.15;
    structure.reference = segment(P, structure).stats;
  }
  const layers = kind === "single" ? [FILL] : structure.three ? [FILL, OUTLINE, INLINE] : [FILL, OUTLINE];
  // Every glyph (both original A's, A–Z, name bands), held to the A's structure.
  const files = [
    ...t.slots.flatMap((s) => [s.originalA.file, ...(s.overlay ? [s.overlay.file] : [])]),
    ...Object.values(t.glyphs).map((g) => g.file),
  ];
  const maps = {};
  let problem = null;
  let refs = null;
  for (const f of [...new Set(files)]) {
    const img = read(f);
    let seg = segment(img, structure);
    const isBand = t.slots.some((s) => s.overlay?.file === f);
    // A dividing line with breaks (real stitching, e.g. the original A's):
    // the flood leaks — take the border by its thickness on the clean glyphs.
    if (kind === "layers" && structure.three && !isBand && seg.stats.innerShare < structure.reference.innerShare * 0.5) {
      seg = segment(img, structure, structure.reference.outlineBand);
      if (seg.stats.innerShare >= structure.reference.innerShare * 0.5) (structure.banded ??= []).push(f);
    }
    if (kind === "layers" && !isBand) {
      const ref = structure.reference;
      // Felt patches: the felt (fill) must be found inside the line, as on the A.
      if (structure.three && seg.stats.innerShare < ref.innerShare * 0.5) problem = `${f}: the outline tone leaked into the fill (${Math.round(seg.stats.innerShare * 100)} % inside vs ${Math.round(ref.innerShare * 100)} % on A)`;
      if (!structure.three && seg.stats.innerShare > 0.1) problem = `${f}: outline tone found inside the letter (${Math.round(seg.stats.innerShare * 100)} %)`;
    }
    if (problem) break;
    if (f === t.slots[0].originalA.file) refs = references(img, seg, layers);
    maps[f] = regionPng(img, seg);
  }
  const name = index.templates[templateId].name;
  if (problem) {
    report.push(`SKIP  ${templateId}  ${name}: ${problem}`);
    continue;
  }
  const regionsOf = (f) => f.replace(/\.png$/i, ".regions.png");
  const slot = (k, key, label, role) => ({ id: key, index: k, label, role, key, defaultColor: refs[k].hex, method: "shading-preserving", ref: refs[k].ref });
  const slots =
    kind === "single"
      ? [slot(FILL, "colour", "Colour", "Letters (one colour)")]
      : [
          slot(FILL, "fill", "Fill", structure.three ? "Letter felt / fill" : "Letter fill"),
          slot(OUTLINE, "outline", "Outline", "Outer border"),
          ...(structure.three ? [slot(INLINE, "inline", "Inner line", "Stitch line between border and fill")] : []),
        ];
  const out = {
    ...t,
    slots: t.slots.map((s) => ({ ...s, originalA: { ...s.originalA, regions: regionsOf(s.originalA.file) }, overlay: s.overlay ? { ...s.overlay, regions: regionsOf(s.overlay.file) } : s.overlay })),
    glyphs: Object.fromEntries(Object.entries(t.glyphs).map(([ch, g]) => [ch, { ...g, regions: regionsOf(g.file) }])),
    colourway: {
      version: 1,
      keepOriginal: true,
      subject: "letters",
      generated: { by: "scripts/front-letters/colour-layers.mjs", at: new Date().toISOString(), structure: kind === "single" ? "one colour" : structure.three ? "outline + inner line + fill" : "outline + fill" },
      slots,
    },
  };
  const target = join(OUT, "letter-templates", templateId);
  for (const [f, png] of Object.entries(maps)) {
    const file = join(target, regionsOf(f));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, png);
  }
  writeFileSync(join(target, "template.json"), `${JSON.stringify(out, null, 1)}\n`);
  report.push(`OK    ${templateId}  ${name}: ${slots.map((s) => `${s.label} ${s.defaultColor}`).join(" · ")}  (${Object.keys(maps).length} maps${structure.banded ? `; border by thickness on ${structure.banded.join(", ")}` : ""})`);
}
console.log(report.join("\n"));
console.log(`\nOverlay: ${OUT}${existsSync(OUT) ? "" : " (nothing written)"}`);
