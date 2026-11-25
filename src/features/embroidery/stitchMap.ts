/**
 * EMBROIDERY DIGITIZING MAP — how the machine will sew the design, drawn only
 * from the exact `Stitch[]` the DST is written from (never from the image).
 *
 *   stitch list → thread segments (needle position → next needle position)
 *               → CELLS: the field is cut into small squares; each cell takes
 *                 the thread colour with the most stitched length inside it
 *               → the real stitch paths drawn inside the cells (fill rows,
 *                 satin traversals, running points, dashed underlay)
 *               → stitch-direction arrows on real segments, thinned to stay readable
 *               → machine moves: jumps, trims, numbered colour changes, start, end
 *
 * Segments are classed by the block they belong to (`Stitch.b` →
 * metadata.blocks[b].type). Coordinates: mm, design centre 0,0, y up
 * (SVG y = -y). Pure strings, no DOM.
 */
import type { decodeDst } from "./dst";
import type { DigitizedDesign, Stitch, StitchType } from "./types";

export type MapWindow = { x: number; y: number; w: number; h: number }; // mm, bottom-left corner, y up
export type MapSvg = { svg: string; widthMm: number; heightMm: number };

export const MAP_STYLE = {
  ground: "#FFFFFF",
  empty: "#F3F3F0",
  grid5: "#D2D2CC",
  grid10: "#A9A9A2",
  marker: "#C2185B",
  start: "#2E7D32",
  end: "#C62828",
  jump: "#C2185B",
} as const;

type Cls = StitchType | "underlay" | "travel";
type Seg = { x0: number; y0: number; x1: number; y1: number; c: number; cls: Cls };
const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// --- colour helpers: stitches drawn in a contrasting shade of their own thread
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const lum = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mix = (hex: string, to: number, t: number) => hexOf(rgb(hex).map((v) => v + (to - v) * t));
/** The thread's stitch line on its own cell colour: lighter on dark threads, darker on light ones. */
const lineOn = (hex: string) => (lum(hex) < 110 ? mix(hex, 255, 0.55) : mix(hex, 0, 0.45));

/** One colour section of the sewing sequence (between colour changes). */
export type ColourSection = {
  seq: number;
  hex: string;
  name: string;
  types: (StitchType | "underlay")[];
  stitches: number;
  blocks: number;
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
};

export function colourSections(design: DigitizedDesign): ColourSection[] {
  const m = design.metadata;
  const out: ColourSection[] = m.threads.map((t, i) => ({ seq: i + 1, hex: t.hex, name: t.name, types: [], stitches: 0, blocks: 0, start: null, end: null }));
  let c = 0;
  for (const s of design.stitches) {
    if (s.cmd === "color") { c++; continue; }
    if (s.cmd !== "stitch" || !out[c]) continue;
    out[c].stitches++;
    if (!out[c].start) out[c].start = { x: s.x, y: s.y };
    out[c].end = { x: s.x, y: s.y };
  }
  m.blocks.forEach((b) => {
    const sec = out[b.colour];
    if (!sec) return;
    sec.blocks++;
    if (!sec.types.includes(b.type)) sec.types.push(b.type);
  });
  return out;
}

