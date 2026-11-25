#!/usr/bin/env node
// MATERIAL / CONSTRUCTION MATRIX v0.1 (K2) — one generator, so the matrix, the factory proposal
// request and the review images can never disagree with each other or with Master Spec v0.2.
//
//   node scripts/materials/material-matrix.mjs
//
// Reads:   scripts/materials/components.mjs + garment-spec/jacketek-master-spec-v0.1.json (unchanged)
//          + the S.i. canonical flat (drawing only, for the review images)
// Writes:  garment-spec/material-construction-matrix-v0.1.{json,md}
//          garment-spec/factory-material-proposal-request.md
//          dev-output/material-construction-review/  (6 PNG + material-construction-review.json)
//
// Master Spec v0.2 gets the same plan from scripts/measurement/source-matrix.mjs (run that too).
// Rules: no specification value is invented (every spec field is null with a TBD status); S.i.
// template text is REFERENCE ONLY; embroidery placement is not touched; nothing is approved.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalFlat, sleeveSvg, viewSvg } from "../../server/rfq/flats.mjs";
import { AUDIT, AUDITED, COMPONENTS, CONTRADICTIONS, EMBROIDERY_FIELDS, EMBROIDERY_SUBSTRATES, EMBROIDERY_TYPES, FACTORY_REQUEST, K2, LEATHER_POLICY, OPEN_ALIGNMENT, SOURCES, STATUS } from "./components.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const V01 = "garment-spec/jacketek-master-spec-v0.1.json";
const REVIEW = "dev-output/material-construction-review";
const v01Buf = readFileSync(join(ROOT, V01));
const master = JSON.parse(v01Buf.toString("utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");

// ------------------------------------------------------------- checks against v0.1 and the rules
const bomIds = new Set(master.bom.map((b) => b.id));
const conIds = new Set(master.construction.map((c) => c.id));
for (const c of COMPONENTS) {
  for (const b of c.bom) if (!bomIds.has(b)) throw new Error(`${c.id}: unknown BOM ${b}`);
  for (const k of c.con) if (!conIds.has(k)) throw new Error(`${c.id}: unknown construction op ${k}`);
  for (const x of c.contradictions) if (!CONTRADICTIONS.some((y) => y.id === x)) throw new Error(`${c.id}: unknown contradiction ${x}`);
}
const ids = COMPONENTS.map((c) => c.id);
const expected = Array.from({ length: 12 }, (_, i) => `K2.${i + 1}`);
if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error(`components must be ${expected.join(", ")}`);
// No invented specification: every spec field is null, except the drawing-evidenced pocket type and
// the K1 sleeve-attachment statement (text, not a dimension).
const ALLOWED_TEXT = new Set(["K2.8.pocketType", "K2.10.sleeveAttachment"]);
for (const c of COMPONENTS) for (const [k, f] of Object.entries(c.spec)) {
  if (f.value !== null && !ALLOWED_TEXT.has(`${c.id}.${k}`)) throw new Error(`${c.id}.${k}: a specification value was set (${f.value})`);
  if (typeof f.value === "number") throw new Error(`${c.id}.${k}: numeric value`);
}
if (K2.status !== "PARTIALLY_RESOLVED") throw new Error("K2 must stay PARTIALLY_RESOLVED");
for (const t of EMBROIDERY_TYPES) for (const f of Object.values(t.fields)) if (f.value !== null) throw new Error(`embroidery ${t.type}: value set`);
const zonesV01 = master.embroideryZones.zones.map((z) => z.zoneId).sort();
if (JSON.stringify(EMBROIDERY_SUBSTRATES.flatMap((s) => s.zones).sort()) !== JSON.stringify(zonesV01)) throw new Error("embroidery substrates must cover the 10 v0.1 zones exactly");

const counts = {
  components: COMPONENTS.length,
  specFields: COMPONENTS.reduce((n, c) => n + Object.keys(c.spec).length, 0),
  specFieldsSupplier: COMPONENTS.reduce((n, c) => n + Object.values(c.spec).filter((f) => f.status.startsWith(STATUS.SUPPLIER)).length, 0),
  specFieldsPatternMaker: COMPONENTS.reduce((n, c) => n + Object.values(c.spec).filter((f) => f.status === STATUS.PATTERN).length, 0),
  specFieldsWithValue: COMPONENTS.reduce((n, c) => n + Object.values(c.spec).filter((f) => f.value !== null).length, 0),
  auditRows: AUDIT.length,
  contradictions: CONTRADICTIONS.length,
  embroideryTypes: EMBROIDERY_TYPES.length,
};
const meta = {
  title: "JACKETEK Material / Construction Matrix v0.1 (K2)",
  generated: AUDITED,
  generator: "scripts/materials/material-matrix.mjs (data: scripts/materials/components.mjs)",
  documentStatus: "VALIDATION_DRAFT",
  productionApproved: false,
  basedOn: { file: V01, sha256: sha(v01Buf), unchanged: true },
  masterSpecV02: { file: "garment-spec/jacketek-master-spec-v0.2.json", field: "materialConstructionPlan", wiredIntoRfq: false },
  rule: "No specification value invented. Body = Cotton Fabric and sleeves = Leather are design intent; every composition, weight, thickness, finish, dimension and stitch value is TBD_SUPPLIER_PROPOSAL or TBD_PATTERN_MAKER. S.i. template text is REFERENCE ONLY. Embroidery placement (zones) is not part of this matrix.",
};
const SPEC_DIR = join(ROOT, "garment-spec");
if (COMPONENTS.find((c) => c.id === "K2.2").material.value !== LEATHER_POLICY.designIntent) throw new Error("sleeve design intent must stay Leather");
const matrixJson = { ...meta, k2: K2, leatherPolicy: LEATHER_POLICY, openAlignmentItems: OPEN_ALIGNMENT, statusVocabulary: STATUS, sources: SOURCES, counts, components: COMPONENTS, embroideryConstruction: { fields: EMBROIDERY_FIELDS, substrates: EMBROIDERY_SUBSTRATES, types: EMBROIDERY_TYPES, placement: "Unchanged — Master Spec v0.1 embroideryZones and the normalised zone placement. Not mixed with construction." }, audit: AUDIT.map((a) => ({ ...a, sourceName: SOURCES[a.source], approved: false })), contradictions: CONTRADICTIONS, factoryProposalRequest: FACTORY_REQUEST };
writeFileSync(join(SPEC_DIR, "material-construction-matrix-v0.1.json"), JSON.stringify(matrixJson, null, 1) + "\n");

// ------------------------------------------------------------- markdown
const mdEsc = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(mdEsc).join(" | ")} |`)].join("\n");
const yn = (b) => (b ? "yes" : "no");
const fv = (f) => (f.value === null ? `— (${f.status})` : `${f.value} (${f.status})`);
const HEADER = (title) => `# ${title}\n\n**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated ${AUDITED} by \`scripts/materials/material-matrix.mjs\` from \`scripts/materials/components.mjs\` and Master Spec v0.1 (unchanged). Regenerate; do not edit by hand.\n`;
{
  const L = [HEADER(meta.title)];
  L.push("## K2 — status: **PARTIALLY RESOLVED**\n", `Recorded ${K2.recorded} · ${K2.decidedBy}. v0.1 text: ${K2.v01Text}\n`);
  L.push(table(["Resolved (design / construction intent)", "Unresolved"], Array.from({ length: Math.max(K2.resolved.length, K2.unresolved.length) }, (_, i) => [K2.resolved[i] ?? "", K2.unresolved[i] ?? ""])));
  L.push("", `**${K2.notApproved}** ${K2.sampleScope}\n`);
  L.push("## Rule\n", meta.rule, "");
  L.push("## Sleeve material policy\n", `Design intent: **${LEATHER_POLICY.designIntent}**. Synthetic / PU or other options: **${LEATHER_POLICY.alternatives}**. ${LEATHER_POLICY.rule}\n`);
  L.push("## Open product / construction alignment items\n", `${OPEN_ALIGNMENT.join(", ")} stay open until product and construction are aligned (see Contradictions). Website not changed.\n`);
  L.push("## Matrix\n");
  L.push(table(["ID", "Component", "Design intent", "Current source", "Material", "Construction", "Status", "Final authority", "Supplier input", "Pattern-maker input", "Sample validation", "Unresolved"], COMPONENTS.map((c) => [c.id, c.name, `${c.designIntent} (${c.intentStatus})`, c.currentSource.join("; "), fv(c.material), fv(c.construction), c.status, c.finalAuthority, c.supplierInput.join("; "), c.patternMakerInput.join("; "), c.sampleValidation.join("; "), c.unresolved.join("; ")])));
  L.push("\n## Specification fields per component\n", "Every field without a value is open. No value comes from S.i., Golden Bear or a drawing.\n");
  for (const c of COMPONENTS) {
    L.push(`### ${c.id} ${c.name}\n`, `BOM: ${c.bom.join(", ")} · construction ops: ${c.con.join(", ")}${c.contradictions.length ? ` · contradictions: ${c.contradictions.join(", ")}` : ""}${c.reference ? `\n\nReference: ${c.reference}` : ""}\n`);
    L.push(table(["Field", "Value", "Status", "Note"], Object.entries(c.spec).map(([k, f]) => [k, f.value ?? "—", f.status, f.note ?? ""])), "");
  }
  L.push("## Embroidery construction (separate from placement)\n", `Placement — zones, normalised scale and offset — is unchanged (Master Spec v0.1 \`embroideryZones\`). This section covers only how the artwork is physically made. Every field is ${STATUS.SUPPLIER}.\n`);
  L.push(table(["Substrate", "Zones"], EMBROIDERY_SUBSTRATES.map((s) => [s.substrate, s.zones.join(", ")])), "");
  L.push(table(["Artwork type", "Evidence (not a specification)", ...EMBROIDERY_FIELDS], EMBROIDERY_TYPES.map((t) => [`${t.type} — ${t.name}`, t.evidence, ...EMBROIDERY_FIELDS.map(() => "TBD")])), "");
  L.push("## Audit — every current material / construction field\n", "approved = no for every row.\n");
  L.push(table(["Field / component", "Current value", "Source", "Customer-selected", "Inferred", "Supplier-defined", "Approved", "Contradiction"], AUDIT.map((a) => [a.field, a.value, SOURCES[a.source], yn(a.customer), yn(a.inferred), yn(a.supplier), "no", a.conflict ?? "—"])), "");
  L.push("## Contradictions\n");
  L.push(table(["ID", "Status", "Topic", "Between", "Detail", "Handling"], CONTRADICTIONS.map((x) => [x.id, x.status, x.topic, x.between.map((b) => SOURCES[b] ? b : b).join(", "), x.detail, x.action])), "");
  L.push("## Source key\n", table(["Key", "Source"], Object.entries(SOURCES)), "");
  writeFileSync(join(SPEC_DIR, "material-construction-matrix-v0.1.md"), L.join("\n") + "\n");
}
{
  const L = [`# JACKETEK — Factory Material Proposal Request\n\n**For the M sample request. VALIDATION DRAFT — nothing here is approved.** Generated ${AUDITED} by \`scripts/materials/material-matrix.mjs\`; matrix: \`garment-spec/material-construction-matrix-v0.1.md\`.\n`];
  L.push("## What JACKETEK has decided\n");
  L.push("- **Body shell: Cotton Fabric** (design intent).", "- **Sleeves: Leather** (design intent). Please propose the leather. Synthetic / PU may be offered only as a clearly labelled **ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT**, with its cost, MOQ, performance and appearance differences. It does not replace Leather without JACKETEK's explicit approval.", "- Varsity **knitted rib** collar, cuffs and waistband, matching, **striped colourway supported**.", "- **Metal snap** front closure, in four finishes: black, silver, gold, gunmetal.", "- **Lining required** (body and sleeves).", "- Two front angled **welt pockets**. Welt material: **FACTORY TO PROPOSE / JACKETEK TO APPROVE** (X-04 open); the drawings show the welts in the sleeve material — a visual reference / option only.", "- **Dropped shoulder** (K1). Measurements: see the M sample validation plan.", "- Embroidery in fixed zones: 4 on the cotton body, 6 on the leather sleeves.", "");
  L.push("## What we ask you to propose\n", "For every item, give the value, the reason, and any alternative with its price impact. Where you propose options, please number them.\n");
  for (const g of FACTORY_REQUEST) L.push(`### ${g.group} (${g.component})\n`, ...g.items.map((i) => `- [ ] ${i}`), "");
  L.push("## Please also tell us\n", "- Minimum order quantity per material and colour.", "- Lead time for the M sample and for production.", "- Physical swatches you can send (fabric, leather options, rib with stripes, lining, snaps in all four finishes).", "- Any construction you recommend for joining leather sleeves to the cotton body and to the rib cuffs.", "");
  L.push("## Not to be used\n", "- Values printed in the S.i. Graphics template (e.g. 100% wool, 2×1 cotton rib 350 GSM, cotton thread) are template examples, not JACKETEK specifications.", "- Golden Bear construction (melton wool, quilted satin lining, set-in sleeve) is a fit reference only.", "- The legacy production-drawing PDF is not a factory document.", "");
  L.push("## After the sample\n", "JACKETEK approves materials and construction only after the physical M sample is checked: hand feel, colour match, rib stretch and recovery, snap attachment and force, seam quality, embroidery on cotton and on leather.");
  writeFileSync(join(SPEC_DIR, "factory-material-proposal-request.md"), L.join("\n") + "\n");
}

