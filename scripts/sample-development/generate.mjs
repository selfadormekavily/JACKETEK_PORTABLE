#!/usr/bin/env node
// SIZE-M DEVELOPMENT SAMPLE REQUEST — generator. Separate from the customer RFQ generator
// (server/rfq/generate.mjs, which still reads Master Spec v0.1 and is not touched).
//
//   node scripts/sample-development/generate.mjs [--replace]
//
// Reads:   garment-spec/jacketek-master-spec-v0.2.json, scripts/materials/components.mjs,
//          the website's zone geometry (src/features/configurator/model/embroideryGeometry.ts —
//          normalised placement only) and the S.i.-based canonical flat (drawings; the purchased
//          originals are never touched)
// Writes:  garment-spec/sample-development/
//            m-sample-request-MSR-01.json   the request data (same as the package's m-sample-request.json)
//            m-sample-return-form.json/.md  the empty factory return form
//          dev-output/m-sample-development/MSR-01/   (engineering-only output, outside server-data)
//            JACKETEK-M-Sample-Request-MSR-01.pdf
//            m-sample-request.json, measurement-sheet.json, factory-material-response.json,
//            construction-response.json, embroidery-calibration.json, sample-photo-checklist.json,
//            m-sample-return-form.json, source/MSR-01.html, qa.json
//            factory-release/   ONLY what is sent to the factory (rebuilt from scratch on every run):
//              the PDF, README-FACTORY.md, m-sample-return-form.json/.md, measurement-sheet.json,
//              factory-material-response.json, construction-response.json, embroidery-calibration.json,
//              sample-photo-checklist.json — no source code, S.i. files, QA output or internal paths
// The PDF is refused (nothing written) when a page overflows or a leak check fails. An existing
// MSR-01 PDF is only replaced with --replace (a sent revision is never overwritten: issue MSR-02).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { canonicalFlat, sleeveSvg, viewSvg } from "../../server/rfq/flats.mjs";
import { compose, T } from "../../server/rfq/techflat/canonical.mjs";
import { SHORT } from "../../server/rfq/techflat/pomlabels.mjs";
import { canonicalSheets } from "../../server/rfq/techflat/sheets.mjs";
import { zoneRatios } from "../../server/rfq/techflat/zoneratios.mjs";
import { MARKS, R, REVISION, TITLE, buildRequest, buildReturnForm } from "./request.mjs";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..", "..");
const V02 = "garment-spec/jacketek-master-spec-v0.2.json";
const SPEC_DIR = join(ROOT, "garment-spec", "sample-development");
const OUT = join(ROOT, "dev-output", "m-sample-development", REVISION);
const PDF = `JACKETEK-M-Sample-Request-${REVISION}.pdf`;
const BROWSER = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const CSS = readFileSync(join(ROOT, "server", "rfq", "rfq.css"), "utf8");
const TEXT_FONT = readFileSync(join(ROOT, "public", "fonts", "embroidery", "tajawal.ttf")).toString("base64");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;

