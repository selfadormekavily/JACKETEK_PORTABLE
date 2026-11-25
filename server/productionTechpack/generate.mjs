// Customer Production Tech Pack: ONE active garment master + ONE frozen, customer-approved order line
// → one PDF for that jacket. SERVER-SIDE ONLY.
//
//   <DATA_DIR>/production-techpacks/<ORDER_ID>/<JACKET_ID>/<MASTER_REV>-<SNAPSHOT12>/
//     JACKETEK_Production_Tech_Pack_<JACKET_ID>.pdf
//     snapshot.json          the frozen order line exactly as approved (its SHA-256 = the approval's)
//     production-spec.json   what the PDF states (customer section + master references)
//     artwork/               the artwork files the PDF shows
//     manifest.json          hashes of every file above + master registry hash
//
// Rules: generated only for an approved line whose stored snapshot still has the approved hash; the
// master's pinned files must verify; a folder is written once (staging → rename) and never replaced;
// a retry with the same master + snapshot returns the existing PDF.
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withColourways } from "../colourways.mjs";
import { withLibraryAssets } from "../libraryAssets.mjs";
import { DATA_DIR, getOrder } from "../orders.mjs";
import { decodeImageDataUrl } from "../rfq/generate.mjs";
import { withTextArtwork } from "../textArtwork.mjs";
import { loadGeometry } from "./geometry.mjs";
import { loadMaster } from "./master.mjs";
import { ASSET_URLS, renderProductionTechPack } from "./render.mjs";
import * as store from "./store.mjs";

const run = promisify(execFile);
export const OUT_DIR_NAME = "production-techpacks";
export const pdfNameOf = (jacketId) => `JACKETEK_Production_Tech_Pack_${jacketId}.pdf`;
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

export class TechPackError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const r2 = (v) => Math.round(v * 100) / 100;
const TYPE_LABEL = { text: "Text lettering", "front-letters": "Front letters", library: "Library design", upload: "Customer upload" };

/** Customer's in-zone offset → centre on the R2 pattern piece (see the placement statuses in render.mjs). */
function placeOnPattern(g, ref) {
  if (!g.fixedZone) return { status: "LEGACY_ZONE", centreCm: null, frame: null, rotationDeg: null, deltaCm: null, note: null };
  if (!ref) return { status: "NO_R2_REFERENCE", centreCm: null, frame: null, rotationDeg: null, deltaCm: null, note: "R2 has artwork positions for the zones the reference design used only." };
  const d = [r2(g.offsetCm[0] - ref.referenceInZoneOffsetCm[0]), r2(g.offsetCm[1] - ref.referenceInZoneOffsetCm[1])];
  const base = { frame: ref.frame, rotationDeg: ref.referenceRotationDeg, deltaCm: d };
  if (Math.abs(d[0]) < 0.05 && Math.abs(d[1]) < 0.05) return { ...base, status: "R2_REFERENCE_EXACT", centreCm: ref.referenceCentreCm, deltaCm: null, note: null };
  const sleeve = g.side === "leftSleeve" || g.side === "rightSleeve";
  if (sleeve)
    return { ...base, status: "SLEEVE_OFFSET_NOT_TRANSFERABLE", centreCm: ref.referenceCentreCm, note: `Centre shown = R2 reference. The customer's artwork sits ${d[0]} cm across / ${d[1]} cm up from it on the website sleeve; the sleeve curves, so the pattern maker transfers it on the pattern.` };
  // Body zones: website zone frame → piece frame. Front: x from CF toward the side seam (left chest +x, right chest −x);
  // back: + wearer's left (zone x mirrored); y: cm below HPS (website +y is up).
  const sx = g.zoneId === "rightChest" ? -1 : g.side === "back" ? -1 : 1;
  return {
    ...base,
    status: "DERIVED_FROM_R2_REFERENCE",
    centreCm: { x: r2(ref.referenceCentreCm.x + sx * d[0]), y: r2(ref.referenceCentreCm.y - d[1]) },
    note: "R2 reference centre moved by the customer's offset measured on the website surface (flat approximation).",
  };
}