/** Walk the stitches: thread segments with colour and class, jump runs, command markers. */
function walk(design: DigitizedDesign) {
  const blocks = design.metadata.blocks;
  const threads = design.metadata.threads;
  const segs: Seg[] = [];
  const jumps: { x: number; y: number }[][] = [];
  const marks: { kind: "trim" | "color" | "start" | "end"; x: number; y: number; n?: number }[] = [];
  let x = 0, y = 0, c = 0, inJump = false, started = false;
  for (const s of design.stitches as Stitch[]) {
    if (s.cmd === "stitch") {
      if (!started) { marks.push({ kind: "start", x: s.x, y: s.y }); started = true; }
      const b = s.b ?? -1;
      const cls: Cls = b >= 0 && blocks[b] ? blocks[b].type : "travel";
      if (s.x !== x || s.y !== y) segs.push({ x0: x, y0: y, x1: s.x, y1: s.y, c, cls });
      inJump = false;
    } else if (s.cmd === "jump") {
      if (!inJump) jumps.push([{ x, y }]);
      jumps[jumps.length - 1].push({ x: s.x, y: s.y });
      inJump = true;
    } else if (s.cmd === "trim") {
      marks.push({ kind: "trim", x: s.x, y: s.y });
      inJump = false;
    } else if (s.cmd === "color") {
      c++;
      marks.push({ kind: "color", x: s.x, y: s.y, n: c + 1 });
      inJump = false;
    } else if (s.cmd === "end") {
      marks.push({ kind: "end", x: s.x, y: s.y });
    }
    x = s.x; y = s.y;
  }
  return { segs, jumps, marks, hex: (i: number) => threads[i]?.hex ?? "#000000", colours: threads.length };
}
type Walk = ReturnType<typeof walk>;

/**
 * The cell grid: every thread segment is sampled along its length and its
 * length credited to the cells it crosses, per colour (top stitching) and as
 * underlay. A cell takes the colour with the most top-stitch length.
 */
function cells(w: Walk, size: number, keep: (s: Seg) => boolean = () => true) {
  const map = new Map<string, { i: number; j: number; len: number[]; under: number; top: number }>();
  for (const s of w.segs) {
    if (s.cls === "travel" || !keep(s)) continue;
    const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    const n = Math.max(1, Math.ceil(L / (size / 3)));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, px = s.x0 + (s.x1 - s.x0) * t, py = s.y0 + (s.y1 - s.y0) * t;
      const i = Math.floor(px / size), j = Math.floor(py / size), key = `${i},${j}`;
      let cell = map.get(key);
      if (!cell) { cell = { i, j, len: new Array(w.colours).fill(0), under: 0, top: 0 }; map.set(key, cell); }
      if (s.cls === "underlay") cell.under += L / n;
      else { cell.len[s.c] += L / n; cell.top += L / n; }
    }
  }
  return [...map.values()].map((c) => {
    let best = -1, bl = 0;
    c.len.forEach((l, k) => { if (l > bl) { bl = l; best = k; } });
    return { ...c, colour: best }; // -1: underlay only
  });
}

function cellLayer(w: Walk, cs: ReturnType<typeof cells>, size: number, gap: number, only?: number) {
  const byColour = new Map<string, string>();
  for (const c of cs) {
    if (only !== undefined && c.colour !== only) continue;
    const fill = c.colour >= 0 ? w.hex(c.colour) : MAP_STYLE.empty;
    const d = `M${f(c.i * size + gap / 2)} ${f(-(c.j + 1) * size + gap / 2)}h${f(size - gap)}v${f(size - gap)}h${f(gap - size)}z`;
    byColour.set(fill, (byColour.get(fill) ?? "") + d);
  }
  return [...byColour.entries()].map(([fill, d]) => `<path d="${d}" fill="${fill}" stroke="none"/>`).join("");
}

/** The real stitch paths, grouped while the needle stays down, in a shade that reads on the cell colour. */
function stitchLayer(w: Walk, keep: (s: Seg) => boolean, sw: number, only?: number) {
  type G = { c: number; under: boolean; d: string };
  const groups: G[] = [];
  let cur: G | null = null, lx = NaN, ly = NaN;
  for (const s of w.segs) {
    if (!keep(s) || (only !== undefined && s.c !== only)) { cur = null; continue; }
    const under = s.cls === "underlay";
    if (!cur || cur.c !== s.c || cur.under !== under || s.x0 !== lx || s.y0 !== ly) {
      cur = { c: s.c, under, d: `M${f(s.x0)} ${f(-s.y0)}` };
      groups.push(cur);
    }
    cur.d += `L${f(s.x1)} ${f(-s.y1)}`;
    lx = s.x1; ly = s.y1;
  }
  return groups
    .map((g) => {
      const line = lineOn(w.hex(g.c));
      return g.under
        ? `<path d="${g.d}" stroke="${line}" stroke-width="${f(sw * 0.6)}" stroke-dasharray="${f(sw * 4)} ${f(sw * 3)}" stroke-opacity="0.9"/>`
        : `<path d="${g.d}" stroke="${line}" stroke-width="${f(sw)}"/>`;
    })
    .join("");
}