// ------------------------------------------------------------- inputs
const v2Buf = readFileSync(join(ROOT, V02));
const v2 = JSON.parse(v2Buf.toString("utf8"));
async function liveZones() {
  const { build } = await import("esbuild");
  const b = await build({ entryPoints: [join(ROOT, "src/features/configurator/model/embroideryGeometry.ts")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  const G = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`);
  return G.EMBROIDERY_ZONE_LIST.map((z) => ({ id: z.id, name: z.name, side: z.side, normalised: G.normalisedZone(z) }));
}
const zones = await liveZones();
const req = buildRequest(v2, zones, { masterFile: V02, masterSha256: sha(v2Buf) });
const returnForm = buildReturnForm(req);

// ------------------------------------------------------------- rule checks (data)
const fail = (m) => { throw new Error(`MSR check failed: ${m}`); };
const targetIds = req.measurementSheet.filter((r) => r.target).map((r) => r.id);
if (JSON.stringify(targetIds) !== JSON.stringify(["B01", "B06"])) fail(`targets must be B01, B06 only (got ${targetIds})`);
for (const r of req.measurementSheet) {
  if (r.tolerance.value !== null || r.patternProposed.value !== null || r.sampleActual.value !== null) fail(`${r.id}: a value was set`);
  if (/^S0[12]|^B09/.test(r.id) && r.target) fail(`${r.id}: must have no target`);
}
if (req.designIntent.sleeves !== "Leather" || req.designIntent.body !== "Cotton Fabric") fail("design intent changed");
if (req.materials.alternativeProposals.replacesDesignIntent !== false) fail("alternatives must not replace Leather");
if (zones.length !== 10) fail("expected 10 zones");

// ------------------------------------------------------------- HTML helpers
const pages = [];
const page = (title, body) => pages.push({ title, body });
const table = (head, rows, cls = "") =>
  `<table class="grid ${cls}"><thead><tr>${head.map((h) => `<th${h.w ? ` style="width:${h.w}"` : ""}>${h.t ?? h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.join("")}</tr>`).join("")}</tbody></table>`;
const td = (html, cls = "", extra = "") => `<td${cls ? ` class="${cls}"` : ""}${extra ? ` ${extra}` : ""}>${html}</td>`;
const fill = (text) => `<span class="fillv">${esc(text)}</span>`;
const fillCell = (text) => td(`${fill(text)}<span class="wline"></span>`, "fc");
const tag = (t, c = "open") => `<span class="tag ${c}">${esc(t)}</span>`;
const ul = (items) => `<ul class="ul">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const MARK_LINE = MARKS.join(" · ");
const flat = canonicalFlat();

// POM labels on the drawings: the MSR's own values (two provisional targets, everything else TBD).
const D = {};
for (const r of req.measurementSheet) {
  if (r.id !== r.pomId) continue;
  const status = r.role === "TARGET" ? "PROV" : r.role === "MEASURE" ? "SAMPLE" : r.role === "CALCULATED" ? "DERIVED" : r.role === "COMPARISON" ? "REF" : "PATTERN";
  D[r.id] = { code: r.id, short: SHORT[r.id] ?? r.name, value: r.target ? r.targetText : "TBD", status, target: null };
}
D.B01.short = "HALF CHEST — FLAT WIDTH";
// Sleeve labels for the MSR's own sleeve drawings (the shared canonical sheets draw S01 / S02 to the
// finished cuff edge, so the MSR never uses those two sheets — see msrBackSheet / msrSleeveSheet).
const SLEEVE_LABEL = {
  S02: { code: "S02", short: "PRIMARY: SP → CUFF SEAM", value: "TBD", status: "PATTERN", target: null },
  "S02-E": { code: "S02-E", short: "SECONDARY: SP → CUFF EDGE", value: "TBD", status: "SAMPLE", target: null },
  S01: { code: "S01", short: "COMPARISON: CB → CUFF SEAM", value: "no target", status: "REF", target: null },
  "S01-E": { code: "S01-E", short: "COMPARISON: CB → CUFF EDGE", value: "no target", status: "REF", target: null },
};

const geo = (() => {
  const fr = flat.views.front, bk = flat.views.back, LF = fr.landmarks, LB = bk.landmarks;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nearestIdx = (pts, p) => pts.reduce((bi, q, i) => (dist(q, p) < dist(pts[bi], p) ? i : bi), 0);
  const xAtY = (pts, y) => {
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) return x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
    }
    return null;
  };
  const outlineArc = (L, a, b, side) => {
    const o = L.outline, i = nearestIdx(o, a), j = nearestIdx(o, b);
    const lo = Math.min(i, j), hi = Math.max(i, j);
    const inner = o.slice(lo, hi + 1), outer = [...o.slice(hi), ...o.slice(0, lo + 1)];
    const mean = (arr) => arr.reduce((s, p) => s + p[0], 0) / arr.length;
    let arc = side < 0 ? (mean(inner) < mean(outer) ? inner : outer) : mean(inner) > mean(outer) ? inner : outer;
    if (dist(arc[0], a) > dist(arc.at(-1), a)) arc = [...arc].reverse();
    return arc;
  };
  const corners = (pts) => {
    const by = (g) => pts.reduce((b, p) => (g(p) < g(b) ? p : b), pts[0]);
    return { TL: by((p) => p[0] + p[1]), TR: by((p) => -p[0] + p[1]), BR: by((p) => -p[0] - p[1]), BL: by((p) => p[0] - p[1]) };
  };
  const outlineX = (L, y, side) => {
    const xs = [];
    const o = L.outline;
    for (let i = 1; i < o.length; i++) {
      const [x1, y1] = o[i - 1], [x2, y2] = o[i];
      if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    return side < 0 ? Math.min(...xs) : Math.max(...xs);
  };
  return { fr, bk, LF, LB, dist, nearestIdx, xAtY, outlineArc, corners, outlineX };
})();
const P = (p) => T(p);
const lab = (code, short, value, status) => ({ code, short, value, status, target: null });

/** B01 / B01-A on the front; B06 / B06-T / B09 on the back. */
function keyMethodDrawings() {
  const { fr, bk, LF, LB, xAtY } = geo;
  const HPSyF = (LF.HPS_L[1] + LF.HPS_R[1]) / 2;
  const IN = (2.54 * (LF.hem - HPSyF)) / 67.65; // placement of the "1 inch below" line only — not a measurement
  const chestY = LF.UA_L[1] + IN, sl = fr.seams.left, sr = fr.seams.right;
  const f0 = fr.frame;
  const front = compose(fr, { x0: f0.x0 - 40, x1: f0.x1 + 40, y0: f0.y0 - 20, y1: f0.y1 + 16 }, 128, 118, {
    marker: "kf",
    overlay: (K) => [
      K.linear(P([xAtY(sl, chestY), chestY]), P([xAtY(sr, chestY), chestY]), lab("B01", "HALF CHEST — FLAT WIDTH", "61.0–62.2 cm", "PROV"), { labelAt: 0.5, labelNudge: [0, -K.u(7)] }),
      K.linear(P([xAtY(sl, LF.UA_L[1] + 0.3) ?? LF.UA_L[0], LF.UA_L[1] + 0.3]), P([xAtY(sr, LF.UA_R[1] + 0.3) ?? LF.UA_R[0], LF.UA_R[1] + 0.3]), lab("B01-A", "FLAT WIDTH pit to pit (alt.)", "reference only", "REF"), { labelAt: 0.5, labelNudge: [0, K.u(9)] }),
    ].join(""),
  });
  const cxB = LB.cbNeck[0], cb = LB.cbNeck, b0 = bk.frame;
  const backTop = Math.min(...LB.collarShapes.flat().filter((p) => Math.abs(p[0] - cxB) < 3).map((p) => p[1]));
  const back = compose(bk, { x0: b0.x0 - 40, x1: b0.x1 + 40, y0: b0.y0 - 62, y1: b0.y1 + 16 }, 128, 118, {
    marker: "kb",
    overlay: (K) => [
      K.linear(P(cb), P([cxB, LB.hem]), lab("B06", "CB LENGTH collar seam → edge", "67.3–68.0 cm", "PROV"), { labelAt: 0.55, labelNudge: [K.u(30), 0] }),
      K.linear(P([cxB, backTop]), P([cxB, LB.hem]), lab("B06-T", "from TOP of collar (alt.)", "reference only", "REF"), { off: K.u(14), labelAt: 0.8, labelNudge: [-K.u(30), 0] }),
      K.linear(P(LB.SP_L), P(LB.SP_R), lab("B09", "ACROSS SHOULDER seam pt → seam pt", "TBD", "PATTERN"), { off: LB.SP_L[1] - LB.collarTop + 14, labelAt: 0.5, labelNudge: [0, K.u(4.4)] }),
    ].join(""),
  });
  return { front, back };
}

const EXT_LINE = 'stroke="#0b4f8a" stroke-width="0.5" stroke-dasharray="2 1.4" vector-effect="non-scaling-stroke" fill="none"';
const pts = (a) => a.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(" ");
const shiftX = (a, d) => a.map(([x, y]) => [x - d, y]);

/**
 * The two shoulder-point sleeve paths on the standalone sleeve (wearer's right; overarm on the left):
 * S02 along the overarm to the CUFF SEAM, S02-E to the FINISHED CUFF EDGE — drawn side by side, each
 * with a dashed extension line from its end landmark, so the two end points can't be confused.
 */
function sleeveOverlays(K, S, { labelX, s02y, s02ey }) {
  const cuff = S.cuff;
  const a = shiftX(S.overarm, K.u(2.5)), b = shiftX([...S.overarm, cuff.BL], K.u(6));
  return [
    `<polyline points="${pts([cuff.TL, a.at(-1)])}" ${EXT_LINE}/>`, `<polyline points="${pts([cuff.BL, b.at(-1)])}" ${EXT_LINE}/>`,
    K.path(a.map(P), SLEEVE_LABEL.S02, { labelPos: P([labelX, s02y]), align: "end", leaderAt: 0.3 }),
    K.path(b.map(P), SLEEVE_LABEL["S02-E"], { labelPos: P([labelX, s02ey]), align: "end", leaderAt: 0.85 }),
  ].join("");
}

/** The two centre-back comparison paths on the back view (wearer's left sleeve): S01 → cuff seam, S01-E → finished cuff edge. */
function backSleeveOverlays(K, { labelX, s01y, s01ey }) {
  const { LB, outlineArc, corners } = geo;
  const cuffL = corners(LB.cuffs[0].pts), cb = LB.cbNeck;
  const shoulder = outlineArc(LB, LB.HPS_L, LB.SP_L, -1);
  const toSeam = outlineArc(LB, LB.SP_L, cuffL.TL, -1);
  const toEdge = outlineArc(LB, LB.SP_L, cuffL.BL, -1);
  const a = [cb, ...shoulder, ...shiftX(toSeam.slice(1), K.u(2.5))];
  const b = [cb, ...shoulder, ...shiftX(toEdge.slice(1), K.u(6))];
  return [
    `<polyline points="${pts([cuffL.TL, a.at(-1)])}" ${EXT_LINE}/>`, `<polyline points="${pts([cuffL.BL, b.at(-1)])}" ${EXT_LINE}/>`,
    K.path(a.map(P), SLEEVE_LABEL.S01, { labelPos: P([labelX, s01y]), align: "end", leaderAt: 0.55 }),
    K.path(b.map(P), SLEEVE_LABEL["S01-E"], { labelPos: P([labelX, s01ey]), align: "end", leaderAt: 0.9 }),
  ].join("");
}

/** S02 (primary), S02-E (secondary) on the sleeve; S01 / S01-E (comparison) on the back. */
function sleeveMethodDrawings() {
  const { bk, LB } = geo;
  const sv = flat.views.sleeveRight, S = sv.landmarks, cuff = S.cuff, vb = sv.viewBox;
  const sleeve = compose(sv, { x0: vb[0] - 125, x1: vb[0] + vb[2] + 125, y0: vb[1] - 8, y1: vb[1] + vb[3] + 10 }, 118, 128, {
    marker: "ks",
    overlay: (K) => {
      return [
        sleeveOverlays(K, S, { labelX: vb[0] - 14, s02y: S.SP[1] + 40, s02ey: cuff.BL[1] - 30 }),
        K.callout(P(cuff.TL), lab("", "CUFF SEAM (rib attached)", "end of S02 / S01", "REF"), { labelPos: P([vb[0] + vb[2] + 2, cuff.TL[1] - 40]), align: "start" }),
        K.callout(P(cuff.BL), lab("", "FINISHED CUFF EDGE", "end of S02-E / S01-E", "REF"), { labelPos: P([vb[0] + vb[2] + 2, cuff.BL[1] + 6]), align: "start" }),
        K.callout(P(S.SP), lab("SP", "SHOULDER POINT (dropped)", "start", "REF"), { labelPos: P([vb[0] + vb[2] + 2, S.SP[1] - 10]), align: "start" }),
      ].join("");
    },
  });
  const b0 = bk.frame;
  const back = compose(bk, { x0: b0.x0 - 250, x1: b0.x1 + 10, y0: b0.y0 - 20, y1: b0.y1 + 16 }, 128, 128, {
    marker: "kc",
    overlay: (K) => backSleeveOverlays(K, { labelX: b0.x0 - 14, s01y: LB.HPS_L[1] + 60, s01ey: LB.hem - 10 }),
  });
  return { sleeve, back };
}

/**
 * MSR-only POM location drawings for the back and the sleeve: the shared canonical sheets
 * (server/rfq/techflat/sheets.mjs, also used by the customer RFQ) end their S01 / S02 lines at the
 * finished cuff edge. These redraw the same POM lines with the four sleeve methods drawn separately.
 */
function msrBackSheet() {
  const { bk, LB, outlineX, nearestIdx } = geo;
  const f0 = bk.frame, sr = bk.seams.right, cb = LB.cbNeck, cxB = cb[0];
  const HPSyB = (LB.HPS_L[1] + LB.HPS_R[1]) / 2;
  const backTop = Math.min(...LB.collarShapes.flat().filter((p) => Math.abs(p[0] - cxB) < 3).map((p) => p[1]));
  const yAB = LB.SP_L[1] - 8;
  const uaIdx = nearestIdx(sr, LB.UA_R);
  const xl = f0.x0 - 8, xr = f0.x1 + 8;
  const ref = (a) => a.map(P);
  const svg = compose(bk, { x0: f0.x0 - 240, x1: f0.x1 + 128, y0: f0.y0 - 34, y1: f0.y1 + 14 }, 182, 158, {
    marker: "mb",
    overlay: (K) => [
      K.linear(P(cb), P([cxB, LB.hem]), D.B06, { labelAt: 0.45, labelNudge: [K.u(16), 0] }),
      K.linear(P(cb), P([cxB, backTop]), D.C01, { off: K.u(3), labelPos: P([xl + 70, LB.collarTop - 18]), align: "end", labelAt: 0.5 }),
      K.linear(P([LB.HPS_R[0] + 10, HPSyB]), P([LB.HPS_R[0] + 10, cb[1]]), D.C07, { labelPos: P([xr - 70, LB.collarTop - 18]), align: "start", labelAt: 0.5, refs: [ref([LB.HPS_R, [LB.HPS_R[0] + 13, HPSyB]]), ref([[cxB + 2, cb[1]], [LB.HPS_R[0] + 13, cb[1]]])] }),
      K.linear(P([LB.HPS_L[0] - 14, HPSyB]), P([LB.HPS_L[0] - 14, LB.hem]), D.B07, { labelPos: P([xl - 4, LB.hem + 2]), align: "end", labelAt: 0.75, refs: [ref([LB.HPS_L, [LB.HPS_L[0] - 17, HPSyB]])] }),
      K.linear(P(LB.SP_L), P(LB.SP_R), D.B09, { off: LB.SP_L[1] - LB.collarTop + 12, labelAt: 0.5, labelNudge: [0, K.u(4.2)] }),
      K.linear(P(LB.HPS_R), P(LB.SP_R), D.B10, { off: K.u(2.6), labelPos: P([xr, HPSyB - 8]), align: "start", labelAt: 0.5 }),
      K.linear(P([LB.SP_R[0] + 9, HPSyB]), P([LB.SP_R[0] + 9, LB.SP_R[1]]), D.B11, { labelPos: P([xr, HPSyB + 20]), align: "start", labelAt: 0.5, refs: [ref([LB.HPS_R, [LB.SP_R[0] + 12, HPSyB]])] }),
      K.linear(P([outlineX(LB, yAB, -1), yAB]), P([outlineX(LB, yAB, 1), yAB]), D.B13, { labelAt: 0.7, labelNudge: [0, -K.u(4.2)] }),
      K.along(sr.slice(0, uaIdx + 1).map(P), D.B16, { labelPos: P([xr, LB.UA_R[1] + 30]), align: "start", leaderAt: 0.6 }),
      backSleeveOverlays(K, { labelX: xl - 4, s01y: HPSyB + 40, s01ey: LB.UA_L[1] + 90 }),
    ].join(""),
  });
  return { name: "back", drawings: [svg], ids: ["B06", "B07", "B09", "B10", "B11", "B13", "B16", "C01", "C07", "S01", "S01-E"] };
}

function msrSleeveSheet() {
  const sv = flat.views.sleeveRight, S = sv.landmarks, cuff = S.cuff, vb = sv.viewBox;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const top = [(S.SP[0] + S.UA[0]) / 2, (S.SP[1] + S.UA[1]) / 2], bot = [(cuff.TL[0] + cuff.TR[0]) / 2, (cuff.TL[1] + cuff.TR[1]) / 2];
  const len = dist(top, bot), u = [(bot[0] - top[0]) / len, (bot[1] - top[1]) / len], n = [-u[1], u[0]];
  const cross = (c, poly) => {
    let best = null;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i], d = [b[0] - a[0], b[1] - a[1]];
      const den = n[0] * d[1] - n[1] * d[0];
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - c[0]) * d[1] - (a[1] - c[1]) * d[0]) / den, s2 = ((a[0] - c[0]) * n[1] - (a[1] - c[1]) * n[0]) / den;
      if (s2 >= 0 && s2 <= 1 && (!best || Math.abs(t) < Math.abs(best.t))) best = { t, p: [c[0] + n[0] * t, c[1] + n[1] * t] };
    }
    return best?.p;
  };
  const across = (frac) => { const c = [top[0] + u[0] * len * frac, top[1] + u[1] * len * frac]; return [cross(c, S.overarm), cross(c, S.underarm)]; };
  const LF = geo.LF, HPSyF = (LF.HPS_L[1] + LF.HPS_R[1]) / 2;
  const IN = (2.54 * (LF.hem - HPSyF)) / 67.65; // placement only ("1 inch below" per the POM definition)
  const uaFrac = Math.max(0, ((S.UA[0] - top[0]) * u[0] + (S.UA[1] - top[1]) * u[1]) / len);
  const [bA, bB] = across(uaFrac + IN / len);
  const [eA, eB] = across(0.5);
  const xL = vb[0] - 12, xR = vb[0] + vb[2] + 4;
  const capMid = S.cap[Math.round(S.cap.length * 0.6)];
  const svg = compose(sv, { x0: vb[0] - 150, x1: vb[0] + vb[2] + 120, y0: vb[1] - 8, y1: vb[1] + vb[3] + 14 }, 160, 160, {
    marker: "ms",
    overlay: (K) => [
      sleeveOverlays(K, S, { labelX: xL, s02y: S.SP[1] + 70, s02ey: cuff.BL[1] - 40 }),
      K.path([...S.underarm, cuff.BR].map(P), D.S03, { labelPos: P([xR, S.sideCorner[1] + 6]), align: "start", leaderAt: 0.62 }),
      K.linear(P(bA), P(bB), D.S04, { labelPos: P([xR, bB[1] - 4]), align: "start", labelAt: 0.92 }),
      K.linear(P(eA), P(eB), D.S05, { labelPos: P([xR, eB[1] + 6]), align: "start", labelAt: 0.92 }),
      K.linear(P(cuff.TL), P(cuff.TR), D.S06, { off: K.u(3), labelPos: P([xR, cuff.TR[1] - 2]), align: "start", labelAt: 0.8 }),
      K.linear(P(cuff.BL), P(cuff.BR), { ...D.S07, code: "S07/S08", short: "CUFF OPENING rel. / ext." }, { off: -K.u(3.5), labelPos: P([xR, cuff.BR[1] + 12]), align: "start", labelAt: 0.8 }),
      K.linear(P(cuff.TR), P(cuff.BR), D.S09, { off: K.u(3.5), labelPos: P([xR, cuff.BR[1] + 30]), align: "start", labelAt: 0.5 }),
      K.callout(P(capMid), { ...D.S10, value: "TBD (pattern measurement)" }, { labelPos: P([xR, S.SP[1] + 4]), align: "start" }),
    ].join(""),
  });
  return { name: "sleeve", drawings: [svg], ids: ["S02", "S02-E", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"] };
}

// ------------------------------------------------------------- test artwork (JACKETEK test geometry, no font / licensed art)
const TEST_ART = {
  "ET-A": `<svg viewBox="0 0 60 60" width="34mm" height="34mm"><path d="M14 8 H50 V18 H40 V44 Q40 54 28 54 H12 V44 H28 Q30 44 30 42 V18 H14 Z" fill="#7a1f2b" stroke="#111" stroke-width="1.2"/><path d="M14 8 H50 V18 H40 V44 Q40 54 28 54 H12 V44 H28 Q30 44 30 42 V18 H14 Z" fill="none" stroke="#f3e6c8" stroke-width="0.8" stroke-dasharray="1.6 1.2" transform="translate(0 0)"/></svg>`,
  "ET-B": `<svg viewBox="0 0 60 60" width="34mm" height="34mm"><rect x="6" y="6" width="48" height="48" fill="#1d3557" stroke="#111" stroke-width="1.2"/><circle cx="30" cy="30" r="18" fill="#f1faee" stroke="#e63946" stroke-width="3"/><circle cx="30" cy="30" r="8" fill="#e63946"/><path d="M12 30 H48 M30 12 V48" stroke="#111" stroke-width="0.4"/></svg>`,
  "ET-C": `<svg viewBox="0 0 60 60" width="34mm" height="34mm"><path d="M12 10 H22 V50 H12 Z M14 10 L8 16 V20 L12 16 Z" fill="#f3e6c8" stroke="#111" stroke-width="1.2"/><path d="M28 10 H50 V32 H38 V42 H50 V50 H28 V26 H40 V18 H28 Z" fill="#f3e6c8" stroke="#111" stroke-width="1.2"/></svg>`,
  "ET-D": `<div class="testtext">JACKETEK M SAMPLE</div>`,
};

// ------------------------------------------------------------- pages
const v2Title = esc(v2.title);
// 1 Cover
page(
  "Cover / document status",
  `<div class="cover">
    <div class="cover-left">
      <div class="brand">JACKETEK</div>
      <h1 class="msr-h1">SIZE M DEVELOPMENT<br>SAMPLE REQUEST</h1>
      <div class="banner big">${MARKS.map(esc).join("<br>")}</div>
      <table class="kv">
        <tr><th>Revision</th><td><b>${REVISION}</b> (M Sample Request) · issued ${esc(req.issued)}</td></tr>
        <tr><th>Document type</th><td>Factory-development package for the first physical size-M sample.<br><b>Not a Production Tech Pack. Not a customer RFQ.</b></td></tr>
        <tr><th>Garment</th><td>JACKETEK varsity jacket — relaxed / baggy fit, dropped shoulder, Cotton Fabric body, Leather sleeves, varsity rib, metal snaps, lined</td></tr>
        <tr><th>Size</th><td>M only (base size). No grading in this request.</td></tr>
        <tr><th>Source</th><td>${v2Title}</td></tr>
        <tr><th>Status of every value</th><td>Two provisional targets (B01, B06). Everything else: ${[R.FACTORY, R.PATTERN, R.SAMPLE, R.JACKETEK, R.TBD].map((x) => tag(x)).join(" ")}</td></tr>
        <tr><th>Approval</th><td>Nothing in this document is production approved. JACKETEK approves only after the physical M sample is checked.</td></tr>
      </table>
    </div>
    <div class="cover-right"><div class="cover-views">${viewSvg("front", { wMm: 78, hMm: 84, zones: [], boxes: false })}${viewSvg("back", { wMm: 78, hMm: 84, zones: [], boxes: false })}</div>
      <p class="note center">Technical flat: derived from the purchased S.i. Graphics varsity template. Not to scale; no value is taken from the drawing.</p><p class="lic">${esc(req.drawingLicence.pdfNote)}</p></div>
  </div>`
);

// 2 Objective
page(
  "Sample objective",
  `<div class="two">
    <div><h3>This sample validates</h3><ol class="purpose">${req.purpose.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></div>
    <div><h3>Workflow</h3><ol class="purpose">${req.workflow.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
      <div class="banner amber">The factory proposes and measures. JACKETEK approves — after the sample, separately. Production Tech Pack v1.0 comes only after approval.</div></div>
  </div>`
);

// 3 Garment overview
page(
  "Garment overview",
  `<div class="ov"><div class="ov-flats">
     <figure>${viewSvg("front", { wMm: 92, hMm: 120, zones: [], boxes: false })}<figcaption>FRONT</figcaption></figure>
     <figure>${viewSvg("back", { wMm: 92, hMm: 120, zones: [], boxes: false })}<figcaption>BACK</figcaption></figure></div>
   <div class="ov-notes"><h3>Features</h3>${ul([
     "Relaxed / baggy silhouette",
     "<b>Dropped shoulder</b> — sleeve-attachment seam below and outside the natural shoulder",
     "Body: <b>Cotton Fabric</b> · Sleeves: <b>Leather</b>",
     "Varsity knitted rib collar, cuffs and waistband; striped rib supported",
     "Metal snap front closure on a placket",
     "Two front angled welt pockets, one per front panel, topstitched outline",
     "Fully lined (body and sleeves)",
     "Embroidery zones: 4 on the cotton body, 6 on the leather sleeves",
   ])}<p class="note">Snap count, pocket position and every dimension shown by the drawing are illustrative: ${esc(R.PATTERN)}.</p></div></div>`
);

// 4 Design intent
const pol = req.designIntent.sleevePolicy;
page(
  "Design intent (JACKETEK decisions)",
  table(
    [{ t: "Item", w: "22%" }, { t: "JACKETEK design intent", w: "48%" }, { t: "Open for the factory", w: "30%" }],
    [
      ["Shoulder", "<b>DROPPED SHOULDER</b> (K1 resolved)", fill(`${R.PATTERN}: SC-1 to SC-3`)],
      ["Fit", "Relaxed / baggy", fill(`${R.PATTERN} — to the B01 / B06 provisional targets`)],
      ["Body shell", `<b>${esc(req.designIntent.body)}</b>`, fill(`${R.FACTORY}: full specification (MP-1)`)],
      ["Sleeves", `<b>${esc(req.designIntent.sleeves)}</b>`, fill(`${R.FACTORY}: leather specification (MP-2)`)],
      ["Rib", "Varsity knitted rib collar, cuffs, waistband — required; matching; stripes supported", fill(`${R.FACTORY} (MP-3)`)],
      ["Closure", "Metal snap front closure — required", fill(`${R.FACTORY} (MP-5); count / spacing: ${R.PATTERN}`)],
      ["Lining", "Required — body and sleeves; plain / quilted NOT chosen", fill(`${R.FACTORY} (MP-4)`)],
      ["Pockets", "Two front angled welt pockets, one per front panel, topstitched outline", fill(`${R.FACTORY} / ${R.PATTERN}`)],
    ].map(([a, b, c]) => [td(`<b>${a}</b>`), td(b), td(c)])
  ) +
    `<div class="policy"><b>Sleeve material policy.</b> Leather is the current JACKETEK design intent. Synthetic / PU leather may be offered only as <b>${esc(pol.alternatives)}</b>, with its cost, MOQ, performance and appearance differences. It never replaces Leather silently; a change needs explicit JACKETEK approval.</div>
     <p class="note">Materials and construction status: K2 = ${esc(req.designIntent.k2)} — design intent fixed, every specification open.</p>`
);

// 5 Technical flats — sleeves and rib
{
  const leftSvg = compose(flat.views.sleeveLeft, { x0: flat.views.sleeveLeft.viewBox[0], y0: flat.views.sleeveLeft.viewBox[1], x1: flat.views.sleeveLeft.viewBox[0] + flat.views.sleeveLeft.viewBox[2], y1: flat.views.sleeveLeft.viewBox[1] + flat.views.sleeveLeft.viewBox[3] }, 70, 120).svg;
  const rightSvg = compose(flat.views.sleeveRight, { x0: flat.views.sleeveRight.viewBox[0], y0: flat.views.sleeveRight.viewBox[1], x1: flat.views.sleeveRight.viewBox[0] + flat.views.sleeveRight.viewBox[2], y1: flat.views.sleeveRight.viewBox[1] + flat.views.sleeveRight.viewBox[3] }, 70, 120).svg;
  page(
    "Technical flats — sleeves",
    `<div class="ov"><div class="ov-flats"><figure>${leftSvg}<figcaption>LEFT SLEEVE (as worn)</figcaption></figure><figure>${rightSvg}<figcaption>RIGHT SLEEVE (as worn)</figcaption></figure></div>
     <div class="ov-notes"><h3>Notes</h3>${ul([
       "Sleeves: <b>Leather</b> (design intent).",
       "Complete sleeve flats reconstructed from the purchased front flat: visual geometry only, <b>not a pattern</b>, not to scale.",
       "The sleeve cap is drawn for a dropped shoulder; cap height and armhole: " + fill(R.PATTERN) + " (SC-3).",
       "Cuff: varsity rib, attached at the cuff seam. Rib specification: " + fill(R.FACTORY) + ".",
       "Sleeve seams (underarm, any back-sleeve seam): " + fill(R.PATTERN) + ".",
     ])}</div></div>`
  );
}

// 6 Size M target summary
page(
  "Size M — current targets",
  `<p class="lead">Only defensible current targets are shown. No external reference value is a JACKETEK target and none is printed here.</p>` +
    table(
      [{ t: "POM", w: "8%" }, { t: "Measurement", w: "30%" }, { t: "Size M", w: "18%" }, { t: "Status", w: "44%" }],
      [
        ...req.targets.map((t) => [td(`<b class="mono">${t.id}</b>`), td(esc(t.quantity)), td(`<b class="big">${t.min.toFixed(1)}–${t.max.toFixed(1)} ${t.unit}</b>`), td(`${tag("PROVISIONAL TARGET", "prov")} ${tag("LOW CONFIDENCE", "prov")} ${tag("NOT PRODUCTION APPROVED", "open")}`)]),
        [td('<b class="mono">B09</b>'), td("Across shoulder (dropped shoulder: seam point to seam point)"), td(fill("TBD — PATTERN MAKER")), td("No target. Follows from the shoulder point the pattern maker sets (SC-1).")],
        [td('<b class="mono">S02</b>'), td("Sleeve — shoulder point → cuff seam (primary)"), td(fill("TBD — PATTERN MAKER / MEASURE ON SAMPLE")), td("No target. Set by the pattern maker on the fit model; measured on the sample.")],
      ]
    ) +
    `<h3>Rules</h3>${ul([
      "B01 = <b>Half Chest — Flat Width</b>: measured straight across, garment flat, 2.54 cm below the armhole point. Report the flat width only.", "<b>Derived circumference = Flat Width × 2</b> — calculated by JACKETEK; it is not a separately measured POM. (Master Spec v0.1 keeps its historical name \"Chest circumference\".)",
      "B06 starts at the <b>collar seam</b> at centre back and ends at the finished bottom edge of the waistband rib.",
      "Every other POM: " + fill(R.PATTERN) + " or " + fill(R.SAMPLE) + ". Tolerances: " + fill(R.TBD) + " (set by JACKETEK at sample approval).",
      "Build the sample to the pattern maker's best judgement of the relaxed fit within these targets; report any deviation.",
    ])}`
);

// 7 POM measurement sheet
page(
  "POM measurement sheet — size M",
  `<p class="lead small">Factory fills <b>Pattern Proposed</b> and <b>Sample Actual</b> (cm, 0.1). JACKETEK fills <b>Variance</b> and <b>Status</b>. Tolerance: TBD for every POM. Rows marked -A / -C / -T / -E are alternative or comparison methods: measure them too, never report them under another id.</p>` +
    table(
      [{ t: "POM", w: "5%" }, { t: "Measurement", w: "12.5%" }, { t: "How to measure", w: "32%" }, { t: "Target / reference", w: "9.5%" }, { t: "Tol.", w: "3.5%" }, { t: "Pattern proposed", w: "8.5%" }, { t: "Sample actual", w: "8.5%" }, { t: "Variance", w: "6.5%" }, { t: "Status", w: "8%" }, { t: "Comments", w: "6%" }],
      req.measurementSheet.map((r) => [
        td(`<b class="mono">${esc(r.id)}</b>`),
        td(`${esc(r.name)}${r.derived ? `<br><span class="xs muted">${esc(r.derived.name)} = ${esc(r.derived.formula)} — not measured</span>` : ""}`),
        td(`<span class="xs">${esc(r.howToMeasure)}${r.note ? ` <b>${esc(r.note)}</b>` : ""}</span>`),
        td(r.target ? `<b>${esc(r.targetText)}</b><br><span class="xs prov">PROVISIONAL · LOW CONF.</span>` : `<span class="xs">${esc(r.targetText)}</span>`),
        td(fill("TBD")),
        td(`<span class="fillv xs">${esc(r.patternProposed.fill)}</span>`),
        td(`<span class="fillv xs">${esc(r.sampleActual.fill)}</span>`),
        td('<span class="xs muted">JACKETEK — after sample</span>'),
        td('<span class="xs muted">JACKETEK TO APPROVE AFTER SAMPLE</span>'),
        td(""),
      ]),
      "dense sheet split"
    )
);

// 8 Key methods
{
  const k = keyMethodDrawings();
  page(
    "Measurement methods — B01, B06, B09",
    `<div class="meth"><figure>${k.front.svg}<figcaption>B01 HALF CHEST — FLAT WIDTH (circumference = × 2, derived) — front, garment flat</figcaption></figure><figure>${k.back.svg}<figcaption>B06 CENTRE-BACK LENGTH · B09 ACROSS SHOULDER — back facing up</figcaption></figure>
     <div class="meth-t">${["B01", "B01-A", "B06", "B06-T", "B09", "B09-C"].map((id) => { const r = req.measurementSheet.find((x) => x.id === id); return `<p><b class="mono">${id}</b> ${esc(r.howToMeasure)}</p>`; }).join("")}
     <p class="note">All: finished garment, laid flat on a table, smoothed without stretching, snaps closed, never measured worn. cm, 0.1. Drawing not to scale; lines show where, not how long.</p></div></div>`
  );
  const s = sleeveMethodDrawings();
  page(
    "Measurement methods — sleeve (three methods, never interchanged)",
    `<div class="meth"><figure>${s.sleeve.svg}<figcaption>S02 PRIMARY and S02-E SECONDARY — sleeve laid straight</figcaption></figure><figure>${s.back.svg}<figcaption>S01 COMPARISON ONLY — from centre back</figcaption></figure>
     <div class="meth-t">${table([{ t: "Rank", w: "22%" }, { t: "Method", w: "78%" }], [
       [td("<b>PRIMARY</b><br>S02"), td("Shoulder point → <b>cuff seam</b>, along the overarm. " + esc(req.measurementSheet.find((x) => x.id === "S02").howToMeasure))],
       [td("<b>SECONDARY</b><br>S02-E"), td("Shoulder point → <b>finished cuff edge</b>. " + esc(req.measurementSheet.find((x) => x.id === "S02-E").howToMeasure))],
       [td("<b>COMPARISON ONLY</b><br>S01 / S01-E"), td("Centre back → cuff seam (and → finished cuff edge). " + esc(req.measurementSheet.find((x) => x.id === "S01").howToMeasure))],
     ], "dense")}
     <div class="banner amber">Never interchange the three. Report each under its own id. No sleeve target: S02 is ${esc(R.PATTERN)} / ${esc(R.SAMPLE)}.</div></div></div>`
  );
}

// 9 POM location diagrams (canonical flat, MSR labels)
{
  const POM_PAGE = { "05-front-pom": "front body", "05b-front-detail-pom": "front: neck, collar, opening, snaps, pockets", back: "back", sleeve: "sleeve", "08-rib-detail": "rib: collar, cuff, waistband" };
  // Shared sheets only where no sleeve-length line is drawn (front, rib); the MSR's own back and sleeve drawings.
  const shared = canonicalSheets(flat, D);
  const own = { back: msrBackSheet(), sleeve: msrSleeveSheet() };
  for (const sh of Object.keys(POM_PAGE).map((nm) => own[nm] ?? shared.find((x) => x.name === nm))) {
    if (!(sh.name in own) && sh.ids.some((id) => id === "S01" || id === "S02")) throw new Error(`${sh.name}: a shared sheet with a sleeve-length line`);
    const rows = sh.ids.map((id) => req.measurementSheet.find((r) => r.id === id)).filter(Boolean).map((r) => [td(`<b class="mono">${esc(r.id)}</b>`), td(esc(r.name)), td(r.target ? `<b>${esc(r.targetText)}</b>` : `<span class="xs">${esc(r.targetText)}</span>`)]);
    const multi = sh.drawings.length > 1;
    page(
      `POM locations — ${POM_PAGE[sh.name]}`,
      `<div class="pom-page${multi ? " multi" : ""}"><div class="pom-draw">${sh.drawings.map((d) => `<figure>${d.svg}${d.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : ""}</figure>`).join("")}</div>
        <div class="pom-table">${table([{ t: "POM", w: "13%" }, { t: "Measurement", w: "55%" }, { t: "Target", w: "32%" }], rows, "dense pomd")}
        <p class="note">Blue lines show <b>where</b> each POM is measured; the method is in the measurement sheet. ${sh.name === "back" ? "S01 (→ cuff seam) and S01-E (→ finished cuff edge) are comparison only; a dashed line marks each end landmark. " : ""}${sh.name === "sleeve" ? "S02 (primary, → cuff seam) and S02-E (secondary, → finished cuff edge) are drawn separately; a dashed line marks each end landmark. " : ""}Not to scale; no value is taken from the drawing.</p></div></div>`
    );
  }
}

// 10 Dropped shoulder
const ds = req.droppedShoulder;
page(
  "Dropped-shoulder development requirements",
  `<div class="banner big2">SHOULDER CONSTRUCTION: ${esc(ds.construction)}</div>
   <p class="lead"><b>Shoulder point (SP).</b> ${esc(ds.shoulderPoint)}</p>` +
    table(
      [{ t: "ID", w: "7%" }, { t: "Parameter", w: "25%" }, { t: "Definition", w: "34%" }, { t: "Value", w: "18%" }, { t: "When", w: "16%" }],
      ds.parameters.map((p) => [td(`<b class="mono">${p.id}</b>`), td(`<b>${esc(p.name)}</b>`), td(esc(p.definition)), fillCell(p.fill), td(`<span class="xs">${esc(p.when)}</span>`)])
    ) +
    `<h3>Rules</h3>${ul(ds.rules.map(esc))}`
);

// 11–15 Material proposals
const fieldTable = (fields) =>
  table([{ t: "#", w: "5%" }, { t: "Specification", w: "33%" }, { t: "Factory response", w: "37%" }, { t: "Comments / options", w: "25%" }], fields.map((x, i) => [td(String(i + 1)), td(esc(x.label)), fillCell(x.fill), td("")]), "dense split");
const M = req.materials;
const sec = (id) => M.sections.find((s) => s.id === id);
for (const s of [sec("MP-1")]) {
  page(
    `${s.id} Body fabric proposal — ${s.designIntent}`,
    `<p class="lead">Design intent: <b>${esc(s.designIntent)}</b>. ${esc(M.rule)}</p>${fieldTable(s.fields)}<p class="note">Swatch required (with colour standard). Template example values (e.g. from the S.i. Graphics template) are not JACKETEK specifications.</p>`
  );
}
{
  const s = sec("MP-2");
  page(
    `${s.id} Leather sleeve proposal`,
    `<div class="policy"><b>Leather remains the current JACKETEK design intent.</b> PU / synthetic leather may appear only as <b>${esc(M.alternativeProposals.label)}</b>. Do not substitute it silently.</div>${fieldTable(s.fields)}
     <h3>Alternative proposals (optional)</h3>` +
      table(
        [{ t: "Label (fixed)", w: "26%" }, { t: "Material / identification", w: "18%" }, { t: "Cost difference", w: "14%" }, { t: "MOQ difference", w: "14%" }, { t: "Performance difference", w: "14%" }, { t: "Appearance difference", w: "14%" }],
        [[td(`<b class="xs">${esc(M.alternativeProposals.label)}</b>`), ...Array.from({ length: 5 }, () => fillCell(`${R.FACTORY} (optional)`))]]
      ) +
      `<p class="note">An alternative is a proposal only. It is never used for the sample unless JACKETEK approves the change of design intent in writing.</p>`
  );
}
{
  const s = sec("MP-3");
  page(
    `${s.id} Rib proposal — collar, cuffs, waistband`,
    `<p class="lead">Design intent: ${esc(s.designIntent)}. Send rib swatches (with stripes) or photos for each part.</p>` +
      table(
        [{ t: "#", w: "5%" }, { t: "Specification", w: "26%" }, ...s.parts.map((p) => ({ t: p.toUpperCase(), w: "23%" }))],
        s.fields.map((x, i) => [td(String(i + 1)), td(esc(x.label)), ...s.parts.map(() => fillCell(x.fill))])
      ) +
      `<p class="note">Rib dimensions (R01, S09, C01, C02, R05) and rib cut lengths (R02–R04): ${esc(R.PATTERN)}; measured on the sample.</p>`
  );
}
for (const id of ["MP-4", "MP-5"]) {
  const s = sec(id);
  page(
    `${s.id} ${id === "MP-4" ? "Lining proposal" : "Hardware / snaps proposal"}`,
    `<p class="lead">Design intent: <b>${esc(s.designIntent.replace(/\.$/, ""))}</b>.${id === "MP-4" ? " Do not choose plain or quilted for JACKETEK: propose, and JACKETEK decides after the sample." : " Snap count and spacing are pattern-maker / sample decisions. Send snap samples in the proposed finishes."}</p>${fieldTable(s.fields)}`
  );
}

// 16 Pockets
{
  const pk = req.construction.pockets;
  page(
    "Pocket construction",
    `<p class="lead">Current visual intent: ${pk.visualIntent.map(esc).join(" · ")}. Everything else is open — do not take it from the drawing.</p>${fieldTable(pk.fields)}
     <p class="note">Pocket POMs P01–P07: see the measurement sheet. Inside pocket: L04 only if fitted.</p>`
  );
}
// 17 Sewing
{
  const sw = req.construction.sewing;
  page("Sewing / assembly proposal", `<p class="lead">${esc(sw.rule)}</p>${fieldTable(sw.fields)}`);
}

// 18 Embroidery development
{
  const E = req.embroidery;
  page(
    "Embroidery development",
    `<p class="lead">This sample also validates embroidery feasibility. Evaluate on the sample (or on offcuts of the same materials) and report with photos.</p>` +
      table(
        [{ t: "Evaluate", w: "30%" }, { t: "Cotton Fabric body", w: "35%" }, { t: "Leather sleeves", w: "35%" }],
        E.evaluate.map((e) => [td(`<b>${esc(e)}</b>`), fillCell(R.FACTORY), fillCell(R.FACTORY)])
      ) +
      `<p class="note">Normalised zones are not converted to cm in this document: see the zone map (reference for placement) and the calibration page.</p>`
  );
  page(
    "Embroidery sample tests",
    `<p class="lead">Representative tests for manufacturing validation — not a customer order. Test artwork is JACKETEK test geometry or plain text; no licensed or copyrighted artwork is used.</p>
     <div class="tests">${E.tests.map((t) => `<div class="test"><div class="test-art">${TEST_ART[t.id]}</div><div class="test-body"><h4>${t.id} · ${esc(t.location)} <span class="muted">(${esc(t.substrate)})</span></h4><p>${esc(t.test)}</p><p class="xs muted">${esc(t.artwork)}</p>
       ${table([{ t: "Item", w: "40%" }, { t: "Response", w: "60%" }], [["Size (finished W × H)", t.size.fill], ["Method", t.method.fill], ["Thread / colours", t.threadAndColours.fill], ["Backing / stabilizer", t.backingStabilizer.fill], ["Stitch density", t.stitchDensity.fill], ["Edge finish", t.edgeFinish.fill], ["Result (photos)", t.result.fill]].map(([a, b]) => [td(`<span class="xs">${a}</span>`), td(`<span class="fillv xs">${esc(b)}</span>`)]), "tiny")}</div></div>`).join("")}</div>`
  );
  // Zone map
  const z = E.zoneSchedule;
  const zoneObjs = zones.map((x) => ({ zoneId: x.id, side: x.side, label: x.name.replace(" Sleeve — ", " · "), used: false, configuratorReference: { normalised: x.normalised } }));
  page(
    "Embroidery zones — normalised map",
    `<div class="banner amber">${esc(z.label)}</div>
     <div class="zmap"><figure>${viewSvg("front", { wMm: 74, hMm: 84, zones: zoneObjs })}<figcaption>FRONT</figcaption></figure><figure>${viewSvg("back", { wMm: 74, hMm: 84, zones: zoneObjs })}<figcaption>BACK</figcaption></figure><figure>${sleeveSvg("leftSleeve", { wMm: 50, hMm: 84, zones: zoneObjs, labels: false })}<figcaption>LEFT SLEEVE<br><span class="xs">Upper · Middle · Lower (top → cuff)</span></figcaption></figure><figure>${sleeveSvg("rightSleeve", { wMm: 50, hMm: 84, zones: zoneObjs, labels: false })}<figcaption>RIGHT SLEEVE<br><span class="xs">Upper · Middle · Lower (top → cuff)</span></figcaption></figure></div>` +
      table(
        [{ t: "Zone", w: "17%" }, { t: "Substrate", w: "12%" }, { t: "Normalised centre", w: "17%" }, { t: "Height share", w: "9%" }, { t: "Placement in garment landmarks", w: "33%" }, { t: "Physical cm", w: "12%" }],
        z.zones.map((q) => {
          const ratios = zoneRatios({ side: q.side, configuratorReference: { normalised: q.normalised } });
          return [td(`<b>${esc(q.name)}</b>`), td(`<span class="xs">${esc(q.substrate)}</span>`), td(`<span class="mono xs">${esc(ratios.centre)} · ${esc(ratios.width)}</span>`), td(`<span class="mono xs">h ${esc(ratios.height)}</span>`), td(`<span class="xs">${ratios.landmarks.map(esc).join("; ")}</span>`), td(`<span class="fillv xs">${esc(q.physicalFill)}</span>`)];
        }),
        "dense split"
      ) +
      `<p class="note">${esc(z.rule)} Body: u = centre from the CF / CB line ÷ half body width at the waistband; v and h = shares of HPS → waistband top. Sleeve: s and h = shares of shoulder point → cuff seam. W:H = the box's proportions.</p>`
  );
  page(
    "Embroidery zone calibration — to complete from M sample",
    `<p class="lead">K3 is open: the zones are normalised, not physical. Measure these landmarks on the finished M sample so JACKETEK can convert normalised placement → physical cm. <b>${esc(E.calibration.conversion)}</b></p>` +
      table(
        [{ t: "ID", w: "6%" }, { t: "Area", w: "13%" }, { t: "Landmark", w: "19%" }, { t: "How", w: "36%" }, { t: "Related POM", w: "9%" }, { t: "Value", w: "17%" }],
        E.calibration.measurements.map((c) => [td(`<b class="mono">${c.id}</b>`), td(esc(c.group)), td(esc(c.landmark)), td(`<span class="xs">${esc(c.measure)}</span>`), td(`<span class="mono xs">${c.poms.join(", ") || "—"}</span>`), fillCell(c.fill)]),
        "dense split"
      )
  );
}

// 19 Photos
page(
  "Sample photography checklist",
  `<p class="lead">Finished M sample, daylight-balanced light, plain background, garment laid flat unless stated. Include a ruler / scale in measurement-detail photos where practical. File name = photo id (e.g. PH-05.jpg).</p>` +
    table(
      [{ t: "ID", w: "8%" }, { t: "View", w: "48%" }, { t: "Scale", w: "22%" }, { t: "Provided", w: "10%" }, { t: "File", w: "12%" }],
      req.photos.map((p) => [td(`<b class="mono">${p.id}</b>`), td(`<b>${esc(p.view)}</b>`), td(`<span class="xs">${esc(p.rulerText)}</span>`), td('<span class="box"></span>'), td('<span class="xs fillv">FACTORY</span>')])
    )
);
// 20 Return checklist
page(
  "Factory return checklist",
  `<p class="lead">Return all of the following with the sample. Structured form: <span class="mono">m-sample-return-form.json</span> (human-readable: <span class="mono">m-sample-return-form.md</span>).</p>` +
    table([{ t: "#", w: "5%" }, { t: "Item", w: "80%" }, { t: "Sent", w: "15%" }], req.returnChecklist.map((x, i) => [td(String(i + 1)), td(esc(x)), td('<span class="box"></span>')])) +
    `<p class="note">The form has no approval field. JACKETEK's review (variance, approve / reject / correct) is separate.</p>`
);
// 21 Open decisions
page(
  "Open decisions / TBD list",
  table(
    [{ t: "ID", w: "6%" }, { t: "Decision", w: "44%" }, { t: "Owner", w: "17%" }, { t: "Status", w: "17%" }, { t: "When", w: "16%" }],
    req.openDecisions.map((d) => [td(`<b class="mono">${d.id}</b>`), td(esc(d.item)), td(esc(d.owner)), td(`<span class="fillv xs">${esc(d.status)}</span>`), td(d.blocksSample ? `<b class="red">${esc(d.when)}</b>` : esc(d.when))]),
    "dense"
  ) +
    `<p class="note">Open decisions are not specifications and nothing in this list is approved. Open product / construction alignment items: ${req.alignmentItems.map((x) => `${x.id} ${esc(x.topic)}`).join(" · ")}.</p>
     <h3>Resolved</h3>${table([{ t: "ID", w: "6%" }, { t: "Decision", w: "61%" }, { t: "Status", w: "33%" }], req.resolvedDecisions.map((d) => [td(`<b class="mono">${d.id}</b>`), td(`${esc(d.decision)}<br><span class="xs">${d.restrictions.map(esc).join(" ")}</span>`), td(`<b>${esc(d.status)}</b> (${esc(d.resolved)})<br><span class="xs">${esc(d.record)}</span>`)]), "dense")}`
);
// 22 Sign-off
page(
  "Revision / sign-off workflow",
  table([{ t: "Revision", w: "12%" }, { t: "Date", w: "12%" }, { t: "Status", w: "36%" }, { t: "Note", w: "40%" }], req.signOff.revisions.map((r) => [td(`<b>${r.revision}</b>`), td(r.date), td(esc(r.status)), td(esc(r.note))])) +
    `<div class="two"><div><h3>Factory — receipt only</h3>${table([{ t: "Field", w: "45%" }, { t: "Entry", w: "55%" }], req.signOff.factoryReceipt.map((x) => [td(esc(x)), td('<span class="wline tall"></span>')]))}</div>
     <div><h3>JACKETEK — after the sample</h3>${table([{ t: "Field", w: "45%" }, { t: "Entry", w: "55%" }], req.signOff.jacketekAfterSample.map((x) => [td(esc(x)), td('<span class="wline tall"></span>')]))}</div></div>
     <p class="note">${esc(req.signOff.note)} Variance statuses used by JACKETEK: ${req.varianceStatuses.join(" · ")} — none of them is an approval. Path: ${REVISION} → sample → review → (MSR-02 if corrections) → Master Spec revision → Production Tech Pack v1.0.</p>`
);

// ------------------------------------------------------------- assemble
const EXTRA_CSS = `
.ph { grid-template-columns: 1fr auto 1fr; }
.ph-r.status { font-size: 6.4pt; text-align: center; line-height: 1.25; }
.msr-h1 { font-size: 24pt; line-height: 1.1; }
.banner.big { font-size: 12pt; line-height: 1.5; }
.banner.big2 { font-size: 13pt; padding: 2mm 4mm; margin-bottom: 3mm; }
.cover { grid-template-columns: 1fr 166mm; }
.cover-views svg { width: 78mm; height: 84mm; }
.center { text-align: center; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
ol.purpose { margin: 0; padding-left: 6mm; } ol.purpose li { margin-bottom: 1mm; }
.ul { margin: 0; padding-left: 4.5mm; } .ul li { margin-bottom: 1mm; }
.ov { display: grid; grid-template-columns: 196mm 1fr; gap: 6mm; } .ov-flats { display: flex; gap: 4mm; justify-content: center; }
.fillv { color: #6b4600; background: #fff4d6; font-weight: bold; padding: 0 0.8mm; font-size: 7pt; }
.wline { display: block; border-bottom: 0.25mm dotted #999; height: 3.4mm; } .wline.tall { height: 6mm; }
td.fc { background: #fffdf6; }
.xs { font-size: 6.5pt; line-height: 1.22; }
table.sheet td { padding: 0.5mm 0.9mm; font-size: 6.8pt; } table.sheet th { font-size: 6.2pt; padding: 0.6mm 0.9mm; }
table.tiny td { padding: 0.3mm 1mm; } table.tiny { margin-top: 1mm; }
.big { font-size: 11pt; } .red { color: #b00020; }
.policy { border: 0.4mm solid #6b2fa0; background: #f6effc; padding: 2mm 3mm; margin: 3mm 0; }
.meth { display: grid; grid-template-columns: 128mm 128mm; grid-template-rows: auto auto; gap: 2mm 6mm; }
.meth figure svg { width: 128mm; height: 118mm; } .meth-t { grid-column: 1 / span 2; font-size: 7.4pt; } .meth-t p { margin: 0 0 0.8mm; }
.tests { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; } .test { display: grid; grid-template-columns: 36mm 1fr; gap: 3mm; border: 0.25mm solid #bbb; padding: 2mm; }
.test h4 { margin: 0 0 1mm; } .test p { margin: 0 0 0.8mm; font-size: 7.4pt; }
.test-art { display: flex; align-items: center; justify-content: center; background: #f3f0ea; }
.testtext { font-family: "JK Text", Arial, sans-serif; font-weight: bold; font-size: 9pt; letter-spacing: 0.06em; color: #1d3557; text-align: center; padding: 2mm; }
.zmap { display: flex; gap: 4mm; justify-content: center; align-items: flex-end; margin: 2mm 0; }
.lic { font-size: 6.8pt; color: #333; border-top: 0.25mm solid #bbb; padding-top: 1.2mm; margin: 2mm 0 0; text-align: center; }
.box { display: inline-block; width: 4mm; height: 4mm; border: 0.3mm solid #333; }
`;
const PAGINATE = `document.fonts.ready.then(() => {
  const SAFE = 6;
  const used = (m) => { const top = m.getBoundingClientRect().top + parseFloat(getComputedStyle(m).paddingTop); let b = top; for (const c of m.children) b = Math.max(b, c.getBoundingClientRect().bottom); return b - top; };
  const over = (m) => used(m) + parseFloat(getComputedStyle(m).paddingTop) > m.clientHeight - SAFE;
  const pages = [...document.querySelectorAll("section.page")];
  for (let i = 0; i < pages.length; i++) {
    const sec = pages[i], main = sec.querySelector("main.pb");
    if (!over(main)) continue;
    const t = [...main.querySelectorAll("table.split")].pop();
    if (!t || t.tBodies[0].rows.length < 2) continue;
    const next = sec.cloneNode(true), nm = next.querySelector("main.pb");
    const h2 = nm.querySelector("h2");
    nm.innerHTML = "";
    if (h2) { h2.textContent = h2.textContent.replace(/ \\(continued\\)$/, "") + " (continued)"; nm.appendChild(h2); }
    const c = next.querySelector(".ph-c");
    if (c) c.textContent = c.textContent.replace(/ \\(continued\\)$/, "") + " (continued)";
    const t2 = t.cloneNode(false);
    t2.appendChild(t.tHead.cloneNode(true));
    const tb = document.createElement("tbody");
    t2.appendChild(tb);
    nm.appendChild(t2);
    const tail = [];
    for (let n = t.nextSibling; n; n = n.nextSibling) tail.push(n);
    tail.forEach((n) => nm.appendChild(n));
    while (over(main) && t.tBodies[0].rows.length > 1) tb.insertBefore(t.tBodies[0].rows[t.tBodies[0].rows.length - 1], tb.firstChild);
    if (!tb.rows.length) t2.remove();
    sec.after(next);
    pages.splice(i + 1, 0, next);
  }
  const all = [...document.querySelectorAll("section.page")];
  all.forEach((p, i) => { const n = p.querySelector(".pno"); if (n) n.textContent = "Page " + (i + 1) + " of " + all.length; });
  const bad = [];
  all.forEach((p, i) => { const m = p.querySelector("main.pb"); if (m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1) bad.push(i + 1); });
  document.body.setAttribute("data-pages", String(all.length));
  document.body.setAttribute("data-overflow", bad.join(","));
  document.body.setAttribute("data-ready", "1");
});`;

const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE} ${REVISION} — ${MARK_LINE}</title>
<style>@font-face{font-family:"JK Text";src:url(data:font/ttf;base64,${TEXT_FONT}) format("truetype")}${CSS}${EXTRA_CSS}</style></head><body>`;
const body = pages
  .map(
    (p, i) => `<section class="page">
  <header class="ph"><div class="ph-l"><b>JACKETEK</b> · M SAMPLE REQUEST · <b>${REVISION}</b></div><div class="ph-c">${esc(p.title)}</div><div class="ph-r status">${MARKS[0]} · ${MARKS[1]}<br>${MARKS[2]}</div></header>
  <main class="pb">${i === 0 ? "" : `<h2>${esc(p.title)}</h2>`}${p.body}</main>
  <footer class="pf"><div>${MARK_LINE}</div><div>Not a Production Tech Pack · not a customer RFQ · ${REVISION} · issued ${req.issued}</div><div class="pno">Page ${i + 1} of ${pages.length}</div></footer>
