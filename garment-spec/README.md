# garment-spec — the JACKETEK master garment spec used by software

`jacketek-master-spec-v0.1.json` is a **verbatim copy** of
`reports/JACKETEK Master Garment Spec Validation Draft v0.1.json` (rev 2 — secondary visual
fit reference, provisional target range, sample strategy), copied 2026-10-08.

| | |
|---|---|
| SHA-256 | `091f8c0c4da3e439c7f96c3b3db86e4d95b66d61e518d0090d198c9c403abd46` |
| Status | VALIDATION DRAFT — `productionApproved: false` |
| Read by | `server/rfq/generate.mjs` → `src/features/techpack/master.ts` |

Rules:

- Never edit numbers here by hand. Change the master spec document, then replace this file
  with the new verbatim copy (new file name for a new version) and update the generator's
  `MASTER_SPEC_FILE`. Every RFQ records the file name and SHA-256 it was built from.
- This file — not `production-drawing/data/official_size_chart.json` — is the source for RFQ
  Tech Packs. The two disagree. `official_size_chart.json` is **LEGACY · NOT AUTHORITATIVE · NOT
  USED BY RFQ · NOT JACKETEK MASTER SPEC**; only the legacy production-drawing PDF still reads it,
  and that PDF must never be sent to a factory (audit: `measurement-source-matrix-v0.1.md`).
- Nothing here is production approved. Production values come only from a future, explicitly
  approved master spec after physical sample approval.

## v0.2 and the measurement strategy (2026-10-09) — not yet used by the RFQ

`node scripts/measurement/source-matrix.mjs` (data: `scripts/measurement/sources.mjs`) writes, from
v0.1 (unchanged):

| File | What it is |
|---|---|
| `measurement-source-matrix-v0.1.json` / `.md` | All 56 POMs × Golden Bear / supplied chart / S.i. Graphics, provisional M targets, method conflicts, legacy-chart audit |
| `measurement-methods-v0.1.md` | How every POM is measured (landmarks, flat, straight vs curve, rib, relaxed vs stretched, sleeve reference) |
| `grading-strategy-v0.1.md` | Grade references per core dimension; M stays the anchor |
| `m-sample-validation-plan.md` | What happens when the physical M sample arrives |
| `jacketek-master-spec-v0.2.json` | Verbatim copy of `reports/JACKETEK Master Garment Spec Validation Draft v0.2.json`: v0.1 plus a `measurementPlan` per POM, `changeLog`, `methodConflicts`, `legacySizeChart`. Every v0.1 field and status is kept. |
| `dev-output/measurement-source-review/` | Six review images + JSON (regenerated on demand; git-ignored) |

The RFQ generator still reads **v0.1** (`MASTER_SPEC_FILE`). Switching it to v0.2 is a separate,
approved step. Nothing in v0.2 is production approved.

## K2 — materials and construction (2026-10-11) — PARTIALLY_RESOLVED

`node scripts/materials/material-matrix.mjs` (data: `scripts/materials/components.mjs`) writes:

| File | What it is |
|---|---|
| `material-construction-matrix-v0.1.json` / `.md` | 12 components (K2.1–K2.12): design intent, sources, status, final authority, supplier / pattern-maker / sample inputs; embroidery construction per artwork type; audit of every current material field; contradictions X-01–X-13 |
| `factory-material-proposal-request.md` | What the factory proposes with the M sample request |
| `dev-output/material-construction-review/` | Six review images + JSON (regenerated on demand; git-ignored) |

- **Design intent fixed:** body shell Cotton Fabric, sleeves Leather, varsity rib collar / cuffs /
  waistband, metal snap front, lining required. Synthetic / PU is only ever an **ALTERNATIVE
  SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT**; changing Leather needs explicit approval.
- **Open:** every composition, weight, thickness, finish, rib / snap / lining spec, stitch, seam
  and embroidery-construction value is `TBD_SUPPLIER_PROPOSAL` / `TBD_PATTERN_MAKER`, confirmed on
  the M sample. X-01, X-03, X-04, X-05 and X-13 are open product / construction alignment items;
  the website is unchanged.
- Master Spec v0.1 is unchanged; v0.2 carries the plan (`materialConstructionPlan`,
  `partiallyResolvedConflicts`) — run `scripts/measurement/source-matrix.mjs` after editing the
  data. The RFQ still reads v0.1. Nothing is production approved.

## Licensed technical flat — S.i. Graphics (purchased)

| | |
|---|---|
| Product | S.i. Graphics — "Varsity Jacket Techpack Template" (Blank + Example; AI / EPS / PDF / per-page AI · SVG · PNG) |
| Source folder | `garment-spec/si-graphics-varsity-techpack/` — the purchase as delivered. **Never edited.** |
| Licence | `Editing Instructions and License.pdf` (SHA-256 `6b44cdad…6312c0`) |
| Working area | `garment-spec/working-varsity-flat/` — JACKETEK internal derivative |
| Git | both folders are git-ignored (see below) |