/** Direction arrows on real top-stitch segments, spaced at least `spacing` mm apart. */
function arrowLayer(w: Walk, keep: (s: Seg) => boolean, spacing: number, size: number, minLen: number) {
  const placed: [number, number][] = [];
  const cellOf = new Map<string, [number, number][]>();
  const near = (x: number, y: number) => {
    const ci = Math.floor(x / spacing), cj = Math.floor(y / spacing);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++)
      for (const p of cellOf.get(`${ci + a},${cj + b}`) ?? []) if (Math.hypot(p[0] - x, p[1] - y) < spacing) return true;
    return false;
  };
  const d: string[] = [];
  for (const s of w.segs) {
    if (s.cls === "underlay" || s.cls === "travel" || !keep(s)) continue;
    const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    if (L < minLen) continue;
    const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
    if (near(mx, my)) continue;
    placed.push([mx, my]);
    const key = `${Math.floor(mx / spacing)},${Math.floor(my / spacing)}`;
    cellOf.set(key, [...(cellOf.get(key) ?? []), [mx, my]]);
    const ux = (s.x1 - s.x0) / L, uy = (s.y1 - s.y0) / L, a = size, h = size * 0.55;
    const tip = [mx + ux * a, my + uy * a], b1 = [mx - ux * a * 0.4 - uy * h, my - uy * a * 0.4 + ux * h], b2 = [mx - ux * a * 0.4 + uy * h, my - uy * a * 0.4 - ux * h];
    d.push(`M${f(tip[0])} ${f(-tip[1])}L${f(b1[0])} ${f(-b1[1])}L${f(b2[0])} ${f(-b2[1])}Z`);
  }
  return `<path d="${d.join("")}" fill="#000" stroke="#fff" stroke-width="${f(size * 0.18)}" paint-order="stroke"/>`;
}

function grid(x0: number, y0: number, x1: number, y1: number, levels: readonly (readonly [number, string, number])[]) {
  return levels
    .map(([step, col, sw]) => {
      let d = "";
      for (let gx = Math.ceil(x0 / step) * step; gx <= x1 + 1e-6; gx += step) d += `M${f(gx)} ${f(-y1)}V${f(-y0)}`;
      for (let gy = Math.ceil(y0 / step) * step; gy <= y1 + 1e-6; gy += step) d += `M${f(x0)} ${f(-gy)}H${f(x1)}`;
      return `<path d="${d}" stroke="${col}" stroke-width="${sw}" fill="none"/>`;
    })
    .join("");
}

function markerLayer(w: Walk, r: number, inWin: (x: number, y: number) => boolean) {
  const out: string[] = [];
  for (const m of w.marks) {
    if (!inWin(m.x, m.y)) continue;
    const cx = f(m.x), cy = f(-m.y);
    if (m.kind === "start") out.push(`<circle cx="${cx}" cy="${cy}" r="${f(r * 1.2)}" fill="${MAP_STYLE.start}" stroke="#fff" stroke-width="${f(r * 0.3)}"/>`);
    else if (m.kind === "end") out.push(`<circle cx="${cx}" cy="${cy}" r="${f(r * 1.2)}" fill="${MAP_STYLE.end}" stroke="#fff" stroke-width="${f(r * 0.3)}"/>`);
    else if (m.kind === "color")
      out.push(`<rect x="${f(m.x - r * 1.5)}" y="${f(-m.y - r * 1.5)}" width="${f(3 * r)}" height="${f(3 * r)}" fill="#000" stroke="#fff" stroke-width="${f(r * 0.25)}"/><text x="${cx}" y="${f(-m.y + r * 0.62)}" font-size="${f(r * 1.8)}" font-weight="700" text-anchor="middle" fill="#fff">${String(m.n).padStart(2, "0")}</text>`);
    else if (m.kind === "trim") out.push(`<text x="${cx}" y="${f(-m.y + r * 0.55)}" font-size="${f(r * 1.7)}" text-anchor="middle" fill="${MAP_STYLE.marker}" paint-order="stroke" stroke="#fff" stroke-width="${f(r * 0.35)}">&#9986;</text>`); // ✂
  }
  return out.join("");
}

