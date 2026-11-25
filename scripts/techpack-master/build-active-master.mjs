#!/usr/bin/env node
// Writes garment-spec/ACTIVE_TECHPACK_MASTER.json: the ONE authoritative base-garment master that every
// customer Production Tech Pack is generated against (server/productionTechpack/).
//
//   node scripts/techpack-master/build-active-master.mjs            (re-run after the R2 package is regenerated)
//
// It does not copy the master: it pins the R2 package and its engineering data by SHA-256, and extracts
// only what the customer generator needs (base-size key POMs, factory confirmation items, the R2
// reference artwork placements, the flat-view callout positions). Every value comes from an R2 file;
// nothing is typed in by hand except the supplier-tech-pack section map and the BOM row labels, which are
// copied verbatim from the R2 Supplier Tech Pack (sections listed below).
//
// Approval: R2 is the latest ENGINEERING revision (owner-requested CHG-04, 2026-10-28). No owner
// production approval is recorded anywhere, so the status is PENDING_OWNER_APPROVAL. Change `approval`
// only by passing --approved-by "<name>" --approved-at <ISO date> after the owner's explicit decision.
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGeometry } from "../../server/productionTechpack/geometry.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "garment-spec/ACTIVE_TECHPACK_MASTER.json");
const PKG = "garment-spec/JACKETEK_SUPPLIER_PACKAGE_R2";
const ENG = "garment-spec/JACKETEK_FACTORY_MASTER_ORIG_R2";
const TR = `${ENG}/traceability`;
const REF_DESIGN = "garment-spec/JACKETEK_R2_BUILD_SOURCES/reference-design/D-59a2a5aab079/DEV-01/design-config.json";

const sha = (rel) => createHash("sha256").update(readFileSync(join(ROOT, rel))).digest("hex");
const pin = (rel, role) => ({ path: rel, role, bytes: statSync(join(ROOT, rel)).size, sha256: sha(rel) });
const json = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8").replace(/^﻿/, ""));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};

const verification = json(`${TR}/supplier-package-verification.json`);
const packageFiles = verification.files.map((rel) => pin(`${PKG}/${rel.replaceAll("\\", "/")}`, "supplier package"));
const failed = verification.checks.filter((c) => c.result !== "PASS" && c.result !== "NOTE");
if (failed.length) throw new Error(`R2 package verification has failing checks: ${failed.map((c) => c.check).join("; ")}`);

const data = json(`${TR}/factory-master-data.json`);
const chg04 = json(`${TR}/design-change-CHG-04.json`);
const manifest = json(`${TR}/supplier-build/artwork-manifest.json`);
const callouts = json(`${TR}/supplier-build/callouts.json`);
const confirm = json(`${TR}/supplier-build/confirm-items.json`);

// R2 reference placements: CHG-04 artwork centres (pattern piece frames) for the reference design's
// elements, with that design's in-zone size / offset recomputed by the LIVE configurator code. A customer
// artwork that uses the same zone is placed relative to this reference.
const G = await loadGeometry();
const ref = json(REF_DESIGN);
const refByZone = new Map(ref.config.embroidery.map((e) => [e.placement, G.artworkGeometry(e)]));
const calloutFor = (code) => [...callouts.front, ...callouts.back].find((c) => c.text.startsWith(code) || c.text.includes(`${code} `));
const zoneReferences = chg04.artwork.map((a) => {
  const code = a.id.slice(0, 6);
  const m = manifest.find((x) => x.code === code);
  const zoneId = [...refByZone.entries()].find(([, g]) => a.id.endsWith(g.productionKey))?.[0];
  const g = refByZone.get(zoneId);
  if (!g) throw new Error(`No reference element for ${a.id}`);
  const dw = Math.abs(g.sizeCm[0] - a.sizeCm[0]), dh = Math.abs(g.sizeCm[1] - a.sizeCm[1]);
  if (dw > 0.011 || dh > 0.011) throw new Error(`${a.id}: live zone size ${g.sizeCm} ≠ R2 ${a.sizeCm} — the website zones changed since R2; rebuild R2 first.`);
  const c = calloutFor(code);
  return {
    zoneId,
    r2ArtworkId: a.id,
    piece: m.piece.replace(/_M$/, ""),
    frame: a.frame,
    referenceSizeCm: a.sizeCm,
    referenceCentreCm: a.centreCm,
    referenceRotationDeg: a.rotationDeg,
    referenceInZoneOffsetCm: g.offsetCm,
    flatCallout: c ? { view: callouts.front.includes(c) ? "front" : "back", px: c.px } : null,
  };
});

const poms = data.poms.map((p) => ({ id: p.id, group: p.group, name: p.name, baseSizeCm: p.patternCm, class: p.class, status: p.status }));