Licence, as written (quoted from the PDF, page "© License and Copyright"):

> • Personal and Commercial Use: You may use these files for both personal and commercial
> projects, such as creating end products for sale (e.g., physical or digital merchandise,
> business branding, etc.).
> • Restrictions: However, you cannot resell, share, distribute, or offer these files as-is for
> free or for sale. This includes uploading our designs to third-party platforms as part of a
> stock library or resource file.

What it does **not** state (not assumed): explicit permission to modify (the PDF only gives
editing instructions), use in RFQ / tech packs sent to factories, keeping editable derivatives,
or committing to version control. Treatment until S.i. Graphics confirms otherwise:

- The source and all editable derivatives stay out of Git and are never sent to anyone.
- Factory documents may show the drawing inside JACKETEK's own document; the editable files
  (AI / SVG / EPS) are never attached or shared.
- **Factory sharing of derived drawings (OD-03, RESOLVED 2026-10-11):** USER-CONFIRMED WRITTEN
  PERMISSION FROM S.i. GRAPHICS FOR FACTORY SHARING OF DERIVED TECHNICAL DRAWINGS. The email is held
  by JACKETEK and is not stored in the project. Only the rendered / derived drawings inside
  JACKETEK's documents may be shared; editable source files, the purchased AI / SVG / EPS files and
  the template itself are never shared or redistributed.
- The template's example values (Example spec sheet: front length 28", back length 26½",
  across shoulder 20½", sleeve 35½", chest 49", armhole 9¾", waist 30.7", rib 2.3", sleeve
  opening 21", neck drop 7.5", collar 2.3", welt 7" × 1.2", and its tolerances) are **not**
  JACKETEK data and are never imported.

Working copy (`node scripts/techflat/import-si-varsity.mjs`, checksum-guarded: the import
refuses to run if the purchased page changed — `scripts/techflat/si-source.sha256`):

- `source-copy/page-1.svg` — verbatim copy of `Blank/Single/SVG/…_Page 1.svg` (cover sheet flats)
- `front.svg`, `back.svg` — the template's front / back flats, element for element, grouped into
  named layers (silhouette, body–sleeve seam, shoulder topstitch, collar, collar stripes / rib
  lines / stitch, neck label, front edge + stitch, snaps, welt pockets + stitch, waistband +
  stripes / rib lines / tab / stitch, cuffs + stripes / rib lines / stitch, underarm folds)
- `sleeve-right.svg`, `sleeve-left.svg`, `sleeve.json` — complete standalone sleeves
  (`server/rfq/techflat/sleeve.mjs`). Overarm edge, visible armhole-seam start, visible underarm
  edge below the body and the whole rib cuff are the purchased drawing as drawn; the cap
  continuation and the underarm edge hidden behind the body are **inferred** (smooth curves
  joining the drawn parts, tangent-matched; no new seams or construction). The left sleeve is
  the exact mirror of the right. `sleeve.json` records which segment is drawn vs inferred.
  **Visual technical-flat geometry only — not a pattern, not to scale, never a source of
  measurements.**
- `flat.json` — view boxes, the body / sleeve split (from the template's own seam lines, for
  contrast-sleeve colourways), and landmarks measured on the drawing (HPS, SP, underarm, front
  edge, collar, waistband, hem, snaps, pockets, cuffs). Drawing units, **not to scale**.

The template's flat has a **dropped shoulder**, which matches JACKETEK's construction: K1 (set-in vs
dropped) is **RESOLVED: DROPPED_SHOULDER** (2026-10-10, commit e7b50ff). Master Spec v0.1 is
unchanged and still carries the historical open-K1 wording; v0.2 records the decision
(`shoulderConstruction`, `resolvedConflicts`). The RFQ still reads v0.1 for now. The decision
approves no measurement: across shoulder (B09) and shoulder length (B10) are set by the pattern
maker, and the sleeve and armhole are measured on the M sample (`m-sample-validation-plan.md`).

**Used by the RFQ Tech Pack (from RFQ-03).** Every RFQ drawing — cover, technical flats,
colourway, POM diagrams, artwork / embroidery placement — is this canonical flat
(`server/rfq/flats.mjs`, `server/rfq/techflat/{canonical,sleeve,sheets}.mjs`), with zones,
artwork, colourway and POM lines as separate overlays. The RFQ generator refuses to run when
`working-varsity-flat/` is missing (it is git-ignored, so a fresh checkout or another server
needs the import re-run from the purchased package).

## Purchased CLO varsity garment — varsity-mv2 (toshitimo) (2026-10-23)

Native CLO garment (`.zpac`) + FBX / OBJ of a varsity jacket, ingested in
`garment-spec/varsity-mv2-source/` (see its README). Source ZIPs, extracted files, the CLO working
copy and all exports are git-ignored; manifests, reports, analysis and the scripts in
`scripts/garment-source/` are tracked. It is the planned source of real 2D pattern pieces; nothing
from it is used by the website, the RFQ or the size chart yet.