const jumpLayer = (w: Walk, sw: number) =>
  w.jumps.map((j) => `<polyline points="${j.map((p) => `${f(p.x)},${f(-p.y)}`).join(" ")}" fill="none" stroke="${MAP_STYLE.jump}" stroke-width="${f(sw)}" stroke-dasharray="${f(sw * 9)} ${f(sw * 6)}"/>`).join("");

/** Cell size for a design: about 70 cells across the longest side, 1–2 mm. */
export const mapCellMm = (design: DigitizedDesign) => {
  const m = design.metadata;
  return Math.max(m.widthMm, m.heightMm) > 100 ? 2 : Math.max(m.widthMm, m.heightMm) > 50 ? 1.5 : 1;
};

/**
 * The main digitizing map (1 unit = 1 mm): stitch cells in their thread
 * colours, the real stitch paths inside them, direction arrows, jumps,
 * trims, colour changes, start / end, colour-area labels, mm rulers and the
 * WIDTH / HEIGHT of the stitch field. Optional frame for the detail window.
 */
export function digitizingMapSvg(design: DigitizedDesign, { detail = null as MapWindow | null, margin = 9 } = {}): MapSvg {
  const m = design.metadata, e = m.extents;
  const w = walk(design);
  const size = mapCellMm(design);
  const cs = cells(w, size);
  const gx0 = Math.floor(e.minX / 10) * 10, gx1 = Math.ceil(e.maxX / 10) * 10;
  const gy0 = Math.floor(e.minY / 10) * 10, gy1 = Math.ceil(e.maxY / 10) * 10;
  const vx = gx0 - margin, vy = -(gy1 + margin), vw = gx1 - gx0 + 2 * margin, vh = gy1 - gy0 + 2 * margin;
  const fs = 2.2;
  const labels: string[] = [];
  for (let gx = gx0; gx <= gx1; gx += 10) labels.push(`<text x="${f(gx)}" y="${f(-gy1 - 1.2)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="#666">${Math.round(gx - gx0)}</text>`);
  for (let gy = gy0; gy <= gy1; gy += 10) labels.push(`<text x="${f(gx0 - 1.2)}" y="${f(-gy + 0.6)}" font-size="${f(fs * 0.8)}" text-anchor="end" fill="#666">${Math.round(gy1 - gy)}</text>`);

  // Colour-area labels: stacked in the top-left corner of the grid, each with a
  // leader to a solidly interior cell of its colour (most same-colour neighbours).
  const tags: string[] = [];
  const typesOf = colourSections(design);
  const byKey = new Map(cs.map((c) => [`${c.i},${c.j}`, c.colour]));
  let row = 0;
  for (let k = 0; k < w.colours; k++) {
    const mine = cs.filter((c) => c.colour === k);
    if (!mine.length) continue;
    const interior = (c: { i: number; j: number }) => {
      let n = 0;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (byKey.get(`${c.i + a},${c.j + b}`) === k) n++;
      return n;
    };
    const cx = mine.reduce((a, c) => a + c.i, 0) / mine.length, cy = mine.reduce((a, c) => a + c.j, 0) / mine.length;
    const at = mine.reduce((a, c) => {
      const da = interior(a), dc = interior(c);
      return dc > da || (dc === da && Math.hypot(c.i - cx, c.j - cy) < Math.hypot(a.i - cx, a.j - cy)) ? c : a;
    });
    const ax = (at.i + 0.5) * size, ay = (at.j + 0.5) * size;
    const t = `${String(k + 1).padStart(2, "0")} ${w.hex(k)} · ${typesOf[k].types.filter((x) => x !== "underlay").map((x) => (x === "fill" ? "TATAMI FILL" : x.toUpperCase())).join(" + ")}`;
    const tw = t.length * fs * 0.55 + fs * 2;
    const lx = gx0 + 1, ly = gy1 - 1.5 - row * fs * 1.9; // label box top-left (y up)
    row++;
    tags.push(
      `<line x1="${f(lx + tw)}" y1="${f(-(ly - fs * 0.7))}" x2="${f(ax)}" y2="${f(-ay)}" stroke="#000" stroke-width="0.14"/>` +
      `<circle cx="${f(ax)}" cy="${f(-ay)}" r="0.7" fill="#fff" stroke="#000" stroke-width="0.2"/>` +
      `<rect x="${f(lx)}" y="${f(-ly)}" width="${f(tw)}" height="${f(fs * 1.45)}" fill="#fff" stroke="#000" stroke-width="0.15"/>` +
      `<rect x="${f(lx + 0.5)}" y="${f(-ly + fs * 0.32)}" width="${f(fs * 0.8)}" height="${f(fs * 0.8)}" fill="${w.hex(k)}" stroke="#000" stroke-width="0.1"/>` +
      `<text x="${f(lx + fs * 1.5)}" y="${f(-ly + fs * 1.05)}" font-size="${f(fs)}" font-weight="700" fill="#000">${esc(t)}</text>`
    );
  }

  const dy = -(gy0 - 4.5), dx = gx1 + 4.5;
  const arrow = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#000" stroke-width="0.12" marker-start="url(#a)" marker-end="url(#a)"/>`;
  const dims = [
    `<line x1="${f(e.minX)}" y1="${f(-e.minY)}" x2="${f(e.minX)}" y2="${f(dy + 1)}" stroke="#000" stroke-width="0.06"/>`,
    `<line x1="${f(e.maxX)}" y1="${f(-e.minY)}" x2="${f(e.maxX)}" y2="${f(dy + 1)}" stroke="#000" stroke-width="0.06"/>`,
    arrow(e.minX, dy, e.maxX, dy),
    `<text x="${f((e.minX + e.maxX) / 2)}" y="${f(dy - 0.9)}" font-size="${fs}" font-weight="700" text-anchor="middle" fill="#000" paint-order="stroke" stroke="#fff" stroke-width="0.8">WIDTH ${m.widthMm.toFixed(1)} mm</text>`,
    `<line x1="${f(e.maxX)}" y1="${f(-e.maxY)}" x2="${f(dx + 1)}" y2="${f(-e.maxY)}" stroke="#000" stroke-width="0.06"/>`,
    `<line x1="${f(e.maxX)}" y1="${f(-e.minY)}" x2="${f(dx + 1)}" y2="${f(-e.minY)}" stroke="#000" stroke-width="0.06"/>`,
    arrow(dx, -e.maxY, dx, -e.minY),
    `<text transform="translate(${f(dx + 0.9)} ${f(-(e.minY + e.maxY) / 2)}) rotate(90)" font-size="${fs}" font-weight="700" text-anchor="middle" fill="#000" paint-order="stroke" stroke="#fff" stroke-width="0.8">HEIGHT ${m.heightMm.toFixed(1)} mm</text>`,
  ].join("");
  const frame = detail
    ? `<rect x="${f(detail.x)}" y="${f(-(detail.y + detail.h))}" width="${f(detail.w)}" height="${f(detail.h)}" fill="none" stroke="#fff" stroke-width="0.9"/><rect x="${f(detail.x)}" y="${f(-(detail.y + detail.h))}" width="${f(detail.w)}" height="${f(detail.h)}" fill="none" stroke="${MAP_STYLE.marker}" stroke-width="0.45"/><text x="${f(detail.x)}" y="${f(-(detail.y + detail.h) - 0.9)}" font-size="${fs}" font-weight="700" fill="${MAP_STYLE.marker}" paint-order="stroke" stroke="#fff" stroke-width="0.7">DETAIL A</text>`
    : "";
  const all = () => true;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" font-family="Arial, Helvetica, sans-serif" fill="none" stroke-linecap="round" stroke-linejoin="round" data-design="${esc(m.designId)}" data-stitches="${m.stitchCount}" data-cell-mm="${size}">
<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#000"/></marker></defs>
<rect x="${f(gx0)}" y="${f(-gy1)}" width="${f(gx1 - gx0)}" height="${f(gy1 - gy0)}" fill="${MAP_STYLE.ground}"/>
${grid(gx0, gy0, gx1, gy1, [[size, MAP_STYLE.empty, 0.05], [10, MAP_STYLE.grid10, 0.08]])}${labels.join("")}
<g data-layer="cells">${cellLayer(w, cs, size, size * 0.12)}</g>
<g data-layer="stitches">${stitchLayer(w, all, 0.13)}</g>
<g data-layer="jumps">${jumpLayer(w, 0.09)}</g>
<g data-layer="arrows">${arrowLayer(w, all, 7, 1.1, 1.2)}</g>
<g data-layer="markers">${markerLayer(w, 0.95, () => true)}</g>
<g data-layer="colour-areas">${tags.join("")}</g>
${frame}${dims}
</svg>`;
  return { svg, widthMm: vw, heightMm: vh };
}

/**
 * DETAIL A: the same stitches inside `win` with 0.5 mm cells, every needle
 * point, satin traversals, fill rows, underlay, direction arrows and commands.
 */
export function digitizingDetailSvg(design: DigitizedDesign, win: MapWindow, cellMm = 0.5): MapSvg {
  const w = walk(design);
  const x0 = win.x, x1 = win.x + win.w, y0 = win.y, y1 = win.y + win.h;
  const hit = (s: Seg) => Math.max(s.x0, s.x1) >= x0 && Math.min(s.x0, s.x1) <= x1 && Math.max(s.y0, s.y1) >= y0 && Math.min(s.y0, s.y1) <= y1;
  const inWin = (x: number, y: number) => x >= x0 - 0.5 && x <= x1 + 0.5 && y >= y0 - 0.5 && y <= y1 + 0.5;
  const cs = cells(w, cellMm, hit).filter((c) => (c.i + 1) * cellMm >= x0 && c.i * cellMm <= x1 && (c.j + 1) * cellMm >= y0 && c.j * cellMm <= y1);
  const dots: string[] = [];
  for (const s of w.segs) if (hit(s) && inWin(s.x1, s.y1) && s.cls !== "travel") dots.push(`M${f(s.x1)} ${f(-s.y1)}h0`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(-y1)} ${f(win.w)} ${f(win.h)}" font-family="Arial, Helvetica, sans-serif" fill="none" stroke-linecap="round" stroke-linejoin="round" data-cell-mm="${cellMm}">
<defs><clipPath id="w"><rect x="${f(x0)}" y="${f(-y1)}" width="${f(win.w)}" height="${f(win.h)}"/></clipPath></defs>
<rect x="${f(x0)}" y="${f(-y1)}" width="${f(win.w)}" height="${f(win.h)}" fill="${MAP_STYLE.ground}"/>
${grid(x0, y0, x1, y1, [[cellMm, MAP_STYLE.empty, 0.02], [5, MAP_STYLE.grid5, 0.04]])}
<g clip-path="url(#w)">
<g data-layer="cells">${cellLayer(w, cs, cellMm, cellMm * 0.1)}</g>
<g data-layer="stitches">${stitchLayer(w, hit, 0.075)}</g>
<g data-layer="jumps">${jumpLayer(w, 0.035)}</g>
<path data-layer="needle-points" d="${dots.join("")}" stroke="#000" stroke-width="0.13" stroke-linecap="round"/>
<g data-layer="arrows">${arrowLayer(w, hit, 1.6, 0.32, 0.6)}</g>
<g data-layer="markers">${markerLayer(w, 0.26, inWin)}</g>
</g>
</svg>`;
  return { svg, widthMm: win.w, heightMm: win.h };
}