// ------------------------------------------------------------- review images
const out = join(ROOT, REVIEW);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
canonicalFlat(); // throws if the working flat is missing
const BROWSER = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!BROWSER) throw new Error("Chrome / Edge not found for the review images");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Map colours: a code per component, not a garment colour.
const MAP = { body: "#7fa6d6", sleeves: "#8b5a2b", rib: "#3f8f5a", stripe: "#bfe3c8", welt: "#e0a040", snap: "#c00000", grey: "#e6e6e6", greyDark: "#c8c8c8" };
const CSS = `*{box-sizing:border-box}body{margin:0;font:12px/1.35 Arial,Helvetica,sans-serif;color:#111;background:#fff}.pg{padding:24px 32px}
h1{font-size:20px;margin:0 0 2px}.sub{color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9c9c9;padding:3px 6px;vertical-align:top;text-align:left}th{background:#f0f0f0;font-size:11px}
.badge{float:right;border:2px solid #b00;color:#b00;font-weight:700;padding:3px 8px;font-size:11px}.foot{margin-top:10px;color:#666;font-size:10px;border-top:1px solid #ccc;padding-top:5px}
.row{display:flex;gap:18px;align-items:flex-start}.sw{display:inline-block;width:12px;height:12px;border:1px solid #555;vertical-align:-2px;margin-right:5px}
.ok{color:#1e6b3a;font-weight:700}.tbd{color:#a07800;font-weight:700}.ref{color:#777}.x{color:#b00;font-weight:700}.small{font-size:10.5px;color:#444}.cap{font-size:10px;color:#555;text-align:center}`;
const FOOT = `<div class="foot">JACKETEK · material / construction review v0.1 (K2 — PARTIALLY RESOLVED) · ${AUDITED} · Master Spec v0.1 unchanged; plan in v0.2 · VALIDATION DRAFT — NOT PRODUCTION APPROVED · map colours identify components, not garment colours · drawing not to scale</div>`;
const page = (title, sub, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="pg"><span class="badge">NOT PRODUCTION APPROVED</span><h1>${esc(title)}</h1><div class="sub">${sub}</div>${body}${FOOT}</div></body></html>`;
const shots = [];
const shot = (name, html, h = 794) => {
  const f = join(out, `${name}.html`);
  writeFileSync(f, html);
  execFileSync(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--screenshot=${join(out, `${name}.png`)}`, `--window-size=1123,${h}`, pathToFileURL(f).href], { stdio: "ignore" });
  rmSync(f);
  shots.push(`${name}.png`);
};
const fills = (o = {}) => ({ body: MAP.grey, sleeves: MAP.grey, rib: MAP.greyDark, stripe: MAP.grey, welt: MAP.greyDark, snap: "#888", ...o });
const ALL = fills({ body: MAP.body, sleeves: MAP.sleeves, rib: MAP.rib, stripe: MAP.stripe, welt: MAP.welt, snap: MAP.snap });
const fig = (svg, cap) => `<div><div>${svg}</div><div class="cap">${esc(cap)}</div></div>`;
const st = (s) => (/DESIGN_INTENT|CONSTRUCTION_INTENT|REQUIRED|VISUAL_INTENT/.test(s) && !/^TBD/.test(s) ? `<span class="ok">${esc(s)}</span>` : /REFERENCE/.test(s) ? `<span class="ref">${esc(s)}</span>` : `<span class="tbd">${esc(s)}</span>`);
const comp = (id) => COMPONENTS.find((c) => c.id === id);
const specTable = (cs) => `<table><tr><th>Component</th><th>Field</th><th>Value</th><th>Status</th></tr>${cs.flatMap((c) => Object.entries(c.spec).map(([k, f], i) => `<tr>${i === 0 ? `<td rowspan="${Object.keys(c.spec).length}"><b>${c.id}</b><br>${esc(c.name)}<br><span class="small">intent: ${esc(c.designIntent)}</span></td>` : ""}<td>${esc(k)}</td><td>${f.value === null ? "—" : esc(f.value)}</td><td>${st(f.status)}${f.note ? `<br><span class="small">${esc(f.note)}</span>` : ""}</td></tr>`)).join("")}</table>`;

