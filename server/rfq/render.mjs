// Manufacturing Spec (JSON) → RFQ Tech Pack HTML (A4 landscape), printed to
// PDF by server/rfq/generate.mjs. Reads ONLY the spec and the artwork files
// the spec names; never configurator state.
//
// Unknown values print as "TBD — …" with their status; nothing prints as 0
// or a dash. Every page carries the RFQ status in its header and footer.
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalFlat, fillsFor, sleeveSvg, viewSvg, zoneCloseupSvg } from "./flats.mjs";
import { pomDisplayFromSpec, targetsFromSpec } from "./techflat/pomlabels.mjs";
import { CALIBRATION, zoneRatios } from "./techflat/zoneratios.mjs";
import { canonicalSheets } from "./techflat/sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const CSS = readFileSync(join(HERE, "rfq.css"), "utf8");
const TEXT_FONT = readFileSync(join(ROOT, "public", "fonts", "embroidery", "tajawal.ttf")).toString("base64");
const BANNER = "RFQ — NOT FOR BULK PRODUCTION";
const FLAT_NOTE = "Garment flat: S.i. Graphics varsity technical flat (licensed) — dropped shoulder as drawn, shoulder construction still open (K1). Sleeve views: completed from the same flat (visual only, not a pattern).";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp", ".svg": "image/svg+xml" };

const OPEN_WORDS = {
  TO_MEASURE_ON_SAMPLE: "TBD — to be confirmed on sample",
  TBD_PATTERN_MAKER: "TBD — pattern maker",
  TBD_SUPPLIER_PROPOSAL: "TBD — supplier proposal required",
  UNKNOWN: "TBD — unknown",
};
const OPEN_SHORT = {
  TO_MEASURE_ON_SAMPLE: "TBD — on sample",
  TBD_PATTERN_MAKER: "TBD — pattern maker",
  TBD_SUPPLIER_PROPOSAL: "TBD — supplier",
  UNKNOWN: "TBD — unknown",
};
/** Factory wording for an anchor: the master spec's internal remarks (in brackets) left out. */
const anchorText = (t) => String(t ?? "").replace(/\s*\([^)]*\)\s*$/, "");
/** The landmark alone ("SP", "CF line", "Sleeve outer centre line"). */
const landmark = (t) => anchorText(t).split(" — ")[0].replace(/\s*\([^)]*\)/g, "");
const STATUS_TAG = {
  VERIFIED_SOURCE: ["REF · SOURCE", "ref"],
  DERIVED_FROM_VERIFIED_SOURCE: ["REF · DERIVED", "ref"],
  SECONDARY_VISUAL_REFERENCE: ["BENCHMARK", "ref"],
  PROVISIONAL_TARGET: ["PROVISIONAL", "prov"],
  CUSTOMER_SELECTED: ["CUSTOMER", "cust"],
  SYSTEM_DERIVED: ["SYSTEM", "sys"],
  TO_MEASURE_ON_SAMPLE: ["MEASURE ON SAMPLE", "open"],
  TBD_PATTERN_MAKER: ["PATTERN MAKER", "open"],
  TBD_SUPPLIER_PROPOSAL: ["SUPPLIER PROPOSAL", "open"],
  UNKNOWN: ["UNKNOWN", "open"],
  APPROVED_PRODUCTION: ["APPROVED", "ref"],
};
const tag = (status) => {
  const [t, c] = STATUS_TAG[status] ?? [status, "open"];
  return `<span class="tag ${c}">${esc(t)}</span>`;
};

/** A Field as printed: value (sensible precision) or explicit TBD wording. */
function show(f, { unit = true, inches = false, short = false } = {}) {
  if (!f) return '<span class="tbd">TBD — unknown</span>';
  if (f.value === null || f.value === undefined) {
    if (f.range) return `${f.range[0]}–${f.range[1]}${unit && f.unit ? ` ${esc(f.unit)}` : ""}`;
    return `<span class="tbd">${esc((short ? OPEN_SHORT : OPEN_WORDS)[f.status] ?? "TBD")}</span>`;
  }
  let v = f.value;
  if (typeof v === "number") v = f.precision !== undefined ? v.toFixed(f.precision) : String(v);
  if (Array.isArray(v)) v = v.map((x) => (typeof x === "number" ? x.toFixed(f.precision ?? 1) : x)).join(" × ");
  const u = unit && f.unit && f.unit !== "count" && f.unit !== "pcs" ? ` ${esc(f.unit)}` : "";
  const src = inches && f.sourceValue ? ` <span class="muted">(${esc(f.sourceValue.text ?? `${f.sourceValue.value} ${f.sourceValue.unit}`)})</span>` : "";
  return `${esc(v)}${u}${src}`;
}

const withTag = (f, opts) => (f && f.value !== null ? `${show(f, opts)}<br>${tag(f.status)}` : show(f, { short: true, ...opts }));
const table = (head, rows, cls = "") =>
  `<table class="grid ${cls}"><thead><tr>${head.map((h) => `<th${h.w ? ` style="width:${h.w}"` : ""}>${h.t ?? h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.join("")}</tr>`).join("")}</tbody></table>`;
const td = (html, cls = "", extra = "") => `<td${cls ? ` class="${cls}"` : ""}${extra ? ` ${extra}` : ""}>${html}</td>`;


/**
 * Runs in the document before printing: a page whose content doesn't fit
 * moves its overflowing table rows (tables marked .split) — and what follows
 * the table — to a continuation page with the same header and the table
 * head repeated; then pages are numbered. Anything that still doesn't fit is
 * reported in data-overflow, and the generator refuses to print.
 */
