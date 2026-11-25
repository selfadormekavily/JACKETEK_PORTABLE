// Technical flats for the RFQ Tech Pack, drawn on the CANONICAL flat: the licensed
// S.i. Graphics varsity flat (front / back) and the standalone sleeves reconstructed from
// it (server/rfq/techflat/{canonical,sleeve}.mjs; working files in
// garment-spec/working-varsity-flat/, git-ignored). NOT TO SCALE.
//
// Every view = the unchanged garment base + separate overlays: colourway (CSS / body
// fill), embroidery zones, artwork. Nothing here is a measurement: each zone is the
// configurator's own zone relative to the garment (spec configuratorReference.normalised,
// from embroideryGeometry.ts normalisedZone), placed by the same landmarks on this flat —
// HPS, waistband top and width, shoulder point, cuff seam — so the drawing shows the
// website's zones.
import { compose, fitScale, loadFlat } from "./techflat/canonical.mjs";

let F = null;
/** The canonical flat (loaded once). Throws when the working flat is not installed. */
export function canonicalFlat() {
  F ??= loadFlat();
  return F;
}

const fx = (n) => (Math.round(n * 100) / 100).toString();
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const vbRegion = (vb) => ({ x0: vb[0], y0: vb[1], x1: vb[0] + vb[2], y1: vb[1] + vb[3] });

/** Fills for a coloured flat: hex per part (the drawing's own grey when unknown). */
export function fillsFor(colours) {
  return {
    body: colours.body ?? null,
    sleeves: colours.sleeves ?? null,
    rib: colours.rib ?? null,
    stripe: colours.stripe ?? null,
    welt: colours.sleeves ?? null,
    snap: colours.snap ?? null,
  };
}

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

// ---------------------------------------------------------------------------
// Zones on the flat (the configurator's zones relative to the garment)

const HPSy = (L) => (L.HPS_L[1] + L.HPS_R[1]) / 2;
const polyLen = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);
/** A spec zone's normalised placement; older specs (before it was recorded) can't be drawn. */
function normalisedOf(zone, kind) {
  const n = zone.configuratorReference?.normalised;
  if (n?.kind !== kind) throw new Error(`Zone ${zone.zoneId}: no normalised ${kind} placement in the spec — regenerate it from the stored design.`);
  return n;
}

/** The point at arc length t along a polyline (and the local direction). */
function along(pts, t) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1], pts[i]);
    if (s + L >= t) return { p: add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), (t - s) / L)), d: unit(sub(pts[i], pts[i - 1])) };
    s += L;
  }
  return { p: pts.at(-1), d: unit(sub(pts.at(-1), pts.at(-2))) };
}
/** Intersections of the line c + s·n with a closed polygon: the s values. */
function lineHits(c, n, poly) {
  const hits = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], d = sub(b, a);
    const den = n[0] * d[1] - n[1] * d[0];
    if (Math.abs(den) < 1e-9) continue;
    const s = ((a[0] - c[0]) * d[1] - (a[1] - c[1]) * d[0]) / den, u = ((a[0] - c[0]) * n[1] - (a[1] - c[1]) * n[0]) / den;
    if (u >= 0 && u <= 1) hits.push(s);
  }
  return hits.sort((x, y) => x - y);
}
/** SVG rotation (deg, clockwise in y-down) that turns the box's vertical onto direction d. */
const rotFor = (d) => (Math.atan2(-d[0], d[1]) * 180) / Math.PI;

/**
 * The point `t` along the overarm from the shoulder point, centred across the sleeve: the
 * box centre, the box rotation (the sleeve direction) and the sleeve's width there.
 */
function sleeveSpot(overarm, outline, axisDir, t, inwardX) {
  const { p } = along(overarm, t);
  let n = [-axisDir[1], axisDir[0]];
  if (n[0] * inwardX < 0) n = mul(n, -1); // across the sleeve, from the overarm inwards
  // The sleeve's other edge: the first crossing inwards from the overarm point.
  const width = lineHits(p, n, outline).filter((v) => v > 0.5)[0] ?? 0;
  return { c: add(p, mul(n, width / 2)), rot: rotFor(axisDir), width };
}

/**
 * A body zone's box on the front / back view (template coordinates): { c, w, h, rot }.
 * u across from the centre line (shares of half the waistband width), v down from HPS and
 * h (shares of HPS → waistband top), and the width from the website box's own proportions
 * (aspect = W ÷ H): the flat-laid body is wider for its length than the 3D model's front, so
 * a width share would distort the box (and the artwork fitted into it).
 */
