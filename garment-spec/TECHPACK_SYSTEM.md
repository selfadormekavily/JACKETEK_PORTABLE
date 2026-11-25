# JACKETEK Tech Pack system (2026-11-25)

**One base-garment master + one frozen, customer-approved jacket design = one customer Production Tech Pack.**

## A. Base garment master (one, versioned)

| | |
|---|---|
| Registry (authoritative pointer) | `garment-spec/ACTIVE_TECHPACK_MASTER.json` (built by `scripts/techpack-master/build-active-master.mjs`) |
| Master | Style JKT-VJ-01 **Rev R2** (ORIG-R2 = purchased CLO pattern + CHG-02 T removal + CHG-04 website widths/artwork) |
| Supplier package | `garment-spec/JACKETEK_SUPPLIER_PACKAGE_R2/` (+ `.zip`), 19 files pinned by SHA-256 |
| Engineering data | `garment-spec/JACKETEK_FACTORY_MASTER_ORIG_R2/` (traceability, DXF), pinned by SHA-256 |
| Status | **PENDING OWNER APPROVAL**: sample development only. One base size, no grading. Patterns are sew line only (FC-01). FC-01…FC-09 are open. |

The registry copies no master data. It pins the files by hash and extracts only what the customer generator needs: key POMs, FC items, R2 reference artwork placements and flat callouts. If a pinned file changes, generation is refused until the registry is rebuilt after review.
Approval is recorded only by the owner: `node scripts/techpack-master/build-active-master.mjs --approved-by "<name>" --approved-at <ISO date>`.

Retired 2026-11-25 (removed from the project; complete copies in C:\JACKETEK_BACKUPS\techpack-cleanup-2026-11-25):
- ORIG-R1 engineering master + R1 supplier package and ZIP (comparison data kept in `ORIG_R2/traceability/superseded/R1/`)
- PROD-ENG-02 `JACKETEK_FACTORY_MASTER` and its generators `scripts/jacketek-pattern/factory_*.py`, `chg01_*.py` (comparison data kept in `ORIGINAL_BASE/traceability/superseded/PROD-ENG-02/`)
- failed / diagnostic CLO simulations of the resized v0.1 pattern; QA debug output; review-flat-v1; production-output test output

Phase 2 (2026-11-25): the ORIG-BASE-01 pack folder and every non-order artefact in `server-data/techpacks` were removed
(backup C:\JACKETEK_BACKUPS	echpack-cleanup-2026-11-25-phase2). What the R2 rebuild needs now lives in ONE place:
`garment-spec/JACKETEK_R2_BUILD_SOURCES/` (see its README; isolated rebuild verified identical to R2).

Kept, but not a customer Tech Pack source:
- `JACKETEK_R2_BUILD_SOURCES/` (16 files): ORIG-BASE-01 reference data, R1 comparison data, reference design D-59a2a5aab079
- `jacketek-pattern-v0.1` (`adapt_m_pattern.py` inputs + pattern-data read by the original-base build)
- `jacketek-master-spec-v0.1/v0.2.json` (Golden Bear reference; used only by the RFQ / development Tech Packs)
- the legacy `production-drawing/` chart (Production Drawing + embroidery digitizing)

`server-data/techpacks/` is empty: the old RFQ documents were removed 2026-11-25 (backup C:\JACKETEK_BACKUPS	echpack-cleanup-2026-11-25-final;
all their artwork regenerates byte-identical from the stored orders). An RFQ is created there only when an admin clicks Generate RFQ Tech Pack.
Engineering-only output goes elsewhere: development Tech Packs → `server-data/development-techpacks/`; review sheets, QA runs,
sample requests and ORIG-BASE-01 rebuilds → `dev-output/` (git-ignored).

## B. Customer jacket (frozen per order line)

- **Snapshot:** the stored order line: size, quantity, the configurator's full design JSON, and the design's SHA-256.
- **Approval:** `jacket_approvals` row with the Jacket ID (`<ORDER_ID>-J<line>`), the snapshot hash, the method and the time. It is never updated. If the stored design later differs from the approved hash, generation is refused.
- **Artwork sizes:** computed with the live configurator code (`zoneContent`), which is the same rule R2 used.
- **Positions:**
  - the R2 reference centre when the customer's in-zone placement equals the reference design's;
  - otherwise a derived centre (body zones) or MANUFACTURER CONFIRMATION REQUIRED (sleeve offsets);
  - MISSING for zones R2 has no position for.

## Generation

| When | What |
|---|---|
| Live preview, saving a draft, adding to the cart | Nothing (drafts and the cart stay in the browser). |
| Checkout with `designApproval: {confirmed: true, designSha256}` per item | The approval is checked before the order is stored. A Jacket ID is assigned, and the Production Tech Pack is generated in the background. |
| Checkout without it (the current website) | The order is placed exactly as before; no Tech Pack is generated. |
| Admin `POST /api/admin/orders/:id/production-techpack {line, approvalReference}` | Records a confirmation received outside the website, then generates. Retries return the existing PDF. |

Output, written once and never overwritten:

```
server-data/production-techpacks/<ORDER_ID>/<JACKET_ID>/<REV>-<SNAPSHOT12>/
  JACKETEK_Production_Tech_Pack_<JACKET_ID>.pdf · snapshot.json · production-spec.json · artwork/ · manifest.json
```

The PDF has 8 pages:
1. Jacket ID and approval
2. Colourway and flats
3. BOM for this jacket
4. Artwork pages
5. Base master key POMs, applicable master sections and FC items

A new master revision creates a new folder next to the old one. A changed design needs a new order line and a new approval.

Code: `server/productionTechpack/` (master, store, generate, render, routes), plus three hooks in `server/index.mjs`.

Tests:
- `node --test --test-concurrency=1 scripts/techpack/production-techpack.test.mjs`
- `node --test --test-concurrency=1 scripts/techpack/production-techpack.e2e.test.mjs`

## Other generators (unchanged, still available to the admin)

| Generator | Master | Use |
|---|---|---|
| RFQ Tech Pack (`server/rfq/`) → `server-data/techpacks/<D-hash>/RFQ-NN/` | jacketek-master-spec v0.1 | supplier quotation only |
| Development Tech Pack (`server/techpack/`) → `server-data/techpacks/live-designs/` | v0.2 | internal development |
| Production Drawing (`scripts/production-pdf.mjs`) → `server-data/production/<ORDER_ID>/` | legacy chart | legacy; conflicts with the masters |
