// Production Tech Pack HTML (A4 landscape) from a production spec (generate.mjs buildProductionSpec).
// Deterministic: the same spec + assets → the same HTML (no clock, no random ids).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cm = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(2));
const swatch = (hex) => (hex ? `<span class="sw" style="background:${esc(hex)}"></span>` : "");
const STATUS_LABEL = {
  R2_REFERENCE_EXACT: ["ok", "Same position as the R2 reference"],
  DERIVED_FROM_R2_REFERENCE: ["warn", "Derived from the R2 reference + the customer's offset — confirm at strike-off"],
  SLEEVE_OFFSET_NOT_TRANSFERABLE: ["bad", "Sleeve offset differs from the R2 reference — MANUFACTURER CONFIRMATION REQUIRED"],
  NO_R2_REFERENCE: ["bad", "No R2 reference position for this zone — MISSING (pattern maker to place; owner to approve)"],
  LEGACY_ZONE: ["bad", "Older free placement (before fixed zones) — MISSING"],
};

function header(spec, n, total, title) {
  return `<header><div class="brand">J A C K E T E K</div><div class="doc">PRODUCTION TECH PACK · Jacket ID <b>${esc(spec.jacket.jacketId)}</b> · Style ${esc(spec.master.style)} Rev ${esc(spec.master.revision)}</div>
    <div class="status">${esc(spec.document.banner)}</div></header><h1><span class="num">${n}</span>${esc(title)}</h1>`;
}
const footer = (spec, n, total) =>
  `<footer><span>${esc(spec.jacket.jacketId)} · order ${esc(spec.jacket.orderId)} line ${spec.jacket.line} · master ${esc(spec.master.style)} ${esc(spec.master.revision)} (${esc(spec.master.registrySha256.slice(0, 12))}) · design ${esc(spec.approval.snapshotSha256.slice(0, 12))} · all dimensions in cm</span><span>Page ${n} of ${total}</span></footer>`;