export function zoneOnFlat(zone, view) {
  const V = canonicalFlat().views[view], L = V.landmarks;
  const n = normalisedOf(zone, "body");
  const cx = view === "back" ? (L.cbNeck?.[0] ?? (V.frame.x0 + V.frame.x1) / 2) : (V.frame.x0 + V.frame.x1) / 2;
  const half = (L.waistbandX1 - L.waistbandX0) / 2, len = L.waistbandTop - HPSy(L);
  // Front view: viewer's right = wearer's left. Back view: viewer's left = wearer's left.
  const dir = view === "back" ? -1 : 1;
  if (!(n.aspect > 0)) throw new Error(`Zone ${zone.zoneId}: no box aspect in the spec — regenerate it from the stored design.`);
  const h = n.h * len;
  return { c: [cx + dir * n.u * half, HPSy(L) + n.v * len], w: h * n.aspect, h, rot: 0 };
}

/**
 * A sleeve zone on the standalone sleeve view (wearer's right frame; the left view mirrors it):
 * s along the overarm (share of shoulder point → cuff seam), centred across the sleeve,
 * h a share of shoulder point → cuff seam, and the width from the website box's own
 * proportions (aspect = W ÷ H) — the flat-laid sleeve is much wider for its length than the
 * 3D sleeve's side face, so a width share would distort the box (and the artwork in it).
 */
export function zoneOnSleeve(zone) {
  const { views } = canonicalFlat();
  const S = views.sleeveRight.landmarks;
  const n = normalisedOf(zone, "sleeve");
  const open = mul(add(S.cuff.BL, S.cuff.BR), 0.5);
  const axis = unit(sub(open, S.SP));
  const len = polyLen(S.overarm);
  const spot = sleeveSpot(S.overarm, S.outline, axis, n.s * len, 1);
  if (!(n.aspect > 0)) throw new Error(`Zone ${zone.zoneId}: no box aspect in the spec — regenerate it from the stored design.`);
  const h = n.h * len;
  const box = { c: spot.c, w: h * n.aspect, h, rot: spot.rot };
  if (zone.side !== "leftSleeve") return box;
  return { ...box, c: views.sleeveLeft.mirrorX(box.c), rot: -box.rot };
}

const rectAt = ({ c, w, h, rot }, attrs) => `<rect x="${fx(c[0] - w / 2)}" y="${fx(c[1] - h / 2)}" width="${fx(w)}" height="${fx(h)}" transform="rotate(${fx(rot)} ${fx(c[0])} ${fx(c[1])})" ${attrs}/>`;

