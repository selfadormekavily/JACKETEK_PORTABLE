// CANONICAL GARMENT FLAT — the licensed S.i. Graphics varsity flat (imported into
// garment-spec/working-varsity-flat/ by scripts/techflat/import-si-varsity.mjs) as the
// one garment drawing every page uses. Overlays never change it:
//
//   garment (base, unchanged) + colourway overlay + POM overlay + artwork overlay = page
//
// Coordinates: the template's own (points, y down). The dimension kit works y up,
// so overlay geometry is passed through T() (x, −y).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dimKit, labelCollisions } from "./dims.mjs";
import { buildSleeve } from "./sleeve.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const FLAT_DIR = join(ROOT, "garment-spec", "working-varsity-flat");

const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const f = (n) => (Math.round(n * 100) / 100).toString();
export const T = ([x, y]) => [x, -y];

/** The canonical flat: base SVG markup per view, its frame and landmarks. */
export function loadFlat(dir = FLAT_DIR) {
  if (!existsSync(join(dir, "flat.json"))) throw new Error(`Canonical flat not imported: run node scripts/techflat/import-si-varsity.mjs (${dir})`);
  const meta = JSON.parse(readFileSync(join(dir, "flat.json"), "utf8"));
  const views = {};
  for (const v of ["front", "back"]) views[v] = { ...meta.views[v], base: inner(readFileSync(join(dir, `${v}.svg`), "utf8")) };
  // Standalone sleeves (reconstructed from the front flat — see sleeve.mjs). Visual geometry only.
  const S = buildSleeve(dir);
  views.sleeveRight = { base: S.right, viewBox: S.viewBox, landmarks: S.landmarks, segments: S.segments };
  views.sleeveLeft = { base: S.left, viewBox: S.viewBox, mirrorOf: "sleeveRight", mirrorX: S.mirrorX };
  return { meta, views };
}

/**
 * Colourway overlay: repaints the garment's own shapes (no geometry change).
 * fills: { body, sleeves, rib, stripe, snap, welt } (hex; missing = keep the drawing's grey).
 * Body vs sleeves uses the template's body–sleeve seam (bodyClip).
 */
export function colourCss(fills, scope) {
  const r = [];
  const s = (sel, prop, v) => v && r.push(`${scope} ${sel} { ${prop}: ${v} !important; }`);
  s("#layer-silhouette > *", "fill", fills.sleeves);
  s("#layer-collar > *, #layer-waistband > *, #layer-waistband-tab > *, #layer-cuffs > *", "fill", fills.rib);
  s("#layer-collar-stripes > *, #layer-waistband-stripes > *, #layer-cuff-stripes > *", "fill", fills.stripe);
  s("#layer-snaps > *", "fill", fills.snap);
  s("#layer-pockets > *", "fill", fills.welt);
  return r.join("\n");
}

/** The body region repainted on top of the silhouette (contrast sleeves), from the template's seams. */
export function bodyFillSvg(view, fill, id) {
  if (!fill) return "";
  const sil = /<g id="layer-silhouette"[^>]*>([\s\S]*?)<\/g>/.exec(view.base)?.[1] ?? "";
  const pts = view.bodyClip.map((p) => p.join(",")).join(" ");
  return `<defs><clipPath id="${id}"><polygon points="${pts}"/></clipPath></defs><g clip-path="url(#${id})" style="fill:${fill}">${sil.replace(/fill="[^"]*"/g, "").replace(/style="[^"]*"/g, "")}</g>`;
}

/** mm per drawing unit when `region` is fitted into wMm × hMm (as compose() does). */
export const fitScale = (region, wMm, hMm) => Math.min(wMm / (region.x1 - region.x0), hMm / (region.y1 - region.y0));

/**
 * The garment base, optionally recoloured: colourway CSS scoped to `id`, and the body region
 * repainted right above the silhouette (below every seam, rib and trim) when the body colour
 * differs from the sleeves. The drawing's geometry is never changed.
 */
function garment(view, { fills, id }) {
  if (!fills) return view.base;
  const body = view.bodyClip && fills.body ? bodyFillSvg(view, fills.body, `${id}-body`) : "";
  const base = body ? view.base.replace(/(<g id="layer-silhouette"[^>]*>[\s\S]*?<\/g>)/, `$1${body}`) : view.base;
  return `<style>${colourCss(fills, `#${id}`)}</style>${base}`;
}

/**
 * Composes a drawing: the base garment, then overlays, in an <svg> sized wMm × hMm.
 * `region` (template coordinates) is fitted; `overlay(K)` returns overlay markup (y-up via T);
 * `extra` is raw markup in template coordinates (zones, artwork) drawn between the two.
 * `fills` recolours the garment (colourway overlay) — needs a document-unique `id`.
 * Returns { svg, overlay, collisions, k }.
 */
export function compose(view, region, wMm, hMm, { overlay = null, marker = "m", extra = "", baseTransform = "", fills = null, id = null } = {}) {
  const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
  const k = Math.min(wMm / rw, hMm / rh);
  const vw = wMm / k, vh = hMm / k;
  const vx = (region.x0 + region.x1) / 2 - vw / 2, vy = (region.y0 + region.y1) / 2 - vh / 2;
  const K = dimKit(k, marker);
  const over = overlay ? overlay(K) : "";
  // The dimension kit draws y-up (it negates y): flip it back onto the template's y-down page.
  const overlayG = over ? `<g id="pom-overlay" transform="scale(1,1)">${K.defs}${over}</g>` : "";
  const open = (vb, sid) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${sid ? ` id="${sid}"` : ""} viewBox="${vb}" width="${wMm}mm" height="${hMm}mm" font-family="Arial, Helvetica, sans-serif">`;
  const vb = `${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}`;
  if (fills && !id) throw new Error("compose: a colourway needs a document-unique id");
  const svg = `${open(vb, id)}<g id="garment"${baseTransform ? ` transform="${baseTransform}"` : ""}>${garment(view, { fills, id })}</g>${extra}${overlayG}</svg>`;
  const overlayOnly = `${open(vb)}${overlayG}</svg>`;
  return { svg, overlay: overlayOnly, collisions: labelCollisions(K.labels), k };
}