const PAGINATE = `document.fonts.ready.then(() => {
  const SAFE = 6;
  // Content height = bottom of the last child (scrollHeight never reports less than the box).
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

export function renderRfqHtml(specIn, { artDir }) {
  let spec = specIn;
  const pages = [];
  const page = (title, body, cls = "") => pages.push({ title, body, cls });
  const m = spec.meta;

  // Artwork files: only those named in the spec, only inside the tech pack folder.
  const dataUrlOf = (rel) => {
    if (!rel) return null;
    const file = resolve(artDir, rel);
    const r = relative(artDir, file);
    if (!r || r.startsWith("..") || isAbsolute(r) || !existsSync(file)) return null;
    const mime = MIME[extname(file).toLowerCase()];
    if (!mime) return null;
    return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
  };
  const hrefCache = new Map();
  const hrefOf = (a) => {
    if (!hrefCache.has(a.artworkId)) hrefCache.set(a.artworkId, dataUrlOf(a.files.artwork));
    return hrefCache.get(a.artworkId);
  };

  // The master spec's provisional M target range (B01 / B06 / B09), printed under the reference value
  // in every table that shows the base size — the drawings print the same (pomDisplayFromSpec).
  const TARGETS = targetsFromSpec(spec);
  const targetNote = (id) => (TARGETS[id] ? `<br><span class="small prov">target ${esc(TARGETS[id])}<br>PROVISIONAL</span>` : "");

  const colour = (role) => spec.colourway.find((c) => c.role === role);
  const fills = fillsFor({
    body: colour("Body")?.hex,
    sleeves: colour("Sleeves")?.hex,
    rib: colour("Rib — collar, cuffs, waistband (base)")?.hex,
    stripe: colour("Rib stripes")?.hex,
    snap: colour("Snaps")?.hex,
  });
  // Text embroidery artwork is drawn in black on the server; it is shown in its (Fill) thread colour.
  spec = { ...spec, artwork: spec.artwork.map((a) => (a.artworkType === "TEXT" && a.threads[0]?.hex ? { ...a, tint: a.threads[0].hex } : a)) };
  const zoneNo = new Map(spec.embroideryZones.map((z, i) => [z.zoneId, `Z${i + 1}`]));
  const zones = spec.embroideryZones.map((z) => ({ ...z, label: zoneNo.get(z.zoneId) }));

  // ---------------------------------------------------------------- 1 Cover
  const sz = spec.style.requestedSampleSize;
  page(
    "Cover / style overview",
    `<div class="cover">
      <div class="cover-left">
        <div class="brand">JACKETEK</div>
        <h1>RFQ TECH PACK</h1>
        <div class="banner big">${BANNER}</div>
        <table class="kv">
          <tr><th>Style</th><td>${esc(spec.style.name)} <span class="muted">(${esc(m.styleId)})</span></td></tr>
          <tr><th>Product</th><td>${esc(spec.style.productType)} · ${esc(spec.style.category)}</td></tr>
          <tr><th>Fit</th><td>${show(spec.style.fit)} <span class="muted small">— shoulder construction open (K1)</span></td></tr>
          <tr><th>Design ID</th><td class="mono">${esc(m.designId)}</td></tr>
          <tr><th>Order reference</th><td class="mono">${esc(m.orderId ?? "—")}${m.orderLine ? ` · line ${m.orderLine}` : ""}</td></tr>
          <tr><th>Revision</th><td><b>${esc(m.revision)}</b></td></tr>
          <tr><th>Date</th><td>${esc(m.createdAt.slice(0, 10))}</td></tr>
          <tr><th>Requested sample size</th><td><b>${show(sz)}</b></td></tr>
          <tr><th>Document status</th><td><b>${esc(spec.documentStatus.code)}</b> — ${esc(spec.documentStatus.statement)}</td></tr>
          <tr><th>Sample status</th><td>${esc(spec.style.sampleStatus)}</td></tr>
          <tr><th>Silhouette reference</th><td>${show(spec.style.silhouette.primaryReference)} ${tag(spec.style.silhouette.primaryReference.status)}<br><span class="muted">Visual benchmark: ${esc(spec.style.silhouette.secondaryVisualReference.value)} — not verified</span></td></tr>
          <tr><th>Spec</th><td class="mono">${esc(m.schema)} ${esc(m.specVersion)} · master: ${esc(m.masterSpec.file)} (${m.masterSpec.productionApproved ? "approved" : "not production approved"})</td></tr>
        </table>
      </div>
      <div class="cover-right">
        <div class="cover-views">
          <div class="views-stack">
            <figure>${viewSvg("front", { wMm: 118, hMm: 74, fills, zones, artworks: spec.artwork, hrefOf, labels: false, boxes: false })}<figcaption>Front — design preview</figcaption></figure>
            <figure>${viewSvg("back", { wMm: 118, hMm: 74, fills, zones, artworks: spec.artwork, hrefOf, labels: false, boxes: false })}<figcaption>Back — design preview</figcaption></figure>
          </div>
          <div class="sleeve-stack">
            <figure>${sleeveSvg("leftSleeve", { wMm: 21, hMm: 74, fills, zones, artworks: spec.artwork, hrefOf, labels: false, boxes: false })}<figcaption>Left sleeve</figcaption></figure>
            <figure>${sleeveSvg("rightSleeve", { wMm: 21, hMm: 74, fills, zones, artworks: spec.artwork, hrefOf, labels: false, boxes: false })}<figcaption>Right sleeve</figcaption></figure>
          </div>
        </div>
        <p class="note">Illustrative flats, not to scale. Artwork is layered on the base flat at the customer's proportional placement; physical positions are to be confirmed on sample.</p>
      </div>
    </div>`,
    "cover-page"
  );

  // ------------------------------------------------------- 2 Technical flats
  const legendRows = zones.map((z) => `<tr><td class="mono">${z.label}</td><td>${esc(z.zoneName)}</td><td>${z.used ? "<b>used</b>" : '<span class="muted">—</span>'}</td></tr>`).join("");
  page(
    "Technical flats",
    `<div class="flats">
      <div class="flats-body">
        <figure>${viewSvg("front", { wMm: 112, hMm: 76, zones })}<figcaption>A · FRONT</figcaption></figure>
        <figure>${viewSvg("back", { wMm: 112, hMm: 76, zones })}<figcaption>B · BACK</figcaption></figure>
      </div>
      <figure>${sleeveSvg("leftSleeve", { wMm: 44, hMm: 140, zones })}<figcaption>C · LEFT SLEEVE<br>(as worn)</figcaption></figure>
      <figure>${sleeveSvg("rightSleeve", { wMm: 44, hMm: 140, zones })}<figcaption>D · RIGHT SLEEVE<br>(as worn)</figcaption></figure>
      <div class="flat-notes">
        <h3>Garment features</h3>
        <ul>
          <li>Snap front with placket — snap count / spacing ${show(spec.garment.closure.snapCount, { short: true })}</li>
          <li>Rib knit collar, cuffs and waistband (striped)</li>
          <li>Slanted welt pockets, front</li>
          <li>Zipper: ${show(spec.garment.closure.zipper)}</li>
          <li>Shoulder construction: ${show(spec.garment.shoulderConstruction, { short: true })} (K1)</li>
        </ul>
        <h3>Embroidery zones</h3>
        <table class="mini">${legendRows}</table>
        <p class="note"><b>NOT TO SCALE.</b> Proportions are illustrative; dimensions: POM tables. Dashed boxes: the ten fixed embroidery zones (red = used), placed as on the configurator's reference model — physical anchors to be confirmed on sample.</p>
        <p class="note">${FLAT_NOTE}</p>
      </div>
    </div>`
  );

  // ------------------------------------------------------------ 3 Colourway
  const sw = (hex) => (hex ? `<span class="swatch" style="background:${esc(hex)}"></span>` : '<span class="swatch none"></span>');
  page(
    "Colourway",
    `<div class="cw-flats"><figure>${viewSvg("front", { wMm: 92, hMm: 54, fills, boxes: false })}<figcaption>Front</figcaption></figure><figure>${viewSvg("back", { wMm: 92, hMm: 54, fills, boxes: false })}<figcaption>Back</figcaption></figure><figure>${sleeveSvg("rightSleeve", { wMm: 26, hMm: 54, fills })}<figcaption>Sleeve</figcaption></figure></div>` +
    table(
      [{ t: "Colour role", w: "20%" }, { t: "Colour", w: "22%" }, { t: "Internal ID", w: "13%" }, { t: "Hex (screen only)", w: "10%" }, { t: "Material", w: "15%" }, { t: "Physical reference (Pantone / thread code)", w: "12%" }, { t: "Status", w: "8%" }],
      spec.colourway.map((c) => [
        td(esc(c.role)),
        td(`${sw(c.hex)} ${esc(c.name ?? "")}`),
        td(c.colourId.value ? `<span class="mono">${esc(c.colourId.value)}</span>` : show(c.colourId), "", ""),
        td(`<span class="mono">${esc(c.hex ?? "—")}</span>`),
        td(esc(c.material ?? "")),
        td(show(c.physicalReference)),
        td(tag(c.colourId.status)),
      ]),
      "split"
    ) +
      `<p class="note">Hex values describe the on-screen colour only. Physical colour matching (Pantone / lab dips / thread codes) is to be proposed by the supplier and approved on sample — no Pantone numbers are assumed. Rib stripes follow the sleeve colour as shown in the design preview; stripe count and width: pattern maker.</p>`
  );

  // ------------------------------------------------------------------ 4 BOM
  page(
      "Bill of materials",
      table(
        [{ t: "Item", w: "5%" }, { t: "Category", w: "8%" }, { t: "Component", w: "14%" }, { t: "Placement", w: "12%" }, { t: "Material", w: "13%" }, { t: "Colour", w: "11%" }, { t: "Specification", w: "11%" }, { t: "Supplier / source", w: "10%" }, { t: "Notes", w: "16%" }],
        [...spec.materials, ...spec.labels].map((b) => [
          td(`<span class="mono">${esc(b.id)}</span>`),
          td(esc(b.category)),
          td(`<b>${esc(b.component)}</b>`),
          td(esc(b.placement)),
          td(withTag(b.material)),
          td(b.colour.value ? `${esc(spec.colourway.find((c) => c.colourId.value === b.colour.value)?.name ?? b.colour.value)}<br>${tag(b.colour.status)}` : show(b.colour, { short: true })),
          td(show(b.specification, { short: true })),
          td(show(b.supplier, { short: true })),
          td(`<span class="small">${esc(b.notes.join(" "))}</span>`),
        ]),
        "dense split"
      ) + `<p class="note">"TBD — supplier": supplier to propose with the quotation (material specification, composition, weight / thickness, supplier reference). No composition, weight, thickness or supplier is assumed.</p>`
  );

  // --------------------------------------------------------- 5 Measurements
  const sizes = spec.measurements.sizes;
  const base = spec.measurements.baseSize;
  page(
      "Measurement specification — POM",
      `<p class="lead">Garment measurements in <b>cm</b>, base size <b>${esc(base)}</b>. Reference values are Golden Bear Classic Fit (published in inches, shown in brackets) — <b>not JACKETEK production approved</b>. See the grading page for the provisional target ranges.</p>` +
        table(
          [{ t: "POM", w: "4.5%" }, { t: "Measurement", w: "17%" }, ...sizes.map((s) => ({ t: s === base ? `<b>${s}</b>` : s, w: "6.2%" })), { t: "Tolerance ±", w: "7.5%" }, { t: "Status", w: "9.5%" }, { t: "How to measure", w: "24.3%" }],
          spec.measurements.poms.map((p) => {
            const vals = sizes.map((s) => p.values[s]);
            const allOpen = vals.every((f) => f.value === null && !f.range);
            const cells = allOpen
              ? [td(`<span class="tbd">${esc(OPEN_WORDS[vals[0].status])}</span>`, "center", `colspan="${sizes.length}"`)]
              : vals.map((f, k) => td(show(f, { unit: false }) + (sizes[k] === base && f.sourceValue ? `<br><span class="muted">${esc(f.sourceValue.text)}</span>` : "") + (sizes[k] === base ? targetNote(p.id) : ""), sizes[k] === base ? "num base" : "num"));
            return [
              td(`<span class="mono"><b>${esc(p.id)}</b></span>`),
              td(`${esc(p.name)}<br><span class="muted small">${esc(p.condition)}</span>`),
              ...cells,
              td(show(p.tolerance, { short: true })),
              td(tag(p.values[base].status)),
              td(`<span class="small">${esc(p.method)}</span>`),
            ];
          }),
          "dense pom split"
        ) + `<p class="note">Tolerances: supplier to propose per POM. REF · SOURCE = published reference value; REF · DERIVED = reference base + published grade; MEASURE ON SAMPLE / PATTERN MAKER = no value yet.</p>`
  );

  // ------------------------------------------------------ 5b POM diagrams
  // The canonical flat with the POM overlay (kept separate from the garment); labels are the
  // same base-size fields as the table above, so ids and values always match.
  const D = pomDisplayFromSpec(spec);
  const pomById = new Map(spec.measurements.poms.map((p) => [p.id, p]));
  const POM_PAGE = { "05-front-pom": "front body", "05b-front-detail-pom": "front: neck, collar, opening, snaps, pockets", "06-back-pom": "back", "07-sleeve-pom": "sleeve", "08-rib-detail": "rib details: collar, cuff, waistband" };
  const sheets = canonicalSheets(canonicalFlat(), D).filter((sh) => sh.name in POM_PAGE);
  const drawnIds = new Set(sheets.flatMap((sh) => sh.ids));
  const notDrawn = spec.measurements.poms.map((p) => p.id).filter((id) => !drawnIds.has(id));
  for (const sh of sheets) {
    const rows = sh.ids.map((id) => pomById.get(id)).filter(Boolean).map((p) => [
      td(`<span class="mono"><b>${esc(p.id)}</b></span>`),
      td(esc(p.name)),
      td((p.values[base].value !== null || p.values[base].range ? show(p.values[base]) : '<span class="tbd">TBD</span>') + targetNote(p.id), "num base"),
      td(tag(p.values[base].status)),
    ]);
    const multi = sh.drawings.length > 1;
    page(
      `POM diagram — ${POM_PAGE[sh.name]}`,
      `<div class="pom-page${multi ? " multi" : ""}">
        <div class="pom-draw">${sh.drawings.map((d) => `<figure>${d.svg}${d.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : ""}</figure>`).join("")}</div>
        <div class="pom-table">${table([{ t: "POM", w: "11%" }, { t: "Measurement", w: "53%" }, { t: base, w: "15%" }, { t: "Status", w: "21%" }], rows, "dense pomd")}
          <p class="note">Base size ${esc(base)}. Blue lines show <b>where</b> each POM is measured; how to measure and all values: the measurement specification. The drawing is not to scale and no value is taken from it.${sh.name === "08-rib-detail" && notDrawn.length ? ` Not drawn (inside the garment / labels): ${notDrawn.map(esc).join(", ")} — see the POM table.` : ""}</p></div>
      </div>`
    );
  }

  // ------------------------------------------------------------ 6 Grading
  const gr = spec.grading;
  const refPoms = spec.measurements.poms.filter((p) => gr.rules.some((r) => r.pomId === p.id));
  page(
    "Grading / size table",
    `<div class="banner amber">${esc(gr.label)}</div>
     <h3>Provisional target ranges — size ${esc(base)} <span class="tag prov">PROVISIONAL — REQUIRES SAMPLE APPROVAL</span></h3>` +
      table(
        [{ t: "Measurement", w: "22%" }, { t: "Target range", w: "14%" }, { t: "Related POM", w: "10%" }, { t: "Method", w: "30%" }, { t: "Note", w: "24%" }],
        spec.measurements.provisionalTargets.map((t) => [td(esc(t.measurement)), td(`<b>${show(t.field)}</b>`), td(`<span class="mono">${esc(t.relatedPom)}</span>`), td(esc(t.method)), td(`<span class="small">${esc(t.field.note ?? "")}</span>`)])
      ) +
      `<p class="note">No sleeve target is set: the two references measure the sleeve differently. Sleeve length is set on the fit model.</p>
     <h3>Reference grading (Golden Bear Classic Fit — four POMs only)</h3>` +
      table(
        [{ t: "POM", w: "7%" }, { t: "Measurement", w: "25%" }, ...sizes.map((s) => ({ t: s, w: "8%" })), { t: "Grade / size", w: "12%" }, { t: "Status", w: "8%" }],
        refPoms.map((p) => {
          const r = gr.rules.find((x) => x.pomId === p.id);
          return [td(`<span class="mono">${esc(p.id)}</span>`), td(esc(p.name)), ...sizes.map((s) => td(show(p.values[s], { unit: false }), s === base ? "num base" : "num")), td(show(r.perSize, { inches: true })), td(tag("VERIFIED_SOURCE"))];
        }),
        "dense"
      ) +
      `<p class="note">${esc(gr.note)} M = published value; other sizes = M + published grade (REF · DERIVED). All other POMs have no grading yet.</p>
     <h3>Secondary visual fit benchmark (M only) ${tag(spec.measurements.secondaryBenchmark.status)}</h3>` +
      table(
        [{ t: "Measurement", w: "30%" }, { t: "M", w: "12%" }, { t: "Method as known", w: "58%" }],
        spec.measurements.secondaryBenchmark.values.map((v) => [td(esc(v.measurement)), td(`${esc(v.value)} ${esc(v.unit)}`, "num"), td(esc(v.method))])
      ) +
      `<p class="note">${esc(spec.measurements.secondaryBenchmark.note)}</p>`
  );

  // ----------------------------------------------- 6b Method ambiguities
  page(
    "Measuring methods to confirm",
    `<p class="lead">The reference chart does not state these measuring details. Please measure the sample by every candidate method and report which reproduces the reference value.</p>` +
      table(
        [{ t: "ID", w: "7%" }, { t: "POM", w: "7%" }, { t: "Question", w: "28%" }, { t: "Detail", w: "58%" }],
        spec.measurements.methodAmbiguities.map((a) => [td(`<span class="mono">${esc(a.id)}</span>`), td(`<span class="mono">${esc(a.pomId)}</span>`), td(esc(a.title)), td(`<span class="small">${esc(a.detail)}</span>`)]),
        "dense split"
      )
  );

  // --------------------------------------------------------- 7 Construction
  page(
    "Construction details",
    table(
      [{ t: "ID", w: "6%" }, { t: "Operation", w: "18%" }, { t: "Information required", w: "40%" }, { t: "Specification", w: "22%" }, { t: "Status", w: "14%" }],
      spec.construction.map((c) => [td(`<span class="mono">${esc(c.id)}</span>`), td(`<b>${esc(c.operation)}</b>`), td(`<span class="small">${esc(c.fieldsRequired)}</span>`), td(show(c.value) + (c.value.note && c.value.status === "UNKNOWN" ? `<br><span class="small muted">${esc(c.value.note)}</span>` : "")), td(tag(c.value.status))]),
      "dense split"
    ) + `<p class="note">No construction is confirmed. Construction is not inferred from the 3D design model. Supplier to propose each item with the quotation.</p>`
  );

  // ------------------------------------------------------ 8 Zone register
  page(
    "Embroidery zone register",
    `<p class="lead">Ten fixed embroidery zones. Physical zone size and anchor offsets are <b>not yet set</b>: they are fixed by the pattern maker on the sample and then apply to every order.</p>` +
      table(
        [{ t: "Zone", w: "5%" }, { t: "Name", w: "13%" }, { t: "Panel", w: "13%" }, { t: "Primary anchor (vertical)", w: "17%" }, { t: "Secondary anchor (horizontal)", w: "15%" }, { t: "Zone W × H", w: "12%" }, { t: "Anchor offsets X / Y", w: "12%" }, { t: "Used", w: "5%" }, { t: "Status", w: "8%" }],
        zones.map((z) => [
          td(`<span class="mono"><b>${z.label}</b></span>`),
          td(esc(z.zoneName)),
          td(esc(z.garmentPanel)),
          td(`<span class="small">${esc(anchorText(z.physicalAnchorPrimary))}</span>`),
          td(`<span class="small">${esc(anchorText(z.physicalAnchorSecondary))}</span>`),
          td(z.zoneWidthCm.value === null ? show(z.zoneWidthCm, { short: true }) : `${show(z.zoneWidthCm)} × ${show(z.zoneHeightCm)}`),
          td(z.anchorOffsetXCm.value === null ? show(z.anchorOffsetXCm, { short: true }) : `${show(z.anchorOffsetXCm)} / ${show(z.anchorOffsetYCm)}`),
          td(z.used ? "<b>yes</b>" : "no"),
          td(tag(z.status)),
        ]),
        "dense split"
      )
  );

  // ------------------------------------------------------ 8b Placement schedule (normalized ratios)
  const CONTENT = { DESIGN_OR_TEXT: "Design or text", TEXT_ONLY: "Text only", DESIGN_ONLY: "Design only" };
  const VIEW = { front: "Front", back: "Back", leftSleeve: "Left sleeve", rightSleeve: "Right sleeve" };
  page(
    "Embroidery placement schedule",
    `<p class="lead"><span class="tag prov">NORMALIZED PLACEMENT — NOT PHYSICAL SIZE</span> Every zone exactly as the customer sees and edits it on the website (live configurator zones; ratios approved for visual placement on 2026-10-09), stated as shares of garment landmarks. Physical sizes and positions are <b>TBD — pattern maker</b>: they follow from the ratios once the M sample is measured (formulas below).</p>` +
      table(
        [{ t: "Zone", w: "4%" }, { t: "Name", w: "9%" }, { t: "View", w: "6%" }, { t: "Content", w: "6%" }, { t: "Norm. centre", w: "7%" }, { t: "Norm. W", w: "5%" }, { t: "Norm. H", w: "5%" }, { t: "Landmark position", w: "30%" }, { t: "Phys. W cm", w: "5%" }, { t: "Phys. H cm", w: "5%" }, { t: "Phys. position", w: "5%" }, { t: "Status", w: "7%" }, { t: "Source", w: "6%" }],
        zones.map((z) => {
          const r = zoneRatios(z);
          return [
            td(`<span class="mono"><b>${z.label}</b></span>`),
            td(esc(z.zoneName)),
            td(esc(VIEW[z.side] ?? z.side)),
            td(esc(CONTENT[z.allowedContent] ?? "—")),
            td(`<span class="mono small">${r ? r.centreLines.map(esc).join("<br>") : "TBD"}</span>`, "num"),
            td(`<span class="mono">${r?.width ?? "TBD"}</span>`, "num"),
            td(`<span class="mono">${r?.height ?? "TBD"}</span>`, "num"),
            td(`<span class="small">${esc(r ? r.landmarks.join(". ") : "TBD")}.</span>`),
            td('<span class="tbd">TBD</span>'),
            td('<span class="tbd">TBD</span>'),
            td('<span class="tbd">TBD</span>'),
            td(`${tag(z.status)}<br><span class="small prov">ratio: visual approval</span>`),
            td('<span class="small">Live configurator</span>'),
          ];
        }),
        "dense split"
      ) +
      `<h4>From ratio to centimetres — once calibrated</h4>
      <table class="grid dense"><thead><tr><th>Unit</th><th>Garment dimension</th><th>From POMs</th><th>Status</th></tr></thead><tbody>
        <tr><td>Body, vertical (v, h)</td><td>${esc(CALIBRATION.body.vertical.unit)}</td><td class="mono">${esc(CALIBRATION.body.vertical.formula)}</td><td>${tag("TO_MEASURE_ON_SAMPLE")}</td></tr>
        <tr><td>Body, centre across (u)</td><td>${esc(CALIBRATION.body.horizontal.unit)}</td><td class="mono">${esc(CALIBRATION.body.horizontal.formula)}</td><td>${tag("TO_MEASURE_ON_SAMPLE")}</td></tr>
        <tr><td>Sleeve, along (s, h)</td><td>${esc(CALIBRATION.sleeve.along.unit)}</td><td class="mono">${esc(CALIBRATION.sleeve.along.formula)}</td><td>${tag("TO_MEASURE_ON_SAMPLE")}</td></tr>
        <tr><td>Sleeve, width (W:H)</td><td>${esc(CALIBRATION.sleeve.across.unit)}</td><td class="mono">${esc(CALIBRATION.sleeve.across.formula)}</td><td>${tag("TO_MEASURE_ON_SAMPLE")}</td></tr>
      </tbody></table>
      <p class="note">E.g. a body zone's centre below HPS = v × (B07 − R01); its height = h × (B07 − R01) and its width = W:H × that height (every zone keeps its website proportions). ${esc(CALIBRATION.status)} The provisional M targets (half chest, across shoulder, body length) measure other lines and are not used to scale zones.</p>`
  );

  // ------------------------------------------------------ 9 Artwork pages
  const typeName = { READY_MADE: "Ready-made design", FRONT_LETTERS: "Front Letters", TEXT: "Text embroidery", UPLOAD: "Customer upload", NUMBER_YEAR: "Number / year", CREST: "Crest", OTHER_LIBRARY_DESIGN: "Library design" };
  for (const a of spec.artwork) {
    const z = zones.find((x) => x.zoneId === a.zoneId);
    const zr = z ? zoneRatios(z) : null;
    const p = a.placement;
    const href = hrefOf(a);
    const view = !z ? null : z.side === "front" || z.side === "back" ? viewSvg(z.side, { wMm: 112, hMm: 96, fills, zones, artworks: [a], hrefOf, highlight: z.zoneId }) : sleeveSvg(z.side, { wMm: 46, hMm: 96, fills, zones, artworks: [a], hrefOf, highlight: z.zoneId });
    const dimLabel = (f, what) => (f.value === null ? `${what} TBD` : `${what} ${f.value.toFixed(f.precision ?? 1)} cm`);
    const offLabel = p.normalizedOffsetX === 0 && p.normalizedOffsetY === 0 ? "artwork centred" : `artwork centre ${p.normalizedOffsetX >= 0 ? "+" : "−"}${Math.abs(Math.round(p.normalizedOffsetX * 100))} % W, ${p.normalizedOffsetY >= 0 ? "+" : "−"}${Math.abs(Math.round(p.normalizedOffsetY * 100))} % H`;
    const closeup = z ? zoneCloseupSvg(z, a, href, { wMm: 112, hMm: 40, widthLabel: dimLabel(z.zoneWidthCm, "zone W"), heightLabel: dimLabel(z.zoneHeightCm, "zone H"), offsetLabel: offLabel }) : "";
    const anchorLine = z
      ? `Zone centre: ${z.anchorOffsetYCm.value === null ? "TBD" : show(z.anchorOffsetYCm)} from ${esc(landmark(z.physicalAnchorPrimary))} (vertical) · ${z.anchorOffsetXCm.value === null ? "TBD" : show(z.anchorOffsetXCm)} from ${esc(landmark(z.physicalAnchorSecondary))} (horizontal)`
      : "";
    const pct = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} %`;
    const sizeText = p.normalizedScale >= 0.999 ? "100 % — fitted to the zone (largest that fits)" : `${Math.round(p.normalizedScale * 100)} % of the largest size that fits the zone`;
    const where = p.normalizedOffsetX === 0 && p.normalizedOffsetY === 0 ? "Centred in the zone" : `Centre ${pct(p.normalizedOffsetX)} of zone width across · ${pct(p.normalizedOffsetY)} of zone height up (facing the zone)`;
    const threads = a.threads.length
      ? a.threads.map((t) => `<tr><td>${esc(t.role)}</td><td>${sw(t.hex)} ${esc(t.name ?? (t.hex ? `design colour ${t.hex}` : ""))}</td><td>${t.threadId.value ? `<span class="mono">${esc(t.threadId.value)}</span>` : show(t.threadId)}</td><td>${tag(t.threadId.status)}${t.asDesigned ? ' <span class="muted small">as designed</span>' : ""}</td></tr>`).join("")
      : `<tr><td colspan="4">Original design colours — thread matching by supplier / digitizer from the artwork file. ${tag("TBD_SUPPLIER_PROPOSAL")}</td></tr>`;
    const textBlock = a.text
      ? `<h4>Text — exactly as entered (${a.text.lineCount} line${a.text.lineCount > 1 ? "s" : ""}, ${a.text.characterCount} characters)</h4>
         <div class="textbox" dir="${a.text.direction}">${a.text.lines.map((l) => `<div>${esc(l) || "&nbsp;"}</div>`).join("")}</div>
         <table class="kv small"><tr><th>Font</th><td>${esc(a.text.font)}${a.text.fontId ? ` <span class="mono muted">(${esc(a.text.fontId)})</span>` : ""}</td></tr><tr><th>Direction / alignment</th><td>${a.text.direction === "rtl" ? "Right-to-left" : "Left-to-right"} · ${esc(a.text.alignment)}</td></tr>${a.text.fallbackFonts.length ? `<tr><th>Fallback fonts</th><td>${esc(a.text.fallbackFonts.join(", "))}</td></tr>` : ""}</table>`
      : "";
    const lettersBlock = a.frontLetters ? `<table class="kv small"><tr><th>Letters</th><td><b class="big-letters">${esc(a.frontLetters.letter1)} ${esc(a.frontLetters.letter2)}</b></td></tr><tr><th>Letter style</th><td>${esc(a.frontLetters.style)} <span class="mono muted">${esc(a.frontLetters.templateId)}</span></td></tr></table>` : "";
    page(
      `Artwork & placement — ${a.artworkId}`,
      `<div class="art-page">
        <div class="art-view"><figure>${view ?? '<p class="tbd">Zone not in the fixed zone system</p>'}<figcaption>${esc(a.zoneName)} (${z ? z.label : "—"}) — ${esc(z?.garmentPanel ?? "")}</figcaption></figure>
          ${closeup ? `<figure class="closeup">${closeup}<figcaption>Zone close-up — customer's size and position in the zone</figcaption></figure><p class="small anchor-line">${anchorLine}</p>` : ""}
          <div class="banner amber small-banner">${esc(p.label)}</div></div>
        <div class="art-detail">
          <div class="art-head"><div class="preview">${href ? (a.tint ? `<span class="tinted" style="background-color:${esc(a.tint)};-webkit-mask-image:url(${href});mask-image:url(${href})"></span>` : `<img src="${href}" alt="">`) : '<span class="tbd">No image</span>'}</div>
            <table class="kv">
              <tr><th>Artwork ID</th><td class="mono"><b>${esc(a.artworkId)}</b></td></tr>
              <tr><th>Type</th><td>${esc(typeName[a.artworkType] ?? a.artworkType)}</td></tr>
              <tr><th>Source</th><td>${esc(a.source.kind)}${a.source.libraryTitle ? ` · ${esc(a.source.libraryTitleEn ? `${a.source.libraryTitleEn} (${a.source.libraryTitle})` : a.source.libraryTitle)}` : ""}${a.source.libraryCode ? ` <span class="mono muted">[${esc(a.source.libraryCode)}]</span>` : ""}</td></tr>
              <tr><th>Source file / ref</th><td class="mono small">${esc(a.source.designId ?? "")} ${esc(a.source.originalFileName ?? "")}<br>${esc(a.files.artwork ?? "")}${a.files.original ? ` · ${esc(a.files.original)}` : ""}</td></tr>
              <tr><th>Colour mode</th><td>${a.colourMode === "ORIGINAL" ? "Original design colours" : "Custom colours"}</td></tr>
              <tr><th>Technique</th><td>${show(a.productionTechnique)}<br><span class="small muted">${esc(a.productionTechnique.note ?? "")}</span></td></tr>
            </table></div>
          ${textBlock}${lettersBlock}
          <h4>Placement</h4>
          <table class="kv small">
            <tr><th>Zone / anchors</th><td>${esc(a.zoneName)}${z ? ` · vertical from ${esc(landmark(z.physicalAnchorPrimary))} · horizontal from ${esc(landmark(z.physicalAnchorSecondary))}` : ` · ${esc(p.anchorReference)}`}</td></tr>
            <tr><th>Customer size in zone</th><td><b>${esc(sizeText)}</b> <span class="muted mono">(scale ${p.normalizedScale})</span></td></tr>
            <tr><th>Customer position in zone</th><td><b>${esc(where)}</b> <span class="muted mono">(x ${p.normalizedOffsetX}, y ${p.normalizedOffsetY})</span></td></tr>
            <tr><th>Finished size W × H</th><td>${p.finishedWidthCm.value === null ? show(p.finishedWidthCm) : `${show(p.finishedWidthCm)} × ${show(p.finishedHeightCm)}`}</td></tr>
            <tr><th>Physical offset X / Y</th><td>${p.physicalOffsetXCm.value === null ? show(p.physicalOffsetXCm) : `${show(p.physicalOffsetXCm)} / ${show(p.physicalOffsetYCm)}`}</td></tr>
            <tr><th>Zone placement (normalized)</th><td>${zr ? `${esc(zr.centre)} · w ${zr.width} · h ${zr.height}<br><span class="small muted">${esc(zr.landmarks.join(". "))}.</span><br><span class="small prov">NORMALIZED PLACEMENT — NOT PHYSICAL SIZE</span>` : '<span class="tbd">TBD</span>'}</td></tr>
            <tr><th>Configurator size</th><td><span class="small muted">Visual estimate on the 3D model only — not stated here. Finished size follows the zone dimensions set by the pattern maker.</span></td></tr>
            <tr><th>Rotation</th><td>${show(p.rotationDeg)}</td></tr>
          </table>
          <h4>Thread colours</h4>
          <table class="grid dense"><thead><tr><th>Layer</th><th>Colour</th><th>Thread ID</th><th>Status</th></tr></thead><tbody>${threads}</tbody></table>
        </div>
      </div>`
    );
  }

  // ------------------------------------------------------- 10 Quotation
  const q = spec.quotationRequirements;
  page(
    "Quotation request",
    `<p class="lead">Please quote the garment as specified in this document (design ${esc(m.designId)}, ${esc(m.revision)}). Where an item is TBD, propose your specification and price it. List any substitution separately.</p>` +
      table(
        [{ t: "Ref", w: "6%" }, { t: "Item", w: "44%" }, { t: "Supplier response", w: "50%" }],
        q.requested.map((r) => [td(`<span class="mono">${esc(r.id)}</span>`), td(esc(r.item)), td('<span class="fill"></span>')]),
        "quote split"
      ) +
      `<table class="kv small"><tr><th>Currency</th><td>${show(q.currency)}</td></tr><tr><th>Price breaks requested</th><td>${q.priceBreaks.join(" · ")} pcs (configurable)</td></tr></table>
      <ul class="small">${q.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
  );

  // ------------------------------------------------------- 11 Open items
  const v = spec.validation ?? { warnings: [], info: [] };
  const conflictsHtml = spec.conflicts.map((c) => `<li><b>${esc(c.id)} ${esc(c.topic)}</b> — ${esc(c.detail)}</li>`).join("");
  page(
    "Open items / to be confirmed",
    `<p class="lead">Everything below is not yet confirmed. It is listed so that every supplier quotes on the same understanding and nothing is mistaken for an approved specification.</p>
     <ol class="open">${v.warnings.filter((w) => w.code !== "OPEN_DECISION").map((w) => `<li><span class="mono small">${esc(w.code)}</span> ${esc(w.message)}</li>`).join("")}</ol>
     <h3>Open design decisions</h3><ul class="small">${conflictsHtml}</ul>`
  );

  // ------------------------------------------------- 12 Revision history
  page(
    "Revision history / document control",
    table(
      [{ t: "Revision", w: "12%" }, { t: "Date", w: "12%" }, { t: "Spec version", w: "12%" }, { t: "Summary", w: "64%" }],
      spec.revisionHistory.map((r) => [td(`<b>${esc(r.revision)}</b>`), td(esc(r.date)), td(esc(r.specVersion)), td(esc(r.summary))])
    ) +
      `<table class="kv small">
        <tr><th>Document type</th><td>${esc(m.documentType)}</td></tr>
        <tr><th>Document status</th><td>${esc(m.documentStatus)} — ${BANNER}</td></tr>
        <tr><th>Master garment spec</th><td>${esc(m.masterSpec.title)} · ${esc(m.masterSpec.revision)}<br><span class="mono small">${esc(m.masterSpec.file)} sha256 ${esc(m.masterSpec.sha256 ?? "")}</span></td></tr>
        <tr><th>Validation</th><td>${(spec.validation?.errors ?? []).length} errors · ${(spec.validation?.warnings ?? []).length} warnings · ${(spec.validation?.info ?? []).length} notes</td></tr>
        <tr><th>Revision path</th><td>RFQ-01, RFQ-02 … → PROTO-01 → SAMPLE-01 → PRODUCTION-01 (production only after an explicitly approved master spec)</td></tr>
       </table>
       <p class="note">Status key: ${Object.entries(STATUS_TAG).filter(([k]) => k !== "APPROVED_PRODUCTION").map(([k]) => `${tag(k)} ${esc(k)}`).join(" · ")}</p>`
  );

  // ----------------------------------------------------------- assemble
  const N = pages.length;
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>JACKETEK RFQ Tech Pack ${esc(m.designId)} ${esc(m.revision)} — ${BANNER}</title>
<meta name="description" content="${BANNER}"><meta name="keywords" content="RFQ, NOT FOR BULK PRODUCTION, ${esc(m.designId)}, ${esc(m.revision)}">
<style>@font-face{font-family:"JK Text";src:url(data:font/ttf;base64,${TEXT_FONT}) format("truetype")}${CSS}</style></head><body>`;
  const body = pages
    .map(
      (p, i) => `<section class="page ${p.cls}">
  <header class="ph"><div class="ph-l"><b>JACKETEK</b> · ${m.testDocument ? `<span class="qa">${esc(m.testDocument)}</span>` : "RFQ TECH PACK"} · <span class="mono">${esc(m.designId)}</span> · ${esc(m.revision)}</div><div class="ph-c">${esc(p.title)}</div><div class="ph-r status">${BANNER}</div></header>
  <main class="pb">${i === 0 ? "" : `<h2>${esc(p.title)}</h2>`}${p.body}</main>
  <footer class="pf"><div>${m.testDocument ? `<span class="qa">${esc(m.testDocument)}</span> · ` : ""}${BANNER} · Not a production tech pack</div><div>${esc(m.schema)} ${esc(m.specVersion)} · generated ${esc(m.createdAt.slice(0, 16).replace("T", " "))} UTC</div><div class="pno">Page ${i + 1} of ${N}</div></footer>
</section>`
    )
    .join("\n");
  const check = `<script>${PAGINATE}</script>`;
  return { html: `${head}${body}${check}</body></html>`, pageTitles: pages.map((p) => p.title) };
}
