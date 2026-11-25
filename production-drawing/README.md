# Fidelio Varsity — Tech Pack (4 pages, A4)

> **LEGACY — DO NOT SEND THIS PDF TO A FACTORY.** Its measurements come from the legacy chart below, not from the JACKETEK Master Garment Spec. Factory documents are the RFQ Tech Packs (`server/rfq/`).

The production PDF made for every order line (admin → Generate production PDF, or
`node scripts/production-pdf.mjs --order <order.json>`). Exactly four pages — the generator
refuses to finish otherwise:

| Page | Content |
|---|---|
| 1 ORDER | Order ID, customer, phone, date, size, fit, quantity, delivery; front + back flat |
| 2 MATERIAL + COLOUR | Part / material / colour / colour code table; front + back colour map in the order's colours |
| 3 TECHNICAL FLAT + MEASUREMENTS | Dimensioned front + back flats, points of measure (POM) table, panel breakdown |
| 4 EMBROIDERY ARTWORK | Every customer-uploaded image: the artwork itself, location, size (cm), rotation, placement drawn on the flat |

| Path | What it is |
|---|---|
| `build/populate.mjs` | The generator: production sheet JSON → HTML → PDF (headless Chrome / Edge) |
| `template/techpack.css` | Print styles |
| `flats/varsityFlat.mjs` | The reusable 2D technical flat (vector), built per size; `node flats/varsityFlat.mjs --size M` exports `flats/varsity_front.svg` / `varsity_back.svg` |
| `data/official_size_chart.json` | **LEGACY · NOT AUTHORITATIVE · NOT USED BY RFQ · NOT JACKETEK MASTER SPEC** (2026-10-02). Called the client‑approved "official" chart when this generator was built; its M values (60 / 70 / 62 cm) **conflict with the Master Garment Spec** (`garment-spec/`), which is the measurement source for RFQs. Kept for historical compatibility with this legacy production sheet only; never used by the RFQ generator. Audit: `garment-spec/measurement-source-matrix-v0.1.md`. |
| `data/measurements.json` | The points of measure printed on page 3: status (confirmed / derived / fixed / tbc), the Blender pattern values and their calibration, with provenance |
| `images/` | Renders of `Fidelio_Varsity_Drawing_v02.blend` — the source the flat's drawing proportions and the HPS reference were measured from (not printed) |

The production sheet is made by `src/features/production/orderToProductionOrder.ts`.

```
node build/populate.mjs --order <sheet.json> --out X.pdf [--html-only]
```
Artwork files named in the sheet are read from the sheet's folder.

## Rules
- Measurement hierarchy (approved 2026-10-03), each value labelled on page 3:
  - **CONFIRMED** — the official size chart (A, B, C). Authoritative; never altered.
  - **DERIVED** — measured on the sewing pattern in the production master's UVs
    (`Fidelio_Varsity_ProductionReady_v13.blend`, read-only) and calibrated per size:
    widths × official ½ chest / 53.14, lengths × official front length / 70.00.
  - **FIXED** — verified pattern details (cuff opening, cuff height, collar height, welt width / length,
    waistband height), not graded.
  - **TBC** — no reliable geometry (pocket opening, pocket bag, placket width, seam allowance, stitching).
  Never take a value from the 3D surface or scale it from a drawing.
- The flat draws chest width (A), jacket length (B) and sleeve length (C) to scale for the ordered
  size; its other proportions are drawing proportions (`DRAWING` in `varsityFlat.mjs`), not specifications.
- Material and colour come only from the order; what the website doesn't store prints TO BE CONFIRMED.
- Embroidery placement is given from CF / CB and below the HPS, measured on the configurator's
  reference jacket (`REFERENCE_HPS_Y` in `src/features/configurator/model/embroideryGeometry.ts`)
  and marked REF. Seam-based positions per size print **TO BE CALIBRATED**.
- The customer's original upload and the processed transparent PNG are saved next to the PDF
  (`…_ORIGINAL.<ext>`, `…_ARTWORK.png`).
- **Auto-digitized embroidery (prototype)** — `src/features/embroidery/`: the processed PNG is converted to
  stitches (tatami fill + underlay, satin + centre-walk underlay, running), ordered and turned as placed,
  and written as Tajima DST (`…_EMBROIDERY.dst`) with `…_EMBROIDERY.json` metadata and
  `…_EMBROIDERY_PREVIEW.svg`. Page 4 shows the digitized preview as the embroidery (the upload is marked
  "reference only") and draws the stitch field on the flat. Designs are stored with the order
  (`embroidery_designs` table) when it is placed; older orders are digitized when first opened.
  Every output carries the status **"Auto-digitized prototype — requires professional digitizing review"**:
  it is not an approved production file.