/** A filter that shows an artwork in one colour (text embroidery in its thread), keeping its shape. */
export function tint(art) {
  if (!art.tint) return { defs: "", attr: "" };
  const id = `tint-${art.artworkId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  return { defs: `<filter id="${id}" color-interpolation-filters="sRGB"><feFlood flood-color="${art.tint}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`, attr: ` filter="url(#${id})"` };
}

/** An image placed inside a zone box at the customer's normalised scale / offset (template coordinates, y down). */
export function artworkInZone(box, art, href) {
  const { c, w, h, rot } = box;
  // Auto-fit in the box (proportions kept), then the customer's scale and offset (shares of the box).
  const a = art.aspect;
  const [w0, h0] = a >= w / h ? [w, w / a] : [h * a, h];
  const s = art.placement.normalizedScale;
  const aw = w0 * s, ah = h0 * s;
  const cx = c[0] + art.placement.normalizedOffsetX * w, cy = c[1] - art.placement.normalizedOffsetY * h;
  const tn = tint(art);
  return `${tn.defs}<g transform="rotate(${fx(rot)} ${fx(c[0])} ${fx(c[1])})"><image href="${href}" x="${fx(cx - aw / 2)}" y="${fx(cy - ah / 2)}" width="${fx(aw)}" height="${fx(ah)}" preserveAspectRatio="xMidYMid meet"${tn.attr}/></g>`;
}

/** Zone boxes, artwork and labels as one overlay group (template coordinates). */
function zoneOverlay(entries, { artworks, hrefOf, highlight, labels, boxes, u, labelSide = () => 0, labelX = null }) {
  const out = [];
  const fs = 2.1 * u;
  /** True when a label (centred at x, baseline y) would touch or crowd another zone's box (2 mm clear above it). */
  const clashes = (self, text, x, y) => {
    const hw = (text.length * fs * 0.62) / 2;
    return entries.some(({ box: o }) => o !== self && x - hw < o.c[0] + o.w / 2 && o.c[0] - o.w / 2 < x + hw && y - fs - 2 * u < o.c[1] + o.h / 2 && o.c[1] - o.h / 2 < y + 0.3 * fs);
  };
  for (const { z, box } of entries) {
    const hot = highlight ? z.zoneId === highlight : z.used;
    if (boxes) out.push(rectAt(box, `fill="none" stroke="${hot ? "#c00" : "#7a7a7a"}" stroke-width="${hot ? 1.1 : 0.5}" stroke-dasharray="${hot ? "4 2" : "2 2"}" vector-effect="non-scaling-stroke"`));
    for (const a of artworks.filter((x) => x.zoneId === z.zoneId)) {
      const href = hrefOf(a);
      if (href) out.push(artworkInZone(box, a, href));
    }
    if (boxes && labels && (hot || !highlight)) {
      const side = labelSide(z);
      // Side labels (sleeves): outside the garment outline when the view gives that x.
      const x = side ? (labelX ?? box.c[0] + side * (box.w / 2 + 2.5 * u)) : box.c[0];
      // Body labels: above the box, or below it when another zone's box is right above.
      let y = side ? box.c[1] + 0.8 * u : box.c[1] - box.h / 2 - 1.2 * u;
      if (!side && clashes(box, z.label, x, y)) y = box.c[1] + box.h / 2 + fs + 0.6 * u;
      out.push(`<text x="${fx(x)}" y="${fx(y)}" font-size="${fx(fs)}" text-anchor="${side < 0 ? "end" : side > 0 ? "start" : "middle"}" fill="${hot ? "#c00" : "#555"}" font-weight="${hot ? "bold" : "normal"}">${z.label}</text>`);
    }
  }
  return out.length ? `<g id="zones-overlay">${out.join("")}</g>` : "";
}

/**
 * A full view (front / back) on the canonical flat: the garment (recoloured when `fills`),
 * every zone box (dashed; used zones bold and numbered) and the artwork on top.
 */
export function viewSvg(view, { wMm, hMm, fills = null, zones = [], artworks = [], hrefOf = () => null, labels = true, highlight = null, boxes = true }) {
  const V = canonicalFlat().views[view];
  const region = vbRegion(V.viewBox);
  const u = 1 / fitScale(region, wMm, hMm); // drawing units per mm on the page
  // Body zones only: sleeve zones (and their artwork) are drawn on the sleeve views, where the
  // outer sleeve is visible; on the front view the sleeve shows only a narrow side.
  const here = zones.filter((z) => z.side === view);
  const extra = zoneOverlay(here.map((z) => ({ z, box: zoneOnFlat(z, view) })), { artworks, hrefOf, highlight, labels, boxes, u });
  return compose(V, region, wMm, hMm, { fills, id: fills ? nextId(`flat-${view}-`) : null, extra }).svg;
}

/** The standalone sleeve view (wearer's left or right), with that sleeve's zones and artwork. */
export function sleeveSvg(side, { wMm, hMm, fills = null, zones = [], artworks = [], hrefOf = () => null, highlight = null, labels = true, boxes = true }) {
  const { views } = canonicalFlat();
  const V = side === "leftSleeve" ? views.sleeveLeft : views.sleeveRight;
  const region = vbRegion(V.viewBox);
  const u = 1 / fitScale(region, wMm, hMm);
  // Zone labels outside the sleeve, on the overarm side (left sleeve: viewer's right), clear of
  // the outline (the boxes span most of the sleeve's width).
  const labelSide = () => (side === "leftSleeve" ? 1 : -1);
  const outerX = Math.min(...views.sleeveRight.landmarks.outline.map((p) => p[0])) - 1.5 * u;
  const labelX = side === "leftSleeve" ? views.sleeveLeft.mirrorX([outerX, 0])[0] : outerX;
  const extra = zoneOverlay(zones.filter((z) => z.side === side).map((z) => ({ z, box: zoneOnSleeve(z) })), { artworks, hrefOf, highlight, labels, boxes, u, labelSide, labelX });
  return compose(V, region, wMm, hMm, { fills, id: fills ? nextId(`flat-${side}-`) : null, extra }).svg;
}

// ---------------------------------------------------------------------------
// Zone close-up: the zone box, the artwork at the customer's normalised
// scale / offset, and dimension lines. Labels come from the caller (values or
// "TBD …"); nothing here invents a dimension. (No garment drawing.)

/** SVG (mm on the page) of one zone with its artwork. */
export function zoneCloseupSvg(zone, art, href, { wMm, hMm, widthLabel, heightLabel, offsetLabel }) {
  const [bw, bh] = zone.configuratorReference.boxCm;
  const pad = { l: 14, r: 34, t: 10, b: 4 };
  const k = Math.min((wMm - pad.l - pad.r) / bw, (hMm - pad.t - pad.b) / bh);
  const W = bw * k, H = bh * k, x0 = pad.l, y0 = pad.t, cx = x0 + W / 2, cy = y0 + H / 2;
  const a = art.aspect;
  const [w0, h0] = a >= W / H ? [W, W / a] : [H * a, H];
  const s = art.placement.normalizedScale;
  const aw = w0 * s, ah = h0 * s;
  const ax = cx + art.placement.normalizedOffsetX * W, ay = cy - art.placement.normalizedOffsetY * H;
  const t = (x, y, str, anchor = "middle", size = 2.6, extra = "") => `<text x="${fx(x)}" y="${fx(y)}" font-size="${size}" text-anchor="${anchor}" ${extra}>${str}</text>`;
  const arrow = (x1, y1, x2, y2) => `<line x1="${fx(x1)}" y1="${fx(y1)}" x2="${fx(x2)}" y2="${fx(y2)}" stroke="#000" stroke-width="0.25" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fx(wMm)} ${fx(hMm)}" style="width:${wMm}mm;height:${hMm}mm" font-family="Arial, Helvetica, sans-serif">`,
    `<defs><marker id="ar" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z"/></marker></defs>`,
    `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(W)}" height="${fx(H)}" fill="#fafafa" stroke="#c00" stroke-width="0.4" stroke-dasharray="1.6 0.8"/>`,
    // Zone centre lines.
    `<line x1="${fx(cx)}" y1="${fx(y0)}" x2="${fx(cx)}" y2="${fx(y0 + H)}" stroke="#999" stroke-width="0.18" stroke-dasharray="1 0.6"/>`,
    `<line x1="${fx(x0)}" y1="${fx(cy)}" x2="${fx(x0 + W)}" y2="${fx(cy)}" stroke="#999" stroke-width="0.18" stroke-dasharray="1 0.6"/>`,
    href ? `${tint(art).defs}<image href="${href}" x="${fx(ax - aw / 2)}" y="${fx(ay - ah / 2)}" width="${fx(aw)}" height="${fx(ah)}" preserveAspectRatio="xMidYMid meet"${tint(art).attr}/>` : "",
    `<rect x="${fx(ax - aw / 2)}" y="${fx(ay - ah / 2)}" width="${fx(aw)}" height="${fx(ah)}" fill="none" stroke="#000" stroke-width="0.25" stroke-dasharray="0.8 0.6"/>`,
    // Width (above) and height (left).
    arrow(x0, y0 - 4, x0 + W, y0 - 4),
    t(cx, y0 - 5.6, widthLabel),
    arrow(x0 - 4, y0, x0 - 4, y0 + H),
    t(x0 - 5.6, cy, heightLabel, "middle", 2.6, `transform="rotate(-90 ${fx(x0 - 5.6)} ${fx(cy)})"`),
  ];
  // Offset from the zone centre to the artwork centre.
  if (Math.abs(ax - cx) > 0.2 || Math.abs(ay - cy) > 0.2) {
    out.push(`<line x1="${fx(cx)}" y1="${fx(cy)}" x2="${fx(ax)}" y2="${fx(ay)}" stroke="#c00" stroke-width="0.35" marker-end="url(#ar)"/>`);
  }
  out.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="0.7" fill="#c00"/>`);
  out.push(t(x0 + W + 2, cy - 2, "zone centre", "start", 2.3, 'fill="#c00"'));
  out.push(t(x0 + W + 2, cy + 1.4, offsetLabel, "start", 2.3));
  out.push("</svg>");
  return out.join("");
}
