/**
 * AUTO-DIGITIZING (prototype) — raster artwork → embroidery stitches.
 *
 * Pure TypeScript (no DOM, no Node APIs): the server feeds it decoded RGBA
 * pixels of the processed transparent PNG.
 *
 *   1. mask: opaque pixels are the design
 *   2. colours: k-means into at most MAX_COLOURS thread colours (or one
 *      thread), small clusters merged, anti-alias noise smoothed
 *   3. regions: connected areas per colour; specks below MIN_REGION_MM2
 *      merged into their neighbour
 *   4. per region, width across its main axis decides the stitch type:
 *        ≤ 0.9 mm  running stitch along the centre line
 *        ≤ 7 mm    satin across the column (centre-walk underlay)
 *        wider     tatami fill (perpendicular tatami underlay)
 *   5. sewing order: colours by area (largest first), regions nearest-first;
 *      tie-in / tie-off and a trim for travels over TRIM_AT_MM
 *   6. rotation: the whole design is turned as placed on the jacket
 *
 * Real stitch geometry, but no pull compensation tuning, no edge run, no
 * branching satin columns: the output needs professional review.
 */
import { DIGITIZER_ENGINE, DIGITIZING_STATUS, type DigitizedDesign, type DigitizedMetadata, type Stitch, type StitchBlock, type StitchType, type ThreadColour } from "./types";

export type Raster = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export const DIGITIZE_PARAMS = {
  alphaMin: 128,
  maxColours: 6,
  minColourShare: 0.015,
  mergeDistance: 30,
  minRegionMm2: 1.5,
  fillSpacingMm: 0.4,
  fillStitchMm: 3.0,
  satinSpacingMm: 0.4,
  satinMaxWidthMm: 7.0,
  runningMaxWidthMm: 0.9,
  runStitchMm: 2.0,
  underlayFillSpacingMm: 2.0,
  underlayFillStitchMm: 3.5,
  pullCompMm: 0.15,
  maxStitchMm: 12.1,
  travelStitchMaxMm: 2.0,
  trimAtMm: 6.0,
  tieMm: 0.5,
} as const;

export type DigitizeOptions = {
  designId: string;
  /** Final size of the artwork on the garment (before rotation), mm. */
  widthMm: number;
  heightMm: number;
  /** Degrees, counter-clockwise as viewed. */
  rotationDeg: number;
  /** One thread for everything (hex), or null to keep the design's colours. */
  singleThread: { hex: string; name: string } | null;
  /**
   * A design with colour layers (fill, outline…): its region map (any size;
   * red = layer number 1…n, green = a second layer on blended edges, blue =
   * the first layer's share) and the thread of each layer. Stitch colours
   * then come from the layers — each its own named thread, never merged
   * with another however close the colours — not from colour clustering.
   * Pixels in no layer (kept as drawn) are clustered as usual.
   */
  regions?: { map: Raster; threads: { hex: string; name: string }[] } | null;
  placement: DigitizedMetadata["placement"];
  createdAt?: string;
};

type Vec = [number, number];
type Seg = { v: number; t0: number; t1: number };

