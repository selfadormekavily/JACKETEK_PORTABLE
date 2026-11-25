# sample-development — the size-M development sample request (MSR)

**DEVELOPMENT SAMPLE · NOT FOR BULK PRODUCTION · NOT PRODUCTION APPROVED.** Not a Production Tech
Pack and not a customer RFQ. The customer RFQ generator (`server/rfq/`) is separate and still reads
Master Spec v0.1.

`node scripts/sample-development/generate.mjs [--replace]` (data: `scripts/sample-development/request.mjs`)
reads Master Spec v0.2, the K2 components (`scripts/materials/components.mjs`), the website's
normalised zone geometry and the S.i.-based canonical flat, and writes:

| File | What it is |
|---|---|
| `m-sample-request-MSR-01.json` | The whole request as data (identical to the package's `m-sample-request.json`) |
| `m-sample-return-form.json` / `.md` | The empty form the factory returns with the sample (no approval field) |
| `server-data/techpacks/m-sample-development/MSR-01/` | `JACKETEK-M-Sample-Request-MSR-01.pdf`, `m-sample-request.json`, `measurement-sheet.json`, `factory-material-response.json`, `construction-response.json`, `embroidery-calibration.json`, `sample-photo-checklist.json`, `m-sample-return-form.json`, `source/MSR-01.html`, `qa.json` (git-ignored, internal) |
| `…/MSR-01/factory-release/` | **The only folder sent to the factory**, rebuilt from scratch on every run: the PDF, `README-FACTORY.md`, `m-sample-return-form.json` / `.md`, `measurement-sheet.json`, `factory-material-response.json`, `construction-response.json`, `embroidery-calibration.json`, `sample-photo-checklist.json`. The generator refuses any other file and any internal path, source code, checksum or S.i. source format in it. |

**Drawing licence (OD-03 — RESOLVED 2026-10-11):** USER-CONFIRMED WRITTEN PERMISSION FROM S.i. GRAPHICS
FOR FACTORY SHARING OF DERIVED TECHNICAL DRAWINGS. The email is held by JACKETEK and is not stored in
the project. Only the rendered / derived drawings inside JACKETEK's development package are shared;
editable S.i. source files, the purchased AI / SVG / EPS files and the template itself never are.

Rules the generator enforces (it refuses to write otherwise):

- Targets: only B01 half chest 61.0–62.2 cm and B06 centre-back length 67.3–68.0 cm — PROVISIONAL,
  LOW confidence. B09 = TBD — PATTERN MAKER. S02 = TBD — PATTERN MAKER / MEASURE ON SAMPLE.
- Sleeve methods: S02 shoulder point → cuff seam (primary), S02-E → finished cuff edge (secondary),
  S01 / S01-E centre back (comparison only). Never interchanged.
- Tolerances, material and construction values, physical embroidery sizes: none (TBD / FACTORY TO
  PROPOSE / PATTERN MAKER TO SET / MEASURE ON SAMPLE / JACKETEK TO APPROVE AFTER SAMPLE).
- No external reference value (Golden Bear, supplied chart, S.i. template, legacy chart,
  configurator estimates) is printed. Leather stays the sleeve design intent; synthetic / PU only as
  ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT.
- An existing MSR-01 PDF is replaced only with `--replace` (while it is an unsent draft); a sent
  revision is never overwritten — issue MSR-02.

After the sample: `node scripts/sample-development/variance.mjs <returned-form.json> [--out report.json]`
computes actual − target for B01 / B06 (WITHIN_TARGET_RANGE / OUTSIDE_TARGET_RANGE) and marks every
other row REFERENCE_ONLY, NO_TARGET or REVIEW_REQUIRED. No tolerance is approved, so nothing passes or
fails; JACKETEK decides per row.