/** Colour separation: one thread's cells and stitch paths alone, at the main map's cell size. */
export function colourSeparationSvg(design: DigitizedDesign, colour: number): MapSvg {
  const e = design.metadata.extents, w = walk(design), size = mapCellMm(design), pad = 2;
  const cs = cells(w, size);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(e.minX - pad)} ${f(-e.maxY - pad)} ${f(e.maxX - e.minX + 2 * pad)} ${f(e.maxY - e.minY + 2 * pad)}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect x="${f(e.minX - pad)}" y="${f(-e.maxY - pad)}" width="${f(e.maxX - e.minX + 2 * pad)}" height="${f(e.maxY - e.minY + 2 * pad)}" fill="${MAP_STYLE.ground}"/>
${grid(e.minX - pad, e.minY - pad, e.maxX + pad, e.maxY + pad, [[10, MAP_STYLE.grid5, 0.15]])}
${cellLayer(w, cs, size, size * 0.12, colour)}${stitchLayer(w, () => true, 0.25, colour)}
</svg>`;
  return { svg, widthMm: e.maxX - e.minX + 2 * pad, heightMm: e.maxY - e.minY + 2 * pad };
}

/**
 * The most informative window of `wMm × hMm`: the most kinds of stitching
 * (types, colours, underlay) and, among those, the most stitches.
 */
export function pickDetailWindow(design: DigitizedDesign, wMm: number, hMm: number): MapWindow {
  const e = design.metadata.extents;
  const w = Math.min(wMm, e.maxX - e.minX + 1), h = Math.min(hMm, e.maxY - e.minY + 1);
  const segs = walk(design).segs;
  let best: MapWindow = { x: (e.minX + e.maxX) / 2 - w / 2, y: (e.minY + e.maxY) / 2 - h / 2, w, h }, bestScore = -1;
  const step = Math.max(1, Math.min(w, h) / 3);
  for (let x = e.minX; x <= e.maxX - w + 0.01 || x === e.minX; x += step) {
    for (let y = e.minY; y <= e.maxY - h + 0.01 || y === e.minY; y += step) {
      const kinds = new Set<string>(), cols = new Set<number>();
      let n = 0;
      for (const s of segs) {
        if (s.x1 < x || s.x1 > x + w || s.y1 < y || s.y1 > y + h) continue;
        kinds.add(s.cls); cols.add(s.c); n++;
      }
      const score = kinds.size * 3 + cols.size * 2 + Math.min(1, n / 600);
      if (score > bestScore) { bestScore = score; best = { x, y, w, h }; }
      if (y > e.maxY - h) break;
    }
    if (x > e.maxX - w) break;
  }
  return best;
}

/** Checks that the DST bytes hold exactly this stitch data (positions to 0.1 mm, commands). */
export function verifyAgainstDst(design: DigitizedDesign, decoded: ReturnType<typeof decodeDst>) {
  const want = design.stitches.filter((s) => s.cmd === "stitch").map((s) => [Math.round(s.x * 10), Math.round(s.y * 10)]);
  const got = decoded.stitches.filter((s) => s.cmd === "stitch").map((s) => s.raw);
  let mismatches = Math.abs(want.length - got.length);
  for (let i = 0; i < Math.min(want.length, got.length); i++) if (want[i][0] !== got[i][0] || want[i][1] !== got[i][1]) mismatches++;
  const m = design.metadata;
  const dstColours = decoded.stitches.filter((s) => s.cmd === "color").length;
  const dstJumps = decoded.stitches.filter((s) => s.cmd === "jump").length;
  const ok = mismatches === 0 && dstColours === m.colourChanges && dstJumps === m.jumps + 3 * m.trims;
  return { ok, stitches: want.length, dstStitches: got.length, mismatches, colourChanges: m.colourChanges, dstColourChanges: dstColours, jumps: m.jumps, trims: m.trims, dstJumps };
}