const P = DIGITIZE_PARAMS;
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const toHex = (c: number[]) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`.toUpperCase();
const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Deterministic pseudo-random numbers (same input → same design). */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** k-means on opaque pixels → cluster centres (RGB). */
function quantise(raster: Raster, opaque: Int32Array): number[][] {
  const { data } = raster;
  const rnd = lcg(opaque.length * 31 + raster.width);
  const step = Math.max(1, Math.floor(opaque.length / 15000));
  const sample: number[][] = [];
  for (let i = 0; i < opaque.length; i += step) {
    const p = opaque[i] * 4;
    sample.push([data[p], data[p + 1], data[p + 2]]);
  }
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // k-means++ seeding
  const centres: number[][] = [sample[Math.floor(rnd() * sample.length)].slice()];
  while (centres.length < P.maxColours) {
    const w = sample.map((s) => Math.min(...centres.map((c) => d2(s, c))));
    const total = w.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let r = rnd() * total, i = 0;
    while ((r -= w[i]) > 0 && i < w.length - 1) i++;
    centres.push(sample[i].slice());
  }
  for (let it = 0; it < 14; it++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const s of sample) {
      let best = 0, bd = Infinity;
      centres.forEach((c, k) => { const d = d2(s, c); if (d < bd) { bd = d; best = k; } });
      sums[best][0] += s[0]; sums[best][1] += s[1]; sums[best][2] += s[2]; sums[best][3]++;
    }
    sums.forEach((s, k) => { if (s[3]) centres[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  // Count shares, merge near-identical centres, drop tiny clusters.
  const count = centres.map(() => 0);
  for (const s of sample) {
    let best = 0, bd = Infinity;
    centres.forEach((c, k) => { const d = d2(s, c); if (d < bd) { bd = d; best = k; } });
    count[best]++;
  }
  let list = centres.map((c, k) => ({ c, n: count[k] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const merged: { c: number[]; n: number }[] = [];
  for (const x of list) {
    const near = merged.find((m) => Math.sqrt(d2(m.c, x.c)) < P.mergeDistance);
    if (near) {
      near.c = near.c.map((v, i) => (v * near.n + x.c[i] * x.n) / (near.n + x.n));
      near.n += x.n;
    } else merged.push({ ...x });
  }
  list = merged.filter((m) => m.n / sample.length >= P.minColourShare);
  return (list.length ? list : merged.slice(0, 1)).map((m) => m.c);
}

/** Main entry: raster + intended size → stitches and metadata. */
export function digitizeRaster(raster: Raster, opt: DigitizeOptions): DigitizedDesign {
  const W = raster.width, H = raster.height, data = raster.data;
  const sx = opt.widthMm / W, sy = opt.heightMm / H, s = (sx + sy) / 2; // mm per pixel
  const warnings: string[] = [];
  if (Math.abs(sx - sy) / s > 0.02) warnings.push("Pixel aspect differs from the stored size by more than 2 %.");

  // 1–2: mask and colour labels (-1 = no stitching)
  const label = new Int16Array(W * H).fill(-1);
  const opaqueList: number[] = [];
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] >= P.alphaMin) opaqueList.push(i);
  const opaque = Int32Array.from(opaqueList);
  let palette: number[][];
  let paletteNames: string[] = [];
  const rgb = (hex: string) => { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  if (!opt.singleThread && opt.regions?.threads.length) {
    // Layers → labels (nearest pixel of the map; on a blended edge, the layer with the larger share).
    const { map, threads } = opt.regions;
    palette = threads.map((t) => rgb(t.hex));
    paletteNames = threads.map((t) => t.name);
    const rest: number[] = [];
    const layerAt = (mx: number, my: number) => {
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) return 0;
      const m = (my * map.width + mx) * 4;
      const k = map.data[m + 1] && map.data[m + 2] < 128 ? map.data[m + 1] : map.data[m];
      return k >= 1 && k <= threads.length ? k : 0;
    };
    // The artwork is stitched at a lower resolution than its map: an edge
    // pixel may land just outside its shape there — it then takes the layer
    // most of its neighbourhood in the map belongs to.
    const reach = Math.ceil(Math.max(map.width / W, map.height / H));
    for (const i of opaque) {
      const x = i % W, y = (i / W) | 0;
      const mx = Math.min(map.width - 1, Math.floor(((x + 0.5) * map.width) / W)), my = Math.min(map.height - 1, Math.floor(((y + 0.5) * map.height) / H));
      let k = layerAt(mx, my);
      if (!k) {
        const votes = new Map<number, number>();
        for (let dy = -reach; dy <= reach; dy++)
          for (let dx = -reach; dx <= reach; dx++) {
            const v = layerAt(mx + dx, my + dy);
            if (v) votes.set(v, (votes.get(v) ?? 0) + 1);
          }
        let best = 0;
        votes.forEach((n, v) => { if (n > (votes.get(best) ?? 0)) best = v; });
        k = best;
      }
      if (k) label[i] = k - 1;
      else rest.push(i);
    }
    // Anything drawn outside the layers keeps its own colours.
    if (rest.length) {
      const extra = quantise(raster, Int32Array.from(rest));
      for (const i of rest) {
        const p = i * 4;
        let best = 0, bd = Infinity;
        extra.forEach((c, k) => { const dd = (data[p] - c[0]) ** 2 + (data[p + 1] - c[1]) ** 2 + (data[p + 2] - c[2]) ** 2; if (dd < bd) { bd = dd; best = k; } });
        label[i] = palette.length + best;
      }
      palette = [...palette, ...extra];
      paletteNames = [...paletteNames, ...extra.map(() => "Design colour")];
    }
  } else if (opt.singleThread) {
    const h = opt.singleThread.hex.replace("#", "");
    palette = [[parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]];
    for (const i of opaque) label[i] = 0;
  } else {
    palette = opaque.length ? quantise(raster, opaque) : [[0, 0, 0]];
    for (const i of opaque) {
      const p = i * 4;
      let best = 0, bd = Infinity;
      palette.forEach((c, k) => { const d = (data[p] - c[0]) ** 2 + (data[p + 1] - c[1]) ** 2 + (data[p + 2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } });
      label[i] = best;
    }
    // Smooth anti-aliased edges: 3×3 majority, twice.
    for (let pass = 0; pass < 2; pass++) {
      const next = label.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (label[i] < 0) continue;
        const votes = new Map<number, number>();
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const l = label[i + dy * W + dx];
          if (l >= 0) votes.set(l, (votes.get(l) ?? 0) + 1);
        }
        let best = label[i], bn = 0;
        votes.forEach((n, l) => { if (n > bn) { bn = n; best = l; } });
        next[i] = best;
      }
      label.set(next);
    }
  }

  // 3: regions (4-connected), specks merged into a neighbour
  const comp = new Int32Array(W * H).fill(-1);
  const findRegions = () => {
    comp.fill(-1);
    const regions: { colour: number; pixels: number[] }[] = [];
    for (let i = 0; i < W * H; i++) {
      if (label[i] < 0 || comp[i] >= 0) continue;
      const id = regions.length, col = label[i], px: number[] = [];
      const stack = [i];
      comp[i] = id;
      while (stack.length) {
        const j = stack.pop()!;
        px.push(j);
        const x = j % W, y = (j / W) | 0;
        const nb = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1];
        for (const k of nb) if (k >= 0 && comp[k] < 0 && label[k] === col) { comp[k] = id; stack.push(k); }
      }
      regions.push({ colour: col, pixels: px });
    }
    return regions;
  };
  let regions = findRegions();
  const minPx = P.minRegionMm2 / (sx * sy);
  let changed = false;
  for (const r of regions) {
    if (r.pixels.length >= minPx) continue;
    const votes = new Map<number, number>();
    for (const j of r.pixels) {
      const x = j % W, y = (j / W) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1])
        if (k >= 0 && label[k] >= 0 && label[k] !== r.colour) votes.set(label[k], (votes.get(label[k]) ?? 0) + 1);
    }
    let to = -1, bn = 0;
    votes.forEach((n, l) => { if (n > bn) { bn = n; to = l; } });
    for (const j of r.pixels) label[j] = to; // -1 drops an isolated speck
    changed = true;
  }
  if (changed) regions = findRegions();

  // Pixel centre → design mm (centre of the artwork at 0,0; y up)
  const mm = (p: Vec): Vec => [(p[0] - W / 2) * sx, (H / 2 - p[1]) * sy];

  // Rows of a region along direction u, stacked along its normal.
  const scan = (id: number, pix: number[], u: Vec, spacingPx: number, grid: Int32Array = comp): Seg[][] => {
    const v: Vec = [-u[1], u[0]];
    let vmin = Infinity, vmax = -Infinity, umin = Infinity, umax = -Infinity;
    for (const j of pix) {
      const x = (j % W) + 0.5, y = ((j / W) | 0) + 0.5;
      const pu = x * u[0] + y * u[1], pv = x * v[0] + y * v[1];
      if (pv < vmin) vmin = pv; if (pv > vmax) vmax = pv; if (pu < umin) umin = pu; if (pu > umax) umax = pu;
    }
    const rows: Seg[][] = [];
    for (let vr = vmin + spacingPx / 2; vr <= vmax; vr += spacingPx) {
      const segs: Seg[] = [];
      let start: number | null = null, last = 0;
      for (let t = umin - 1; t <= umax + 1; t += 0.5) {
        const x = Math.floor(u[0] * t + v[0] * vr), y = Math.floor(u[1] * t + v[1] * vr);
        const inside = x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === id;
        if (inside && start === null) start = t;
        if (!inside && start !== null) { segs.push({ v: vr, t0: start, t1: last }); start = null; }
        if (inside) last = t;
      }
      if (start !== null) segs.push({ v: vr, t0: start, t1: last });
      rows.push(segs);
    }
    return rows;
  };
  const at = (u: Vec, sg: Seg, t: number): Vec => {
    const v: Vec = [-u[1], u[0]];
    return [u[0] * t + v[0] * sg.v, u[1] * t + v[1] * sg.v];
  };
  // Consecutive rows whose segments overlap form one chain (sewn as one block).
  const chains = (rows: Seg[][]): Seg[][] => {
    const open: { segs: Seg[]; lastRow: number }[] = [];
    const done: Seg[][] = [];
    rows.forEach((row, r) => {
      const used = new Set<number>();
      for (const sg of row) {
        const c = open.findIndex((ch, k) => !used.has(k) && ch.lastRow === r - 1 && Math.min(ch.segs[ch.segs.length - 1].t1, sg.t1) - Math.max(ch.segs[ch.segs.length - 1].t0, sg.t0) > 0);
        if (c >= 0) { open[c].segs.push(sg); open[c].lastRow = r; used.add(c); }
        else { open.push({ segs: [sg], lastRow: r }); used.add(open.length - 1); }
      }
      for (let k = open.length - 1; k >= 0; k--) if (open[k].lastRow < r) done.push(open.splice(k, 1)[0].segs);
    });
    return [...done, ...open.map((o) => o.segs)];
  };

  // 4: stitches per region. A group is sewn as a unit, in order (underlay before its top stitches).
  type Run = { colour: number; type: StitchType | "underlay"; detail: string; angle: number | null; pts: Vec[] }; // pts in mm
  const groups: Run[][] = [];
  let runs: Run[] = [];
  const closeGroup = () => { if (runs.length) groups.push(runs); runs = []; };
  const areaBy = new Map<number, number>();
  const typesBy = new Map<number, Set<StitchType>>();
  const angleDeg = (a: Vec) => Math.round((Math.atan2(-a[1], a[0]) * 180) / Math.PI); // pixel y is down
  // Split a chain wherever consecutive rows don't join closely (never a long stitch across a gap).
  const split = (ch: Seg[], gap: (prev: Seg, sg: Seg, k: number) => number, maxPx: number): Seg[][] => {
    const out: Seg[][] = [];
    let cur: Seg[] = [];
    for (const sg of ch) {
      if (cur.length && gap(cur[cur.length - 1], sg, cur.length - 1) > maxPx) { out.push(cur); cur = []; }
      cur.push(sg);
    }
    if (cur.length) out.push(cur);
    return out;
  };
  // serpentine: row k leaves at t1 (k even) or t0 (k odd), and the next row enters there
  const serpGap = (u: Vec) => (prev: Seg, sg: Seg, k: number) =>
    k % 2 === 0 ? dist(at(u, prev, prev.t1), at(u, sg, sg.t1)) : dist(at(u, prev, prev.t0), at(u, sg, sg.t0));
  const midGap = (u: Vec) => (prev: Seg, sg: Seg) => dist(at(u, prev, (prev.t0 + prev.t1) / 2), at(u, sg, (sg.t0 + sg.t1) / 2));

  /** Tatami rows along u (or underlay rows). */
  const fillRuns = (id: number, pix: number[], grid: Int32Array, u: Vec, spacingMm: number, lenMm: number, type: "fill" | "underlay", col: number) => {
    const maxGap = Math.max(1.6, spacingMm * 3) / s;
    for (const ch0 of chains(scan(id, pix, u, spacingMm / s, grid)))
      for (const ch of split(ch0, serpGap(u), maxGap)) {
        const pts: Vec[] = [];
        ch.forEach((sg, k) => {
          const lenPx = lenMm / s, inset = Math.min(0.25 / s, (sg.t1 - sg.t0) / 4);
          const a = sg.t0 + inset, b = sg.t1 - inset;
          // Needle points along the row: both ends and every stitch length between,
          // offset by a third each row (tatami stagger) so penetrations don't line up.
          const off = type === "fill" ? ((k % 3) / 3) * lenPx : 0;
          const tt: number[] = [a];
          for (let t = a + off + lenPx; t < b - lenPx * 0.3; t += lenPx) tt.push(t);
          tt.push(b);
          if (k % 2 === 1) tt.reverse(); // serpentine
          for (const t of tt) pts.push(mm(at(u, sg, t)));
        });
        runs.push({ colour: col, type, detail: type === "fill" ? `tatami ${P.fillSpacingMm} mm` : `tatami ${P.underlayFillSpacingMm} mm`, angle: angleDeg(u), pts });
      }
  };
  /** Satin across the column (u = across): centre-walk underlay, then the zig-zag back. */
  const satinRuns = (id: number, pix: number[], grid: Int32Array, u: Vec, col: number) => {
    const pc = P.pullCompMm / s;
    const along: Vec = [-u[1], u[0]];
    for (const ch0 of chains(scan(id, pix, u, P.satinSpacingMm / s, grid)))
      for (const ch of split(ch0, midGap(u), (P.satinSpacingMm * 4) / s)) {
        if (ch.length >= 4)
          runs.push({ colour: col, type: "underlay", detail: "satin centre walk", angle: angleDeg(along), pts: resample(ch.map((sg) => mm(at(u, sg, (sg.t0 + sg.t1) / 2))), P.runStitchMm) });
        const zz: Vec[] = [];
        for (let k = ch.length - 1; k >= 0; k--) {
          const sg = ch[k];
          const a = mm(at(u, sg, sg.t0 - pc)), b = mm(at(u, sg, sg.t1 + pc));
          zz.push(...((ch.length - 1 - k) % 2 === 0 ? [a, b] : [b, a]));
        }
        runs.push({ colour: col, type: "satin", detail: `${P.satinSpacingMm} mm spacing`, angle: angleDeg(u), pts: zz });
      }
  };
  /** Running stitch along the centre line of a very thin stroke. */
  const runningRuns = (id: number, pix: number[], grid: Int32Array, u: Vec, col: number) => {
    for (const ch0 of chains(scan(id, pix, u, P.satinSpacingMm / s, grid)))
      for (const ch of split(ch0, midGap(u), (P.satinSpacingMm * 4) / s))
        runs.push({ colour: col, type: "running", detail: `${P.runStitchMm} mm`, angle: angleDeg([-u[1], u[0]]), pts: resample(ch.map((sg) => mm(at(u, sg, (sg.t0 + sg.t1) / 2))), P.runStitchMm) });
  };

  // The chord across the stroke at every pixel: the shortest of 8 directions.
  const DIRS: Vec[] = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)] as Vec);
  const chordLen = new Float32Array(W * H);
  const chordDir = new Int8Array(W * H);
  const sector = new Int32Array(W * H).fill(-1);
  let sectorId = 0;

  for (let id = 0; id < regions.length; id++) {
    const reg = regions[id];
    if (!reg.pixels.length) continue;
    const col = reg.colour;
    areaBy.set(col, (areaBy.get(col) ?? 0) + reg.pixels.length * sx * sy);
    const mark = (t: StitchType) => { if (!typesBy.has(col)) typesBy.set(col, new Set()); typesBy.get(col)!.add(t); };

    for (const j of reg.pixels) chordLen[j] = Infinity;
    DIRS.forEach((u, k) => {
      for (const row of scan(id, reg.pixels, u, 1)) for (const sg of row) {
        const len = (sg.t1 - sg.t0 + 0.5) * s;
        for (let t = sg.t0; t <= sg.t1; t += 0.5) {
          const [x, y] = at(u, sg, t);
          const j = Math.floor(y) * W + Math.floor(x);
          if (j >= 0 && j < W * H && comp[j] === id && len < chordLen[j]) { chordLen[j] = len; chordDir[j] = k; }
        }
      }
    });
    const widths = reg.pixels.map((j) => chordLen[j]).filter(Number.isFinite).sort((a, b) => a - b);
    const w90 = widths.length ? widths[Math.floor(widths.length * 0.9)] : 0;

    if (w90 > P.satinMaxWidthMm) {
      // Wide area: tatami along the principal axis, underlay rows across it.
      let mx = 0, my = 0;
      for (const j of reg.pixels) { mx += j % W; my += (j / W) | 0; }
      mx /= reg.pixels.length; my /= reg.pixels.length;
      let cxx = 0, cyy = 0, cxy = 0;
      for (const j of reg.pixels) { const dx = (j % W) - mx, dy = ((j / W) | 0) - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; }
      const phi = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      const major: Vec = [Math.cos(phi), Math.sin(phi)], minor: Vec = [-Math.sin(phi), Math.cos(phi)];
      fillRuns(id, reg.pixels, comp, minor, P.underlayFillSpacingMm, P.underlayFillStitchMm, "underlay", col);
      fillRuns(id, reg.pixels, comp, major, P.fillSpacingMm, P.fillStitchMm, "fill", col);
      closeGroup();
      mark("fill");
      continue;
    }

    // Narrow strokes (letters, rings, lines): sectors of one stitch direction,
    // each sewn across the stroke. Smooth the direction field first (majority, circular).
    for (let pass = 0; pass < 2; pass++) {
      const next = new Map<number, number>();
      for (const j of reg.pixels) {
        const votes = new Array(8).fill(0);
        const x = j % W, y = (j / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const k = (y + dy) * W + (x + dx);
          if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && comp[k] === id) votes[chordDir[k]]++;
        }
        next.set(j, votes.indexOf(Math.max(...votes)));
      }
      next.forEach((d, j) => (chordDir[j] = d));
    }
    const sectors: { id: number; dir: number; pixels: number[]; c: Vec }[] = [];
    for (const j0 of reg.pixels) {
      if (sector[j0] >= 0) continue;
      const sid = sectorId++, dir = chordDir[j0], px: number[] = [];
      const stack = [j0];
      sector[j0] = sid;
      while (stack.length) {
        const j = stack.pop()!;
        px.push(j);
        const x = j % W, y = (j / W) | 0;
        for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1])
          if (k >= 0 && sector[k] < 0 && comp[k] === id && chordDir[k] === dir) { sector[k] = sid; stack.push(k); }
      }
      let cx = 0, cy = 0;
      for (const j of px) { cx += j % W; cy += (j / W) | 0; }
      sectors.push({ id: sid, dir, pixels: px, c: [cx / px.length, cy / px.length] });
    }
    // sew neighbouring sectors one after another
    let here: Vec = sectors[0].c;
    const order: typeof sectors = [];
    const left = [...sectors];
    while (left.length) {
      left.sort((a, b) => dist(here, a.c) - dist(here, b.c));
      const nx = left.shift()!;
      order.push(nx);
      here = nx.c;
    }
    const running = w90 <= P.runningMaxWidthMm;
    for (const sc of order) {
      if (running) runningRuns(sc.id, sc.pixels, sector, DIRS[sc.dir], col);
      else satinRuns(sc.id, sc.pixels, sector, DIRS[sc.dir], col);
    }
    closeGroup();
    mark(running ? "running" : "satin");
  }

  // 5: sewing order and travel
  const colourOrder = [...areaBy.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const stitches: Stitch[] = [];
  const blocks: StitchBlock[] = [];
  let pos: Vec = [0, 0];
  let jumps = 0, trims = 0, colourChanges = 0;
  let curBlock = -1; // the block being sewn (-1: travel, ties, jumps, trims, colour changes)
  const push = (p: Vec, cmd: Stitch["cmd"]) => stitches.push({ x: p[0], y: p[1], cmd, b: cmd === "stitch" ? curBlock : -1 });
  const moveTo = (to: Vec, sewnBefore: boolean) => {
    const d = dist(pos, to);
    if (d <= P.travelStitchMaxMm && sewnBefore) { if (d > 0.05) push(to, "stitch"); pos = to; return; }
    if (sewnBefore && d >= P.trimAtMm) {
      // tie-off, trim
      const back: Vec = [pos[0] + P.tieMm, pos[1]];
      push(back, "stitch"); push(pos, "stitch");
      push(pos, "trim"); trims++;
    }
    const n = Math.ceil(d / P.maxStitchMm);
    for (let i = 1; i <= n; i++) { push([pos[0] + ((to[0] - pos[0]) * i) / n, pos[1] + ((to[1] - pos[1]) * i) / n], "jump"); jumps++; }
    pos = to;
    // tie-in
    push([to[0] + P.tieMm, to[1]], "stitch"); push(to, "stitch");
  };
  let seq = 0, first = true;
  for (const col of colourOrder) {
    // A colour change cuts the thread: the first travel of a colour is a jump.
    if (!first) { push(pos, "color"); colourChanges++; }
    const todo = groups.filter((g) => g[0].colour === col && g.some((r) => r.pts.length));
    let sewn = false;
    while (todo.length) {
      // nearest group next; its runs keep their order (underlay first)
      todo.sort((a, b) => dist(pos, a[0].pts[0] ?? pos) - dist(pos, b[0].pts[0] ?? pos));
      for (const r of todo.shift()!) {
        if (!r.pts.length) continue;
        moveTo(r.pts[0], sewn);
        curBlock = blocks.length;
        // the block's first needle point (where the travel / tie-in ended) belongs to it
        const last = stitches[stitches.length - 1];
        if (last && last.cmd === "stitch") last.b = curBlock;
        for (let i = 1; i < r.pts.length; i++) {
          const d = dist(pos, r.pts[i]);
          const n = Math.max(1, Math.ceil(d / P.maxStitchMm));
          for (let k = 1; k <= n; k++) push([pos[0] + ((r.pts[i][0] - pos[0]) * k) / n, pos[1] + ((r.pts[i][1] - pos[1]) * k) / n], "stitch");
          pos = r.pts[i];
        }
        curBlock = -1;
        blocks.push({ seq: ++seq, colour: colourOrder.indexOf(col), type: r.type, detail: r.detail, stitches: 0, angle: r.angle });
        sewn = true;
      }
    }
    first = false;
  }
  if (stitches.length) { push([pos[0] + P.tieMm, pos[1]], "stitch"); push(pos, "stitch"); }
  push(pos, "end");

  // 6: rotation as placed (counter-clockwise as viewed)
  const a = (opt.rotationDeg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  for (const st of stitches) {
    const x = st.x * ca - st.y * sa, y = st.x * sa + st.y * ca;
    st.x = Math.round(x * 100) / 100; st.y = Math.round(y * 100) / 100;
  }

  const sewnPts = stitches.filter((st) => st.cmd === "stitch");
  const ext = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const p of sewnPts) {
    if (p.x < ext.minX) ext.minX = p.x; if (p.x > ext.maxX) ext.maxX = p.x;
    if (p.y < ext.minY) ext.minY = p.y; if (p.y > ext.maxY) ext.maxY = p.y;
  }
  if (!sewnPts.length) Object.assign(ext, { minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const stitchesPerColour = colourOrder.map(() => 0);
  let ci = 0;
  for (const st of stitches) { if (st.cmd === "color") ci++; else if (st.cmd === "stitch") stitchesPerColour[ci]++; }
  const threads: ThreadColour[] = colourOrder.map((c, k) => ({
    index: k + 1,
    hex: opt.singleThread ? opt.singleThread.hex.toUpperCase() : toHex(palette[c]),
    name: opt.singleThread ? opt.singleThread.name : paletteNames[c] ?? "Design colour",
    stitches: stitchesPerColour[k],
    areaMm2: Math.round((areaBy.get(c) ?? 0) * 10) / 10,
    types: [...(typesBy.get(c) ?? [])],
  }));
  // exact per-block counts from the stitches themselves
  for (const st of stitches) if (st.cmd === "stitch" && st.b !== undefined && st.b >= 0) blocks[st.b].stitches++;
  const typeCount: Record<StitchType | "underlay", number> = { running: 0, satin: 0, fill: 0, underlay: 0 };
  for (const b of blocks) typeCount[b.type] += b.stitches;
  if (!opaque.length) warnings.push("The artwork has no opaque pixels: nothing to stitch.");
  if (trims > 30) warnings.push(`High trim count (${trims}): stitch pathing needs review.`);
  if (sewnPts.length > 30000) warnings.push(`High stitch count (${sewnPts.length}): check density and sewing time.`);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const metadata: DigitizedMetadata = {
    designId: opt.designId,
    engine: DIGITIZER_ENGINE,
    status: DIGITIZING_STATUS,
    createdAt: opt.createdAt ?? new Date().toISOString(),
    stitchCount: sewnPts.length,
    jumps, trims, colourChanges,
    widthMm: r2(ext.maxX - ext.minX), heightMm: r2(ext.maxY - ext.minY),
    extents: { minX: r2(ext.minX), maxX: r2(ext.maxX), minY: r2(ext.minY), maxY: r2(ext.maxY) },
    designWidthMm: r2(opt.widthMm), designHeightMm: r2(opt.heightMm),
    rotationDeg: opt.rotationDeg, rotationApplied: true,
    placement: opt.placement,
    threads,
    stitchTypes: typeCount,
    density: { fillSpacingMm: P.fillSpacingMm, fillStitchMm: P.fillStitchMm, satinSpacingMm: P.satinSpacingMm, runStitchMm: P.runStitchMm, pullCompMm: P.pullCompMm, maxStitchMm: P.maxStitchMm },
    underlay: { fill: `tatami ${P.underlayFillSpacingMm} mm, perpendicular to the top fill`, satin: "centre walk" },
    blocks,
    source: { widthPx: W, heightPx: H, colourMode: opt.singleThread ? "single thread" : opt.regions?.threads.length ? "design layers" : "design colours" },
    warnings,
  };
  return { metadata, stitches };
}

/** A polyline resampled to stitches of at most `step` mm. */
function resample(pts: Vec[], step: number): Vec[] {
  if (pts.length < 2) return pts;
  const out: Vec[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = dist(a, b);
    let t = step - carry;
    while (t <= d) { out.push([a[0] + ((b[0] - a[0]) * t) / d, a[1] + ((b[1] - a[1]) * t) / d]); t += step; }
    carry = (carry + d) % step;
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > 0.3) out.push(last);
  return out;
}