const doc = {
  schema: "jacketek.active-techpack-master/1",
  generatedBy: "scripts/techpack-master/build-active-master.mjs",
  style: { id: "JKT-VJ-01", name: "JACKETEK Varsity Jacket", productId: "fidelio-varsity" },
  revision: "R2",
  engineeringRevision: data.revision,
  revisionDate: chg04.date,
  baseSize: data.size,
  grading: { status: "MISSING", note: "R2 is a single base size. No grading exists; a customer size other than the base size cannot be cut until the owner approves grading." },
  approval: arg("--approved-by")
    ? { status: "APPROVED", approvedBy: arg("--approved-by"), approvedAt: arg("--approved-at"), scope: "owner approval of master R2" }
    : { status: "PENDING_OWNER_APPROVAL", approvedBy: null, approvedAt: null, note: "Latest engineering revision (owner-requested CHG-04). Package status: FOR SAMPLE DEVELOPMENT — NOT APPROVED FOR BULK PRODUCTION. Sew line only; not cut-ready until FC-01." },
  lineage: [
    { revision: "ORIG-BASE-01", status: "BASE OF R2 — pack retired 2026-11-25; the 3 reference files the R2 build reads are kept", path: "garment-spec/JACKETEK_R2_BUILD_SOURCES/ORIG-BASE-01 (full pack: external backup C:/JACKETEK_BACKUPS/techpack-cleanup-2026-11-25-phase2)" },
    { revision: "PROD-ENG-02 (resized v0.1 pattern)", status: "SUPERSEDED — RETIRED 2026-11-25", path: "external backup C:/JACKETEK_BACKUPS/techpack-cleanup-2026-11-25 (no data kept in the project)" },
    { revision: "ORIG-R1 (CHG-03)", status: "SUPERSEDED by R2 — RETIRED 2026-11-25", path: "external backup C:/JACKETEK_BACKUPS/techpack-cleanup-2026-11-25 (comparison data: garment-spec/JACKETEK_R2_BUILD_SOURCES/R1-comparison)" },
    { revision: "ORIG-R2 (CHG-02 + CHG-04)", status: "CURRENT ENGINEERING REVISION — PENDING OWNER APPROVAL", path: `${ENG} + ${PKG}` },
  ],
  supersedesForCustomerTechPacks: ["garment-spec/jacketek-master-spec-v0.1.json (RFQ Tech Pack, Golden Bear reference)", "production-drawing/ legacy size chart (Production Drawing PDF)"],
  supplierPackage: { path: PKG, zip: pin(`${PKG}.zip`, "supplier package ZIP"), files: packageFiles, verification: pin(`${TR}/supplier-package-verification.json`, "R2 package verification (22 checks)") },
  engineeringData: [
    pin(`${TR}/factory-master-data.json`, "base-size POMs and pattern data"),
    pin(`${TR}/design-change-CHG-04.json`, "CHG-04 widths + reference artwork placement"),
    pin(`${TR}/supplier-build/artwork-manifest.json`, "R2 artwork manifest"),
    pin(`${TR}/supplier-build/callouts.json`, "flat-view callout positions"),
    pin(`${TR}/supplier-build/confirm-items.json`, "factory confirmation items FC-01…FC-09"),
    pin(`${TR}/supplier-build/flat-front.png`, "technical flat — front"),
    pin(`${TR}/supplier-build/flat-back.png`, "technical flat — back"),
    pin(`${ENG}/JACKETEK_ORIGINAL_Patterns_1to1.dxf`, "internal engineering DXF (R2)"),
    pin(REF_DESIGN, "reference design for the R2 artwork placements (D-59a2a5aab079 DEV-01)"),
  ],
  // R2 Supplier Tech Pack sections: which apply unchanged to every customer jacket, which this
  // customer's Production Tech Pack replaces (they show the reference design's colours / artwork).
  supplierTechPackSections: {
    appliesUnchanged: ["4 Measurement specification — base size", "6 Construction and sewing instructions", "7 Pattern inventory and cutting", "8 Pattern measurement diagrams", "10 Pockets, facings and lining", "14 Labels, finishing and packing", "15 Quality control and factory confirmation (measurement and construction checks)"],
    replacedByCustomerTechPack: ["1 Style overview (colourway, artwork, order reference)", "2 Garment views (reference design)", "3 Technical flats — artwork callouts", "5 Bill of materials — colours", "9 Rib / snaps — rib band colours (band layout and snap positions still apply)", "11–13 Artwork pages (reference design)"],
    patternsAndArtworkFolders: "02_PATTERNS applies unchanged (DXF layer ARTWORK_PLACEMENT shows the reference design's boxes — use the customer positions instead). 03_ARTWORK belongs to the reference design only.",
  },
  bomRows: [
    ["M1", "Body shell fabric", "Back, fronts, waistband front tabs", "body"],
    ["M2", "Sleeve leather / fabric", "Sleeves", "sleeves"],
    ["M3", "Lining — body and sleeves", "Inside body and sleeves", null],
    ["M4", "Knitted rib — collar, cuffs, waistband", "Collar ×1, cuffs ×2, waistband ×1", "rib"],
    ["M5", "Snap fasteners", "Front 5 + waistband tab 2", "snaps"],
    ["M6", "Pocketing", "Pocket bags ×2", null],
    ["M7", "Pocket welt material", "Welts ×2", "welts"],
    ["M8", "Interfacing / reinforcement", "Front edge / snap line, welts, behind snaps", null],
    ["M9", "Sewing thread", "Cotton seams; leather seams", null],
    ["M10", "Embroidery thread / patch materials", "Artwork per this Production Tech Pack", "artwork"],
  ].map(([id, component, placement, customerField]) => ({ id, component, placement, customerField })),
  keyPoms: ["B01", "B03", "B06", "B08", "B09", "B14", "S02-E", "S04", "S06", "C01", "R01"].map((id) => poms.find((p) => p.id === id)).filter(Boolean),
  factoryConfirmation: confirm.map(([id, title, detail, area]) => ({ id, title, detail, area })),
  zoneReferences,
  openItems: ["Owner production approval of R2", "Grading for sizes other than the base size", "FC-01…FC-09 factory confirmation", "Strike-off of every artwork (curvature / tilt on curved panels)", "CLO drape of R2 not run"],
};
doc.sha256OfContent = createHash("sha256").update(JSON.stringify({ ...doc, sha256OfContent: undefined })).digest("hex");
writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`wrote ${OUT}: ${packageFiles.length} package files pinned, ${zoneReferences.length} zone references, approval ${doc.approval.status}`);