// 01 material map
{
  const legend = [["body", "K2.1 Body shell — Cotton Fabric", "DESIGN_INTENT"], ["sleeves", "K2.2 Sleeves — Leather", "DESIGN_INTENT"], ["rib", "K2.4–K2.6 Knitted rib (collar, cuffs, waistband, tab)", "CONSTRUCTION_INTENT"], ["stripe", "Rib stripes — striped colourway supported", "CONSTRUCTION_INTENT"], ["welt", "K2.8 / K2.9 Welt pockets — welt material OPEN (X-04): factory to propose / JACKETEK to approve", "TBD_SUPPLIER_PROPOSAL"], ["snap", "K2.7 Metal snaps", "CONSTRUCTION_INTENT"]];
  const leg = `<table><tr><th>Map colour</th><th>Component</th><th>Status</th></tr>${legend.map(([k, t, s]) => `<tr><td><span class="sw" style="background:${MAP[k]}"></span></td><td>${esc(t)}</td><td>${st(s)}</td></tr>`).join("")}<tr><td>—</td><td>K2.3 Lining (inside, not visible)</td><td>${st("REQUIRED")} · material ${st("TBD_SUPPLIER_PROPOSAL")}</td></tr><tr><td>—</td><td>K2.10–K2.12 Thread, interlining, embroidery backing</td><td>${st("TBD_PATTERN_MAKER / TBD_SUPPLIER_PROPOSAL")}</td></tr></table><p class="small">Every specification (composition, GSM, thickness, finish, rib knit, snap size, stitch) is open. K2 = <b>PARTIALLY RESOLVED</b>.</p>`;
  shot("01-material-map", page("MATERIAL MAP — K2", "Which material each part of the JACKETEK varsity jacket is intended to be. S.i. canonical flat, recoloured by component.", `<div class="row">${fig(viewSvg("front", { wMm: 92, hMm: 100, fills: ALL, boxes: false, labels: false }), "FRONT")}${fig(viewSvg("back", { wMm: 92, hMm: 100, fills: ALL, boxes: false, labels: false }), "BACK")}<div style="flex:1">${leg}</div></div>`), 740);
}
// 02 shell and sleeves
shot("02-shell-and-sleeves", page("BODY SHELL AND SLEEVES — K2.1 / K2.2", "Design intent decided: body Cotton Fabric, sleeves Leather. Every specification below is for the supplier to propose.", `<div class="row"><div>${fig(viewSvg("front", { wMm: 62, hMm: 68, fills: fills({ body: MAP.body, sleeves: MAP.sleeves }), boxes: false, labels: false }), "BODY (blue) · SLEEVES (brown)")}${fig(sleeveSvg("rightSleeve", { wMm: 62, hMm: 60, fills: fills({ sleeves: MAP.sleeves }), boxes: false, labels: false }), "SLEEVE — LEATHER")}</div><div style="flex:1">${specTable([comp("K2.1"), comp("K2.2")])}<p class="small"><b>Policy:</b> Leather is the design intent; synthetic / PU only as ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT (cost / MOQ / performance / appearance recorded; explicit approval to change). <span class="x">Open:</span> X-01 configurator still offers either material for body and sleeves; X-03 "supple leather that softens with wear". X-02 internal id "felt". Website not changed.</p></div></div>`), 680);
// 03 rib
shot("03-rib-components", page("RIB COMPONENTS — K2.4 / K2.5 / K2.6", "Knitted varsity rib, striped colourway supported, matching collar / cuff / waistband system. Composition, knit, weight, stretch, recovery, thickness, stripe width and gauge: supplier proposal + sample validation.", `<div class="row"><div>${fig(viewSvg("back", { wMm: 70, hMm: 76, fills: fills({ rib: MAP.rib, stripe: MAP.stripe }), boxes: false, labels: false }), "BACK — RIB (green) · STRIPES (light green)")}</div><div style="flex:1"><table><tr><th>ID</th><th>Part</th><th>Intent</th><th>Attachment</th><th>Open fields</th></tr>${["K2.4", "K2.5", "K2.6"].map((id) => { const c = comp(id); return `<tr><td><b>${id}</b></td><td>${esc(c.name)}</td><td>${st(c.intentStatus)}<br><span class="small">${esc(c.designIntent)}</span></td><td>${st(c.construction.status)}<br><span class="small">${esc(c.patternMakerInput.join("; "))}</span></td><td class="small">${Object.keys(c.spec).join(", ")}<br>${st(STATUS.SUPPLIER_SAMPLE)}</td></tr>`; }).join("")}</table><p class="small"><span class="x">X-06:</span> v0.1 BOM09 says the configurator has no stripe option; the 3D preview, RFQ and legacy sheet show stripes in the sleeve colour. The legacy rib heights (6.1 / 4.1 cm) come from 5 strips of the 3D mesh — not a stripe or rib specification.</p><p class="small ref">S.i. template "2X1 Cotton Rib 350GSM" — REFERENCE ONLY (template demo, also in the Blank file).</p></div></div>`), 500);
// 04 lining and closure
shot("04-lining-and-closure", page("LINING AND FRONT CLOSURE — K2.3 / K2.7", "Lining is required; its material is a supplier proposal (quilted vs plain not decided by any evidence). Metal snap front is required; hardware specification is a supplier proposal; count, spacing and tab are for the pattern maker.", `<div class="row"><div>${fig(viewSvg("front", { wMm: 66, hMm: 72, fills: fills({ snap: MAP.snap, rib: MAP.greyDark }), boxes: false, labels: false }), "FRONT — SNAPS (red)")}</div><div style="flex:1">${specTable([comp("K2.3"), comp("K2.7")])}<p class="small"><span class="x">X-05:</span> legacy sheet 7 snaps (5 + 2 on the tab) vs S.i. flat 6 marks (5 + 1 on the waistband) — count TBD_PATTERN_MAKER. <span class="x">X-07:</span> Golden Bear quilted satin acetate and S.i. "internal quilting" are references only.</p><p class="small">Sample confirms: snap colour, finish, spacing, attachment quality, opening / closing force.</p></div></div>`), 720);
// 05 pockets
{
  const F = canonicalFlat().views.front;
  const pk = F.landmarks.pockets.map((q) => q.map(([x, y]) => `(${x.toFixed(1)}, ${y.toFixed(1)})`).join(" "));
  shot("05-pocket-construction", page("POCKET CONSTRUCTION — K2.8 / K2.9", "What the drawing shows, and what it does not. Pocket type is drawing evidence; the build is for the pattern maker.", `<div class="row"><div>${fig(viewSvg("front", { wMm: 78, hMm: 84, fills: fills({ welt: MAP.welt }), boxes: false, labels: false }), "FRONT — WELTS (orange)")}</div><div style="flex:1"><table><tr><th>Item</th><th>Finding</th><th>Status</th></tr>
<tr><td>Pocket type</td><td>Two front welt pockets, one per front panel; single angled welt with a topstitched outline (S.i. layers <i>pockets</i>, <i>pocket-stitch</i>; legacy flat "slanted welts")</td><td>${st("VISUAL_INTENT")}</td></tr>
<tr><td>Angle</td><td>Long axis near vertical; upper end toward centre front (as drawn). Angle value: P05, measured on the sample</td><td>${st("VISUAL_INTENT")}</td></tr>
<tr><td>Opening direction / edge</td><td>Not shown on any drawing</td><td>${st("TBD_PATTERN_MAKER")}</td></tr>
<tr><td>Welt / trim material</td><td>3D model and legacy sheet: sleeve material; RFQ drawings colour welts as the sleeves (visual reference / option only); v0.1 BOM13 "leather or shell fabric". OPEN (X-04): FACTORY TO PROPOSE / JACKETEK TO APPROVE</td><td>${st("TBD_SUPPLIER_PROPOSAL")}</td></tr>
<tr><td>Pocket bag</td><td>Required by a welt pocket (v0.1 BOM12 pocketing); material and size open</td><td>${st("TBD_SUPPLIER_PROPOSAL")} / ${st("TBD_PATTERN_MAKER")}</td></tr>
<tr><td>Bartacks / welt build</td><td>CON11</td><td>${st("TBD_PATTERN_MAKER")}</td></tr>
<tr><td>Inside pocket</td><td>v0.1 L04 undecided; S.i. template "internal welt pocket" is template content (X-09)</td><td>${st("UNKNOWN")}</td></tr></table>
<p class="small">S.i. pocket landmarks (drawing units, not to scale, never converted to cm): ${esc(pk.join(" · "))}</p></div></div>`), 560);
}
// 06 unresolved
{
  const rows = FACTORY_REQUEST.map((g) => `<tr><td><b>${esc(g.group)}</b><br><span class="small">${esc(g.component)}</span></td><td class="small">${esc(g.items.join(" · "))}</td></tr>`).join("");
  const xs = CONTRADICTIONS.map((x) => `<tr><td><b>${x.id}</b>${OPEN_ALIGNMENT.includes(x.id) ? "<br><span class='x'>OPEN</span>" : ""}</td><td>${esc(x.topic)}</td><td class="small">${esc(x.action)}</td></tr>`).join("");
  shot("06-unresolved-factory-inputs", page("UNRESOLVED — FACTORY INPUTS", `K2 = PARTIALLY RESOLVED. ${counts.specFields} specification fields: ${counts.specFieldsWithValue} carry a value (pocket type, sleeve attachment — text from drawings / K1), the rest are open. Sent with the M sample request: garment-spec/factory-material-proposal-request.md`, `<div class="row"><div style="flex:1"><table><tr><th>Factory proposes</th><th>Items</th></tr>${rows}</table></div><div style="flex:1"><table><tr><th>ID</th><th>Contradiction</th><th>Handling</th></tr>${xs}</table></div></div>`), 740);
}

writeFileSync(join(out, "material-construction-review.json"), JSON.stringify({ ...meta, images: shots, k2: { status: K2.status, resolved: K2.resolved, unresolved: K2.unresolved }, counts, bodyMaterial: comp("K2.1").material, sleeveMaterial: comp("K2.2").material, leatherPolicy: LEATHER_POLICY, contradictions: CONTRADICTIONS.map(({ id, topic, status }) => ({ id, topic, status })), matrix: "garment-spec/material-construction-matrix-v0.1.json", factoryRequest: "garment-spec/factory-material-proposal-request.md" }, null, 1) + "\n");
console.log(`material-construction matrix: ${counts.components} components, ${counts.specFields} spec fields (${counts.specFieldsWithValue} with a value), ${counts.contradictions} contradictions; ${shots.length} review images → ${REVIEW}`);