function table(head, rows, cls = "") {
  return `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function cover(spec) {
  const j = spec.jacket, a = spec.approval, m = spec.master;
  const rows = [
    ["Jacket ID", `<b class="big">${esc(j.jacketId)}</b>`],
    ["Order / line", `${esc(j.orderId)} · line ${j.line} · quantity ${j.quantity} (identical jackets of this one design)`],
    ["Product", `${esc(j.productName)} — style ${esc(m.style)}`],
    ["Customer size", `<b>${esc(j.size ?? "—")}</b>`],
    ["Design approval", `${esc(a.method)} · ${esc(a.approvedAt)}${a.reference ? ` · ${esc(a.reference)}` : ""}`],
    ["Approved design snapshot", `<code>${esc(a.snapshotSha256)}</code> (design ${esc(a.designSha256.slice(0, 16))}…)`],
    ["Base garment master", `${esc(m.style)} Rev ${esc(m.revision)} (${esc(m.engineeringRevision)}, ${esc(m.revisionDate)}) · base size: ${esc(m.baseSize)} · registry <code>${esc(m.registrySha256.slice(0, 16))}…</code>`],
    ["Master approval status", `<b class="${m.approvalStatus === "APPROVED" ? "ok" : "bad"}">${esc(m.approvalStatus.replaceAll("_", " "))}</b>`],
  ];
  return `<div class="cols"><div>${table(["Item", "Specification"], rows.map(([k, v]) => [esc(k), v]), "kv")}</div>
    <div><div class="box warn"><h3>Before cutting — open items</h3><ul>${spec.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
    <div class="box"><h3>How to use this document</h3><p>This Production Tech Pack defines <b>this one jacket</b>: its size, colours, materials and every artwork, size and position as the customer approved them. The garment itself — pattern, construction, measurements, rib, snaps, pockets, labels and QC — is the master <b>${esc(m.style)} Rev ${esc(m.revision)}</b> supplier package. Use those sections unchanged and replace the reference design's colours and artwork with this document.</p></div></div></div>`;
}

function garment(spec, flats) {
  const g = spec.garment;
  const colourRows = g.colourway.map((c) => [esc(c.role), `${swatch(c.hex)}${esc(c.name ?? "—")}`, `<code>${esc(c.hex ?? "")}</code>`, esc(c.material ?? ""), esc(c.basis)]);
  const marker = (view) =>
    spec.artwork
      .filter((a) => a.flatCallout?.view === view)
      .map((a, i, all) => {
        const same = all.filter((b) => b.flatCallout.px[0] === a.flatCallout.px[0] && b.flatCallout.px[1] === a.flatCallout.px[1]);
        const k = same.indexOf(a);
        return `<span class="mk" style="left:${((a.flatCallout.px[0] / 1400) * 100 + k * 3.2).toFixed(2)}%;top:${((a.flatCallout.px[1] / 1400) * 100).toFixed(2)}%">${a.n}</span>`;
      })
      .join("");
  return `<div class="cols g2"><div>
      <h3>Colourway and materials (customer's approved selection)</h3>${table(["Part", "Colour", "Screen ref.", "Material", "Basis"], colourRows)}
      <p class="small">Fit: ${esc(g.fit ?? "—")}. Physical colour references (lab dips / swatches) for every colour: FC-04 / FC-05. Screen hex values are references only.</p>
    </div><div>
      <h3>Technical flats — numbered markers = this jacket's artwork</h3>
      <div class="flats"><div class="flat"><img src="${flats.front}"><div class="mks">${marker("front")}</div><span class="cap">FRONT</span></div>
      <div class="flat"><img src="${flats.back}"><div class="mks">${marker("back")}</div><span class="cap">BACK</span></div></div>
      <p class="small">Line drawing from the R2 pattern geometry (pale grey = sleeves). Dashed boxes are the R2 reference artwork boundaries; this jacket's artwork is listed in section 3 by number. Artwork in a zone without a marker has no R2 reference position (see its status).</p>
    </div></div>`;
}

function bomPage(spec) {
  const rows = spec.bom.map((b) => [esc(b.id), esc(b.component), esc(b.placement), b.customerValue ? b.customerValue : `<span class="muted">as master ${esc(spec.master.revision)} §5 (composition, weight and supplier: FC-03 / FC-04)</span>`]);
  return `${table(["#", "Component", "Placement", "This jacket"], rows)}<p class="small">Rows marked "as master" are identical for every jacket of style ${esc(spec.master.style)}; the requirement and status of each row are in the master supplier Tech Pack, section 5. Colours above replace the reference colourway shown there.</p>`;
}

function artworkCard(a) {
  const [cls, label] = STATUS_LABEL[a.placement.status];
  const threads = a.threads.length ? a.threads.map((t) => `${swatch(t.hex)}${esc(t.label)}: ${esc(t.name ?? "—")} <code>${esc(t.hex ?? "")}</code>`).join("<br>") : "Original artwork colours (no thread chosen) — match the artwork file";
  const p = a.placement;
  const rows = [
    ["Zone", `${esc(a.zoneName)} <span class="muted">(${esc(a.zoneId)})</span> · piece <b>${esc(a.piece ?? "—")}</b>`],
    ["Artwork", `${esc(a.typeLabel)}${a.libraryCode ? ` · library ${esc(a.libraryCode)}` : ""}`],
    ...(a.text ? [["Text (exact)", `<div class="txt" dir="${esc(a.text.direction)}">${esc(a.text.content).replace(/\n/g, "<br>")}</div><span class="muted">${a.text.lineCount} line(s) · font ${esc(a.text.font)} · ${esc(a.text.direction.toUpperCase())}</span>`]] : []),
    ["Colours", threads],
    ["Finished size", a.sizeCm ? `<b>${cm(a.sizeCm[0])} × ${cm(a.sizeCm[1])}</b> (W × H) — proportions of the artwork file kept` : "MISSING"],
    ["Centre", p.centreCm ? `<b>x ${cm(p.centreCm.x)} · y ${cm(p.centreCm.y)}</b> — ${esc(p.frame)}` : "MISSING"],
    ["Rotation", p.rotationDeg === null ? "—" : `${p.rotationDeg.toFixed(1)}° (R2 reference orientation on the piece)`],
    ["Customer's in-zone offset", a.offsetCm ? `x ${cm(a.offsetCm[0])} · y ${cm(a.offsetCm[1])} (website zone frame)${p.deltaCm ? ` · Δ to R2 reference x ${cm(p.deltaCm[0])}, y ${cm(p.deltaCm[1])}` : ""}` : "—"],
    ["Technique", "Embroidery / patch / chenille, backing and digitizing: FC-07 (factory proposal). Strike-off required."],
    ["Placement status", `<b class="${cls}">${esc(label)}</b>${p.note ? `<br><span class="muted">${esc(p.note)}</span>` : ""}`],
  ];
  return `<div class="card"><div class="art"><span class="badge">${a.n}</span>${a.image ? `<img src="${a.image}">` : `<div class="noimg">No artwork file</div>`}<div class="muted small">${esc(a.artworkId)}${a.pixels ? ` · ${a.pixels[0]} × ${a.pixels[1]} px` : ""}${a.text ? " · lettering shape; thread colour per Colours" : ""}</div></div>
    <div>${table(["", ""], rows.map(([k, v]) => [esc(k), v]), "kv tight")}</div></div>`;
}

function base(spec) {
  const pomRows = spec.basePoms.map((p) => [esc(p.id), esc(p.name), `<b>${cm(p.baseSizeCm)}</b>`]);
  const fcRows = spec.factoryConfirmation.map((f) => [esc(f.id), esc(f.title), esc(f.detail)]);
  return `<div class="cols g2"><div>
      <h3>Master ${esc(spec.master.style)} Rev ${esc(spec.master.revision)} — key measurements, BASE SIZE</h3>${table(["POM", "Measurement", "cm"], pomRows)}
      <p class="small">${esc(spec.master.grading)} Full POM list, tolerances (FC-09), patterns and construction: master supplier package, sections listed on the right.</p>
      <h3>Master supplier Tech Pack sections</h3>
      <p class="small"><b>Apply unchanged:</b> ${spec.sections.appliesUnchanged.map(esc).join(" · ")}.</p>
      <p class="small"><b>Replaced for this jacket by this document:</b> ${spec.sections.replacedByCustomerTechPack.map(esc).join(" · ")}.</p>
      <p class="small">${esc(spec.sections.patternsAndArtworkFolders)}</p>
    </div><div><h3>Factory confirmation required before the sample</h3>${table(["#", "Item", "To confirm (master items; section numbers refer to the master)"], fcRows, "small")}</div></div>`;
}

/**
 * Images are referenced by RELATIVE URL (the HTML is printed from <folder>/.print/, next to copies of the
 * flats and above ../artwork/): the HTML stays small and its hash covers the layout and text; the image
 * bytes are hashed separately (manifest.json, master registry).
 */
export const ASSET_URLS = { flatFront: "flat-front.png", flatBack: "flat-back.png", artwork: (a) => (a.file ? `../${a.file}` : null) };

/** spec → { html, pages } */
export function renderProductionTechPack(spec) {
  const flats = { front: ASSET_URLS.flatFront, back: ASSET_URLS.flatBack };
  const art = spec.artwork.map((a) => ({ ...a, image: ASSET_URLS.artwork(a) }));
  const artPages = [];
  for (let i = 0; i < art.length; i += 2) artPages.push(art.slice(i, i + 2));
  const pages = [
    ["Jacket identification", cover(spec)],
    ["Garment and colourway", garment(spec, flats)],
    ["Bill of materials — this jacket", bomPage(spec)],
    ...(artPages.length ? artPages.map((p, i) => [`Artwork${artPages.length > 1 ? ` (${i + 1} of ${artPages.length})` : ""}`, `<div class="cards">${p.map(artworkCard).join("")}</div>`]) : [["Artwork", "<p>No artwork on this jacket.</p>"]]),
    ["Base garment master and factory confirmation", base(spec)],
  ];
  const total = pages.length;
  const nArt = Math.max(1, artPages.length);
  const sectionNo = (i) => (i < 3 ? i + 1 : i < 3 + nArt ? 4 : 5);
  const body = pages.map(([title, html], i) => `<section class="page">${header(spec, sectionNo(i), total, title)}<main>${html}</main>${footer(spec, i + 1, total)}</section>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>JACKETEK Production Tech Pack ${esc(spec.jacket.jacketId)}</title><style>${CSS}</style></head><body>${body}<script>${CHECK}</script></body></html>`;
  return { html, pages: total };
}

// Layout check (read by generate.mjs with --dump-dom before printing): pages whose content overflows.
const CHECK = `addEventListener("load", () => { const bad = [...document.querySelectorAll("section.page")].map((p, i) => { const m = p.querySelector("main"); const over = m.scrollHeight > m.clientHeight + 1 || [...m.querySelectorAll(".card")].some((c) => c.scrollHeight > c.clientHeight + 1); return over ? i + 1 : 0; }).filter(Boolean); document.body.dataset.overflow = bad.join(","); document.body.dataset.ready = "1"; });`;

const CSS = `
@page { size: A4 landscape; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font: 8.6pt/1.35 "Segoe UI", Arial, "Noto Sans Arabic", sans-serif; color: #1b1b1b; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { width: 297mm; height: 210mm; padding: 9mm 11mm 8mm; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column }
.page:last-child { page-break-after: auto }
header { display: flex; align-items: baseline; gap: 4mm; border-bottom: .3mm solid #222; padding-bottom: 1.6mm; font-size: 7.6pt }
header .brand { font-weight: 700; letter-spacing: .5mm }
header .doc { flex: 1 }
header .status { color: #b3121f; font-weight: 700 }
h1 { font-size: 14pt; margin: 3mm 0 2.5mm; display: flex; align-items: center; gap: 3mm }
h1 .num { background: #1b1b1b; color: #fff; font-size: 10pt; padding: .6mm 2.4mm }
h3 { font-size: 9pt; margin: 2.5mm 0 1.4mm; text-transform: uppercase; letter-spacing: .2mm }
main { flex: 1; min-height: 0; overflow: hidden }
footer { display: flex; justify-content: space-between; font-size: 6.8pt; color: #555; border-top: .2mm solid #bbb; padding-top: 1.4mm }
table { width: 100%; border-collapse: collapse; margin-bottom: 1.5mm }
th { background: #1b1b1b; color: #fff; text-align: left; font-size: 7pt; padding: 1mm 1.4mm; text-transform: uppercase }
td { border-bottom: .2mm solid #ddd; padding: .9mm 1.4mm; vertical-align: top }
table.kv td:first-child { width: 34%; color: #444; font-weight: 600 }
table.kv thead { display: none }
table.tight td { padding: .7mm 1.2mm }
.cols { display: grid; grid-template-columns: 1.1fr .9fr; gap: 7mm; height: 100% }
.cols.g2 { grid-template-columns: 1fr 1fr }
.box { border: .3mm solid #999; padding: 2mm 3mm; margin-bottom: 3mm }
.box.warn { border-color: #b3121f; background: #fff5f5 }
.box ul { margin: 0; padding-left: 4.5mm }
.big { font-size: 13pt }
code { font: 7.2pt Consolas, monospace; word-break: break-all }
.sw { display: inline-block; width: 3.2mm; height: 3.2mm; border: .2mm solid #555; vertical-align: -0.5mm; margin-right: 1.2mm }
.ok { color: #11692e } .warn { color: #8a5a00 } .bad { color: #b3121f }
.box.warn { color: inherit }
.muted { color: #666 } .small { font-size: 7.4pt }
.flats { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm }
.flat { position: relative; border: .2mm solid #ccc }
.flat img { width: 100%; display: block }
.flat .mks { position: absolute; inset: 0 }
.mk { position: absolute; transform: translate(-50%, -50%); background: #b3121f; color: #fff; border-radius: 50%; width: 5mm; height: 5mm; font-size: 7pt; font-weight: 700; display: flex; align-items: center; justify-content: center }
.flat .cap { position: absolute; bottom: 1mm; left: 0; right: 0; text-align: center; font-size: 7pt; color: #555 }
.cards { display: grid; grid-template-rows: 1fr 1fr; gap: 3mm; height: 100% }
.card { display: grid; grid-template-columns: 62mm 1fr; gap: 4mm; border: .3mm solid #999; padding: 1.8mm; min-height: 0; overflow: hidden; font-size: 8.2pt; line-height: 1.3 }
.art { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; background: repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/4mm 4mm; border: .2mm solid #ccc }
.art img { max-width: 58mm; max-height: 52mm; object-fit: contain }
.art .badge { position: absolute; top: 1mm; left: 1mm; background: #b3121f; color: #fff; font-weight: 700; padding: .3mm 1.8mm }
.noimg { color: #b3121f }
.txt { font-size: 11pt; font-weight: 600; unicode-bidi: plaintext }
`;