function threadsOf(e, catalog) {
  if (e.kind === "text") {
    const t = catalog.thread(e.thread);
    return [{ label: "Fill (text)", name: t?.name ?? e.thread ?? null, hex: t?.hex ?? e.threadHex ?? null }];
  }
  if (e.image?.colourway)
    return e.image.colourway.slots.map((s) => {
      const t = catalog.thread(e.image.colourway.colours[s.id]);
      return t ? { label: s.label, name: t.name, hex: t.hex } : { label: s.label, name: `As designed${s.defaultThread ? ` (${s.defaultThread})` : ""}`, hex: s.defaultColor ?? null };
    });
  if (e.thread) {
    const t = catalog.thread(e.thread);
    return [{ label: "Single thread", name: t?.name ?? e.thread, hex: t?.hex ?? null }];
  }
  return [];
}

/** The production spec of one approved order line (pure: no files written). */
export async function buildProductionSpec({ order, line, approval, master, masterSha256, snapshot }) {
  const G = await loadGeometry();
  const { catalog } = G;
  const item = order.items[line];
  const c = item.customization ?? {};
  const refs = new Map(master.zoneReferences.map((z) => [z.zoneId, z]));
  const pieceOf = (g) => refs.get(g.zoneId)?.piece ?? { front: g.zoneId === "rightChest" ? "JKT_FRONT_R" : "JKT_FRONT_L", back: "JKT_BACK", leftSleeve: "JKT_SLEEVE_L", rightSleeve: "JKT_SLEEVE_R" }[g.side] ?? null;

  const colour = (z) => catalog.colour(c.colours?.[z]);
  const body = colour("body"), sleeves = colour("sleeves"), trim = colour("trim");
  const bodyMat = catalog.material(c.materials?.body), sleeveMat = catalog.material(c.materials?.sleeves);
  const snaps = catalog.finish(c.buttons);
  const entry = (role, col, material, basis) => ({ role, name: col?.name ?? null, hex: col?.hex ?? null, id: col?.id ?? null, material, basis });
  const colourway = [
    entry("Body (back, fronts, waistband tabs)", body, bodyMat, "Customer selection"),
    entry("Sleeves", sleeves, sleeveMat, "Customer selection"),
    entry("Rib — collar, cuffs, waistband (base)", trim, "Knitted rib", "Customer selection (trim)"),
    entry("Rib stripes", sleeves, "Knitted rib", "Follows the sleeve colour (configurator 3D view; master R2 §9 band layout)"),
    entry("Pocket welts", sleeves, "To be proposed (FC-04)", "Sleeve colour (master R2 §5 M7, PROPOSED)"),
    { role: "Snaps (7)", name: snaps ? `${snaps.name} finish` : null, hex: snaps?.hex ?? null, id: snaps?.id ?? null, material: "Metal snap (FC-06)", basis: "Customer selection" },
  ];

  const sourceKind = (e) => (e.kind === "text" ? "text" : e.image?.frontLetters ? "front-letters" : e.image?.library ? "library" : "upload");
  const artwork = [];
  for (const e of c.embroidery ?? []) {
    if (e.kind === "text" && !e.text?.trim()) continue;
    if (e.kind === "image" && !e.image?.src) continue;
    const g = G.artworkGeometry(e);
    const ref = refs.get(g.zoneId);
    const n = artwork.length + 1;
    const text = e.kind === "text" ? e.text.replace(/\r\n?/g, "\n") : null;
    artwork.push({
      n,
      artworkId: `ART-${String(n).padStart(2, "0")}-${g.productionKey}`,
      elementId: e.id,
      zoneId: g.zoneId,
      zoneName: g.zoneName,
      piece: pieceOf(g),
      kind: sourceKind(e),
      typeLabel: TYPE_LABEL[sourceKind(e)],
      libraryCode: e.image?.library?.productionName ?? null,
      text: text === null ? null : { content: text, lineCount: text.split("\n").length, font: e.textStyle?.fontName ?? "not recorded", direction: e.textStyle?.direction ?? "ltr" },
      threads: threadsOf(e, catalog),
      sizeCm: g.sizeCm,
      offsetCm: g.offsetCm,
      placement: placeOnPattern(g, ref),
      flatCallout: g.fixedZone && ref ? ref.flatCallout : null,
      file: null,
      pixels: null,
    });
  }

  const warnings = [];
  if (master.approval.status !== "APPROVED") warnings.push(`Master ${master.style.id} Rev ${master.revision} is PENDING OWNER APPROVAL — sample development only, not released for bulk production.`);
  warnings.push(`Size ${item.size ?? "—"}: master ${master.revision} is drafted in one base size (${master.baseSize}); grading is MISSING. Do not cut size ${item.size ?? "—"} until the owner approves grading.`);
  warnings.push("Patterns are the sew line only: add the confirmed seam allowance (FC-01) before cutting.");
  const notExact = artwork.filter((a) => a.placement.status !== "R2_REFERENCE_EXACT");
  if (notExact.length) warnings.push(`Artwork ${notExact.map((a) => a.n).join(", ")}: position not identical to the R2 reference — see each artwork's placement status.`);
  warnings.push("Every artwork: technique, digitizing and strike-off per FC-07 before production.");

  const bom = master.bomRows.map((b) => {
    const v = {
      body: colourway[0].name ? `${colourway[0].material ?? "—"} · ${colourway[0].name} (${colourway[0].hex})` : null,
      sleeves: colourway[1].name ? `${colourway[1].material ?? "—"} · ${colourway[1].name} (${colourway[1].hex})` : null,
      rib: trim && sleeves ? `Base ${trim.name} (${trim.hex}) with ${sleeves.name} (${sleeves.hex}) stripes` : null,
      snaps: snaps ? `${snaps.name} finish (${snaps.hex})` : null,
      welts: sleeves ? `${sleeves.name} (${sleeves.hex}) — material to be proposed` : null,
      artwork: artwork.length ? `${artwork.length} artwork(s), section 3` : "No artwork",
    }[b.customerField];
    return { id: b.id, component: b.component, placement: b.placement, customerValue: v ?? null };
  });

  return {
    schema: "jacketek.production-techpack/1",
    document: { type: "CUSTOMER_PRODUCTION_TECH_PACK", banner: master.approval.status === "APPROVED" ? "PRODUCTION TECH PACK" : "MASTER PENDING OWNER APPROVAL — NOT FOR BULK PRODUCTION" },
    jacket: { jacketId: approval.jacketId, orderId: order.id, line: line + 1, quantity: item.quantity, size: item.size ?? null, productName: item.productName },
    approval: { method: approval.method, reference: approval.reference, approvedAt: approval.approvedAt, snapshotSha256: approval.snapshotSha256, designSha256: snapshot.designSha256 },
    master: {
      style: master.style.id, revision: master.revision, engineeringRevision: master.engineeringRevision, revisionDate: master.revisionDate, baseSize: master.baseSize,
      grading: master.grading.note, approvalStatus: master.approval.status, registry: "garment-spec/ACTIVE_TECHPACK_MASTER.json", registrySha256: masterSha256, supplierPackage: master.supplierPackage.path,
    },
    garment: { fit: catalog.fit(c.fit), colourway },
    bom,
    artwork,
    basePoms: master.keyPoms,
    // The master's wording names the reference jacket's colours; for this jacket it points to its own colourway.
    factoryConfirmation: master.factoryConfirmation.map((f) => ({ ...f, detail: f.detail.replace(/for Black #171717 and Burgundy #64152B/g, "for this jacket's colours (section 2)").replace(/gunmetal finish reference/g, "snap finish reference (section 2)") })),
    sections: master.supplierTechPackSections,
    warnings,
  };
}

const browser = () => {
  const b = BROWSERS.find((p) => existsSync(p));
  if (!b) throw new TechPackError("No Chrome / Edge available to print the PDF.", 500);
  return b;
};

async function printPdf(htmlFile, pdfFile, profile) {
  const common = ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000", `--user-data-dir=${profile}`];
  // Layout check first: any page whose content does not fit → no PDF (never a clipped document).
  const { stdout } = await run(browser(), [...common, "--dump-dom", pathToFileURL(htmlFile).href], { maxBuffer: 64 * 1024 * 1024 });
  if (!/data-ready="1"/.test(stdout)) throw new TechPackError("Layout check did not complete; PDF not printed.", 500);
  const overflow = /data-overflow="([^"]*)"/.exec(stdout)?.[1] ?? "";
  if (overflow) {
    if (process.env.PTP_DEBUG_HTML) writeFileSync(process.env.PTP_DEBUG_HTML, readFileSync(htmlFile)); // development aid
    throw new TechPackError(`Layout: content does not fit on page(s) ${overflow}; PDF not printed.`, 500);
  }
  await run(browser(), [...common, `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href], { maxBuffer: 64 * 1024 * 1024 });
  if (!existsSync(pdfFile)) throw new TechPackError("The browser did not write the PDF.", 500);
  return (readFileSync(pdfFile).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

let queue = Promise.resolve();
/** Serialised: one generation at a time (Chrome, and no two writers for the same jacket). */
export function generateJacketTechPack(orderId, line, opts = {}) {
  const job = queue.then(() => generate(orderId, line, opts));
  queue = job.catch(() => {});
  return job;
}

async function generate(orderId, line, { dataDir = DATA_DIR, now = () => new Date() } = {}) {
  const order = getOrder(orderId);
  if (!order) throw new TechPackError("Order not found.", 404);
  if (!Number.isInteger(line) || line < 0 || line >= order.items.length) throw new TechPackError("Order line not found.", 404);
  const approval = store.getApproval(orderId, line);
  if (!approval) throw new TechPackError(`Line ${line + 1} has no recorded customer design approval; nothing was generated.`, 409);
  const snapshot = store.snapshotOf(order, line);
  const snap = store.snapshotHash(snapshot);
  if (snap !== approval.snapshotSha256) throw new TechPackError(`The stored design of line ${line + 1} no longer matches the approved snapshot; nothing was generated.`, 409);

  const { master, sha256: masterSha256, path: masterPath } = loadMaster();
  const key = { jacketId: approval.jacketId, orderId, line, masterRevision: master.revision, masterSha256, snapshotSha256: snap };
  const outRoot = join(dataDir, OUT_DIR_NAME);
  const jacketDir = join(outRoot, orderId, approval.jacketId);
  const folder = `${master.revision}-${snap.slice(0, 12)}`;
  const finalDir = join(jacketDir, folder);
  const pdfName = pdfNameOf(approval.jacketId);

  // Idempotent: an existing generated pack for this master + snapshot is returned, never rewritten.
  const existing = store.getPack(key.jacketId, key.masterRevision, snap);
  if (existing?.status === "GENERATED") {
    const file = join(dataDir, existing.dir, existing.pdfName);
    if (!existsSync(file) || store.sha256(readFileSync(file)) !== existing.pdfSha256) throw new TechPackError(`The generated PDF of ${key.jacketId} is missing or altered (${existing.dir}); it is not regenerated automatically.`, 500);
    return { ...existing, reused: true };
  }
  store.startPack(key, now().toISOString());
  if (existsSync(finalDir)) {
    // A previous run wrote the folder but not the record (e.g. a crash): adopt it if its manifest verifies.
    const m = JSON.parse(readFileSync(join(finalDir, "manifest.json"), "utf8"));
    const pdfSha = store.sha256(readFileSync(join(finalDir, pdfName)));
    if (m.snapshotSha256 !== snap || m.files[pdfName] !== pdfSha) throw new TechPackError(`${folder} exists but does not match; nothing was overwritten.`, 409);
    store.finishPack(key, { dir: relative(dataDir, finalDir).replaceAll("\\", "/"), pdfName, pdfSha256: pdfSha, htmlSha256: m.htmlSha256, pages: m.pages, generatedAt: m.generatedAt });
    return { ...store.getPack(key.jacketId, key.masterRevision, snap), reused: true };
  }

  mkdirSync(jacketDir, { recursive: true });
  const stage = join(jacketDir, `.staging-${snap.slice(0, 12)}-${process.pid}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "artwork"), { recursive: true });
  try {
    const spec = await buildProductionSpec({ order, line, approval, master, masterSha256, snapshot });
    // Artwork files resolved on the server from the stored order (library files, text drawn in its font, colourways).
    const resolved = await withColourways(await withTextArtwork(withLibraryAssets({ ...order, items: [order.items[line]] })));
    const els = new Map((resolved.items[0].customization?.embroidery ?? []).map((e) => [e.id, e]));
    const files = {};
    for (const a of spec.artwork) {
      const e = els.get(a.elementId);
      const src = e?.kind === "text" ? e.textArtwork?.src : e?.image?.src;
      if (!src?.startsWith("data:")) continue;
      const img = decodeImageDataUrl(src, a.artworkId);
      a.file = `artwork/${a.artworkId}.${img.ext}`;
      a.pixels = img.pixelSize ? [img.pixelSize.width, img.pixelSize.height] : null;
      writeFileSync(join(stage, a.file), img.buf);
    }
    writeFileSync(join(stage, "snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
    writeFileSync(join(stage, "production-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
    const { html, pages: planned } = renderProductionTechPack(spec);
    const work = join(stage, ".print");
    mkdirSync(work);
    copyFileSync(masterPath("technical flat — front"), join(work, ASSET_URLS.flatFront));
    copyFileSync(masterPath("technical flat — back"), join(work, ASSET_URLS.flatBack));
    writeFileSync(join(work, "techpack.html"), html);
    const pages = await printPdf(join(work, "techpack.html"), join(stage, pdfName), join(work, "profile"));
    rmSync(work, { recursive: true, force: true });
    if (pages !== planned) throw new TechPackError(`Layout: printed ${pages} pages, planned ${planned} — some content overflowed; PDF not issued.`, 500);

    const generatedAt = now().toISOString();
    for (const d of readdirSync(stage, { withFileTypes: true, recursive: true })) {
      if (!d.isFile()) continue;
      const p = join(d.parentPath ?? d.path, d.name);
      files[relative(stage, p).replaceAll("\\", "/")] = store.sha256(readFileSync(p));
    }
    const manifest = { schema: "jacketek.production-techpack-manifest/1", jacketId: key.jacketId, orderId, line: line + 1, masterRevision: master.revision, masterRegistrySha256: masterSha256, snapshotSha256: snap, htmlSha256: store.sha256(html), pages, generatedAt, files };
    writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    if (existsSync(finalDir)) throw new TechPackError(`${folder} already exists; nothing was overwritten.`, 409);
    renameSync(stage, finalDir);
    store.finishPack(key, { dir: relative(dataDir, finalDir).replaceAll("\\", "/"), pdfName, pdfSha256: files[pdfName], htmlSha256: manifest.htmlSha256, pages, generatedAt });
    return { ...store.getPack(key.jacketId, key.masterRevision, snap), reused: false };
  } catch (err) {
    rmSync(stage, { recursive: true, force: true });
    store.failPack(key, err.message);
    throw err;
  }
}

/** Absolute path of a generated PDF (validated against the DB record), or null. */
export function packPdfFile(orderId, jacketId, folder, { dataDir = DATA_DIR } = {}) {
  const rec = store.listPacks(orderId).find((p) => p.jacketId === jacketId && p.status === "GENERATED" && p.dir?.endsWith(`/${folder}`));
  if (!rec) return null;
  const file = resolve(dataDir, rec.dir, rec.pdfName);
  return file.startsWith(resolve(dataDir, OUT_DIR_NAME)) && existsSync(file) ? file : null;
}