</section>`
  )
  .join("\n");
const html = `${head}${body}<script>${PAGINATE}</script></body></html>`;

// ------------------------------------------------------------- leak checks (rendered text)
const text = html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<script>[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const LEAKS = [
  [/\b(60|70|62|50|51)(\.0)?\s*cm\b/, "legacy / supplied-chart value"],
  [/\b(49\.5|49\.53|90\.17|124\.46|124\.5|122\.0|19\.5|19½|35½|26½|20½|9¾|30\.7)\b/, "external reference / S.i. example value"],
  [/\b(28|49|21|7)"/, "S.i. example inch value"],
  [/\b(14\.3|8\.4\s*×\s*11\.2|10\s*×\s*10)\b/, "configurator cm estimate"],
  [/100% wool|350 ?GSM|2X1 Cotton Rib|melton/i, "template / reference material text"],
  [/PRODUCTION_APPROVED|APPROVED_PRODUCTION/, "production-approved status"],
];
const leaks = LEAKS.filter(([re]) => re.test(text)).map(([re, what]) => `${what}: ${text.match(re)[0]}`);
const approvedHits = [...text.matchAll(/production approved/gi)].filter((m) => !/not\s*$|nothing in this document is\s*$/i.test(text.slice(Math.max(0, m.index - 40), m.index)));
if (approvedHits.length) leaks.push(`"production approved" without NOT: ${approvedHits.length}`);
if (leaks.length) fail(`leak check: ${leaks.join("; ")}`);

// ------------------------------------------------------------- write
const replace = process.argv.includes("--replace");
if (existsSync(join(OUT, PDF)) && !replace) fail(`${REVISION} already exists (${join(OUT, PDF)}). Use --replace while it is an unsent draft; otherwise issue a new revision.`);
const tmp = mkdtempSync(join(tmpdir(), "msr-"));
const htmlFile = join(tmp, `${REVISION}.html`);
writeFileSync(htmlFile, html);
const common = ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000", `--user-data-dir=${join(tmp, "profile")}`];
const { stdout } = await run(BROWSER, [...common, "--dump-dom", pathToFileURL(htmlFile).href], { maxBuffer: 256 * 1024 * 1024 });
if (!/data-ready="1"/.test(stdout)) fail("layout check did not complete");
const overflow = /data-overflow="([^"]*)"/.exec(stdout)?.[1] ?? "";
const pageCount = Number(/data-pages="(\d+)"/.exec(stdout)?.[1] ?? 0);
if (overflow) {
  writeFileSync(join(tmp, "dom.html"), stdout);
  fail(`content does not fit on page(s) ${overflow} (DOM kept in ${tmp})`);
}
mkdirSync(join(OUT, "source"), { recursive: true });
await run(BROWSER, [...common, `--print-to-pdf=${join(OUT, PDF)}`, pathToFileURL(htmlFile).href]);
if (!existsSync(join(OUT, PDF))) fail("the browser did not write the PDF");
writeFileSync(join(OUT, "source", `${REVISION}.html`), html);
rmSync(tmp, { recursive: true, force: true });

mkdirSync(SPEC_DIR, { recursive: true });
writeFileSync(join(SPEC_DIR, `m-sample-request-${REVISION}.json`), json(req));
writeFileSync(join(SPEC_DIR, "m-sample-return-form.json"), json(returnForm));
writeFileSync(join(SPEC_DIR, "m-sample-return-form.md"), returnFormMd(req));
const pkg = {
  "m-sample-request.json": req,
  "measurement-sheet.json": { request: REVISION, size: "M", columns: ["POM ID", "Measurement Name", "How to Measure", "Target / Reference", "Tolerance", "Pattern Proposed", "Sample Actual", "Variance", "Status", "Comments"], targets: req.targets, rows: req.measurementSheet, droppedShoulder: req.droppedShoulder },
  "factory-material-response.json": { request: REVISION, designIntent: { body: req.designIntent.body, sleeves: req.designIntent.sleeves, sleevePolicy: req.designIntent.sleevePolicy }, ...req.materials },
  "construction-response.json": { request: REVISION, ...req.construction },
  "embroidery-calibration.json": { request: REVISION, ...req.embroidery },
  "sample-photo-checklist.json": { request: REVISION, photos: req.photos },
  "m-sample-return-form.json": returnForm,
};
for (const [name, data] of Object.entries(pkg)) writeFileSync(join(OUT, name), json(data));
writeFileSync(join(OUT, "qa.json"), json({ revision: REVISION, pdf: PDF, pages: pageCount, overflow: "none", leakChecks: LEAKS.map(([, w]) => w), leaks: [], targets: targetIds, masterSpec: V02, masterSpecSha256: sha(v2Buf) }));
// ------------------------------------------------------------- factory release (outbound folder)
const RELEASE = join(OUT, "factory-release");
const RELEASE_FILES = ["measurement-sheet.json", "factory-material-response.json", "construction-response.json", "embroidery-calibration.json", "sample-photo-checklist.json", "m-sample-return-form.json"];
rmSync(RELEASE, { recursive: true, force: true });
mkdirSync(RELEASE, { recursive: true });
copyFileSync(join(OUT, PDF), join(RELEASE, PDF));
for (const name of RELEASE_FILES) copyFileSync(join(OUT, name), join(RELEASE, name));
writeFileSync(join(RELEASE, "m-sample-return-form.md"), returnFormMd(req));
writeFileSync(join(RELEASE, "README-FACTORY.md"), factoryReadme(req));
{
  const expected = [PDF, "README-FACTORY.md", "m-sample-return-form.md", ...RELEASE_FILES].sort();
  const present = readdirSync(RELEASE).sort();
  if (JSON.stringify(present) !== JSON.stringify(expected)) fail(`factory-release holds unexpected files: ${present.join(", ")}`);
  // Nothing internal: no project paths, source code, checksums, S.i. source formats or approval wording.
  const BANNED = [/garment-spec\//, /scripts\//, /server-data/, /\.mjs\b/, /sha256/i, /\.(ai|eps|svg)\b/i, /si-graphics-varsity-techpack|working-varsity-flat/, /PRODUCTION_APPROVED/];
  for (const name of present.filter((n) => !n.endsWith(".pdf"))) {
    const t = readFileSync(join(RELEASE, name), "utf8");
    for (const re of BANNED) if (re.test(t)) fail(`factory-release/${name}: internal content (${re})`);
  }
}
console.log(`${REVISION}: ${pageCount} pages → ${join(OUT, PDF)}; factory release → ${RELEASE}`);

// ------------------------------------------------------------- factory README
function factoryReadme(q) {
  const t = (id) => q.targets.find((x) => x.id === id);
  return `${[
    `# JACKETEK — Size M Development Sample Request (${q.revision})`,
    "",
    `**${MARK_LINE}.**`,
    "",
    "This package asks you to develop and make **one physical size-M development sample** of the JACKETEK varsity jacket, propose the missing material and construction specifications, and measure the finished sample. It is not a production order and not a bulk-production specification.",
    "",
    "## Files",
    "",
    "| File | Use |",
    "|---|---|",
    `| \`${PDF}\` | The request: design intent, targets, measuring methods, proposals required, embroidery tests, photo checklist |`,
    "| `m-sample-return-form.md` / `.json` | Fill in and return with the sample (same fields; use either) |",
    "| `measurement-sheet.json` | Every POM with its measuring method, target / reference and the fields you fill |",
    "| `factory-material-response.json` | Material specifications to propose (body, leather, rib, lining, snaps) |",
    "| `construction-response.json` | Pocket and sewing / assembly proposals |",
    "| `embroidery-calibration.json` | Embroidery tests and the landmark measurements for zone calibration |",
    "| `sample-photo-checklist.json` | Required photos of the finished sample |",
    "",
    "## What to do",
    "",
    "1. Review every field marked **TBD**, **FACTORY TO PROPOSE**, **PATTERN MAKER TO SET** or **MEASURE ON SAMPLE**.",
    "2. Propose the missing material and construction specifications; set the pattern-dependent dimensions (incl. SC-1 to SC-3, dropped shoulder).",
    "3. Make the size-M sample and measure it by the methods in the PDF (garment flat, cm, 0.1).",
    "4. Return the sample with the completed measurement sheet, material / construction information, embroidery test results and photos.",
    "",
    "## Rules",
    "",
    `- Current targets (size M): B01 Half Chest — Flat Width ${t("B01").min.toFixed(1)}–${t("B01").max.toFixed(1)} cm and B06 Centre-Back Length ${t("B06").min.toFixed(1)}–${t("B06").max.toFixed(1)} cm — both PROVISIONAL, LOW confidence. Across shoulder (B09) and sleeve (S02) have no target. Tolerances: TBD.`,
    "- Sleeve: report S02 (shoulder point → cuff seam), S02-E (→ finished cuff edge), S01 and S01-E (centre back, comparison only) separately. Never interchange them.",
    "- Sleeves are **Leather**. Do **not** substitute PU / synthetic leather without explicit written JACKETEK approval. Any alternative may only be offered as an ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT, with its cost, MOQ, performance and appearance differences.",
    "- No measurement, material or construction in this package is production approved unless JACKETEK explicitly states it in writing. JACKETEK approves only after checking the physical sample.",
    "- Embroidery zones are a reference for placement, not physical sizes.",
    "- Report any deviation from the request on the return form.",
    "",
    q.drawingLicence.pdfNote,
  ].join("\n")}\n`;
}

// ------------------------------------------------------------- return form (human-readable)
function returnFormMd(q) {
  const L = [];
  const blank = "________";
  L.push(`# JACKETEK — M sample return form (${q.revision})`, "");
  L.push(`**${MARK_LINE}.** Filled by the factory and returned with the size-M sample. Structured version: \`m-sample-return-form.json\` (same fields).`, "");
  L.push("This form has **no approval field**. JACKETEK reviews the sample separately (variance, approve / reject / correct).", "");
  L.push("## 1. Factory and sample", "", "| Field | Entry |", "|---|---|");
  for (const k of ["Factory name", "Contact", "Sample date", "Sample id", "Pattern revision", "Measured by", "Measurement date"]) L.push(`| ${k} | ${blank} |`);
  L.push("", "## 2. Material codes", "", "| Material | Supplier / code |", "|---|---|");
  for (const k of Object.keys(returnForm.materialCodes)) L.push(`| ${k} | ${blank} |`);
  L.push("", "## 3. Dropped shoulder (pattern maker)", "", "| ID | Parameter | Value (cm) | Comment |", "|---|---|---|---|");
  for (const p of q.droppedShoulder.parameters) L.push(`| ${p.id} | ${p.name} | ${blank} | |`);
  L.push("", "## 4. Measurements (cm, 0.1)", "", "Method for every row: the MSR measurement sheet. Alternative / comparison rows (-A, -C, -T, -E, S01) are reported under their own id.", "", "| ID | Measurement | Pattern proposed | Sample actual | Photo | Comment |", "|---|---|---|---|---|---|");
  for (const r of q.measurementSheet) L.push(`| ${r.id} | ${r.name}${r.derived ? ` — report the flat width only (circumference = ${r.derived.formula}: derived by JACKETEK, not a separately measured POM)` : ""} | ${blank} | ${blank} | | |`);
  L.push("", "## 5. Supplier specifications", "");
  for (const s of q.materials.sections) {
    L.push(`### ${s.id} ${s.title}`, "");
    if (s.parts) {
      L.push(`| Specification | ${s.parts.join(" | ")} |`, `|---|${s.parts.map(() => "---").join("|")}|`);
      for (const x of s.fields) L.push(`| ${x.label} | ${s.parts.map(() => blank).join(" | ")} |`);
    } else {
      L.push("| Specification | Value |", "|---|---|");
      for (const x of s.fields) L.push(`| ${x.label} | ${blank} |`);
    }
    L.push("", "Swatch sent: ☐", "");
  }
  L.push(`### Alternative proposals (optional) — ${q.materials.alternativeProposals.label}`, "", "| Material / identification | Cost difference | MOQ difference | Performance difference | Appearance difference |", "|---|---|---|---|---|", `| ${blank} | ${blank} | ${blank} | ${blank} | ${blank} |`, "");
  L.push("## 6. Construction proposals", "", "### Pockets", "", "| Item | Proposal |", "|---|---|");
  for (const x of q.construction.pockets.fields) L.push(`| ${x.label} | ${blank} |`);
  L.push("", "### Sewing / assembly", "", "| Item | Proposal |", "|---|---|");
  for (const x of q.construction.sewing.fields) L.push(`| ${x.label} | ${blank} |`);
  L.push("", "## 7. Embroidery tests", "", "| Test | Method | Finished W × H (cm) | Thread / colours | Backing | Density | Edge | Puckering | Leather damage | Lining protection |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const t of q.embroidery.tests) L.push(`| ${t.id} ${t.location} | ${blank} | ${blank} | ${blank} | ${blank} | ${blank} | ${blank} | ${blank} | ${blank} | ${blank} |`);
  L.push("", "## 8. Embroidery zone calibration (from the M sample)", "", "| ID | Landmark | Values | Photo |", "|---|---|---|---|");
  for (const c of q.embroidery.calibration.measurements) L.push(`| ${c.id} | ${c.landmark} | ${blank} | |`);
  L.push("", "## 9. Photos", "", "| ID | View | File |", "|---|---|---|");
  for (const p of q.photos) L.push(`| ${p.id} | ${p.view} | ${blank} |`);
  L.push("", "## 10. Deviations, comments, recommended corrections", "", "- Deviations from the request: ", "- Comments: ", "- Factory-recommended corrections: ", "");
  return `${L.join("\n")}\n`;
}
