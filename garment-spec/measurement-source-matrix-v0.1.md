# JACKETEK Measurement Source Matrix v0.1 — size M

**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated 2026-10-09 by `scripts/measurement/source-matrix.mjs` from Master Spec v0.1 (`garment-spec/jacketek-master-spec-v0.1.json`, unchanged) and `scripts/measurement/sources.mjs`. Regenerate; do not edit by hand.

## Principle

Three sources with three roles, never averaged: Golden Bear = fit / grade benchmark; supplied chart = target silhouette; S.i. Graphics = drawing / POM layout / presentation. Final authority: pattern maker + physical M sample + sample measurement + JACKETEK approval.

Sources are **never averaged**. Where two sources measure the same thing the same way and agree closely, their values become the ends of a **provisional range** (Rule 1). Where methods differ, the values stay separate and the POM is marked **MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED** (Rule 2). S.i. drawing coordinates are never converted to cm (Rule 5).

## Summary

|  | Count | POMs |
|---|---|---|
| POMs in Master Spec v0.1 | 56 | — |
| Defensible numerical reference (Golden Bear, verified) | 4 | B01, B06, B09, S01 |
| Provisional JACKETEK target (range) | 2 | B01, B06 |
| VERIFIED_SOURCE reference, no target (method conflict) | 1 | S01 |
| TO_MEASURE_ON_SAMPLE | 32 | B02, B03, B04, B05, B07, B08, B11, B12, B13, B14, B15, B16, S02, S03, S04, S05, S06, S07, S08, S09, R01, C01, C02, C03, C04, C05, C06, C07, F01, F02, P01, P02 |
| TBD_PATTERN_MAKER | 21 | B09, B10, S10, R02, R03, R04, R05, F03, F04, F05, F06, F07, P03, P04, P05, P06, P07, L01, L02, L03, L04 |
| S.i. example values recorded (never imported) | 13 | B01, B02, B06, B08, B09, B15, S01, S09, R01, C01, C06, P01, P02 |

## Sources

| Source | Role | What it supports | Status |
|---|---|---|---|
| A. Golden Bear Classic Fit | FIT BENCHMARK · GRADE REFERENCE · VERIFIED EXTERNAL REFERENCE | M + XS–4XL: chest circumference 1" below armhole, sleeve from CB, centre back, across shoulder. Re-checked 2026-10-09: unchanged. | VERIFIED_SOURCE (reference, not JACKETEK approval) |
| B. Supplied chart | SECONDARY_VISUAL_REFERENCE · TARGET SILHOUETTE REFERENCE | M: half chest 61, across shoulder 50, body length 68, sleeve from shoulder seam 51 (cm). Original not available — values from Master Spec v0.1 §3A. | SECONDARY_VISUAL_REFERENCE · SOURCE IMAGE CURRENTLY UNAVAILABLE · RECORDED FROM PRIOR MASTER-SPEC WORK · REQUIRES RE-VERIFICATION IF ORIGINAL CHART IS RE-UPLOADED |
| C. S.i. Graphics | TECHNICAL DRAWING REFERENCE · POM LAYOUT REFERENCE · CONSTRUCTION / PRESENTATION REFERENCE | 13 POM names + example Medium values + example tolerances; empty grading; flats in drawing units. | EXAMPLE_VALUE / POM_LOCATION_ONLY / DRAWING_UNIT |
| Legacy official_size_chart.json | none — historical compatibility only | 60 / 70 / 62 cm M, other methods | LEGACY · NOT AUTHORITATIVE · NOT USED BY RFQ · NOT JACKETEK MASTER SPEC — EXCLUDED |

> **Supplied chart — provenance limitation.** **SECONDARY_VISUAL_REFERENCE** · **SOURCE IMAGE CURRENTLY UNAVAILABLE** · **RECORDED FROM PRIOR MASTER-SPEC WORK** · **REQUIRES RE-VERIFICATION IF ORIGINAL CHART IS RE-UPLOADED**. The original chart image / page is not in the project, the archive, Git history or the session transcripts. Only the M values and method notes recorded in Master Spec v0.1 rev 2 are available. Its measurement arrows therefore cannot be inspected; brand, URL and stated methods are unknown. The values may stay as one end of a provisional range, but they are **not independently verified source data** and add **no confidence**: every confidence below rests on Golden Bear alone. production-drawing/images/sizechart_guide.png is the A / B / C diagram of the LEGACY official_size_chart.json (60 / 70 / 62 cm) — a different chart with no shoulder measurement.

### S.i. Graphics — every value in the package

| Item | Value | Classification | Maps to |
|---|---|---|---|
| Spec sheet row 1: FRONT LENGTH from HPS) | 28" (tol ±0.25") | EXAMPLE_VALUE | B08 |
| Spec sheet row 2: BACK LENGTH (from CB) | 26 1/2" (tol ±0.25") | EXAMPLE_VALUE | B06 |
| Spec sheet row 3: ACROSS SHOULDER | 20 1/2" (tol ±0.25") | EXAMPLE_VALUE | B09 |
| Spec sheet row 4: SLEEVE LENGTH (from center back) | 35 1/2" (tol ±0.375") | EXAMPLE_VALUE | S01 |
| Spec sheet row 5: CHEST CIRCUMFERENCE (1" below armhole) | 49" (tol ±0.375") | EXAMPLE_VALUE | B01 |
| Spec sheet row 6: ARMHOLE (straight) | 9 3/4" (tol ±0.25") | EXAMPLE_VALUE | B15 |
| Spec sheet row 7: WAIST CIRCUMFERENCE | 30.7" (tol ±0.125") | EXAMPLE_VALUE | B02 |
| Spec sheet row 8: WAIST/ CUFF RIB WIDTH | 2.3" (tol ±0.25") | EXAMPLE_VALUE | R01 / S09 |
| Spec sheet row 9: SLEEVE OPENING (flat) | 21" (tol ±0.25") | EXAMPLE_VALUE | S06 / S07 — not mapped (MC-06) |
| Spec sheet row 10: FRONT NECKLINE DROP | 7.5" (tol ±0.125") | EXAMPLE_VALUE | C06 |
| Spec sheet row 11: COLLAR HEIGHT | 2.3" (tol ±0.125") | EXAMPLE_VALUE | C01 |
| Spec sheet row 12: WELT POCKET LENGTH | 7" (tol ±0.125") | EXAMPLE_VALUE | P01 |
| Spec sheet row 13: WELT POCKET WIDTH | 1.2" (tol ±0.125") | EXAMPLE_VALUE | P02 |
| Spec sheet tolerances (13 rows, ±⅛"–⅜") | 0.125–0.375 in | EXAMPLE_VALUE | — |
| Grading page (13 POMs × XS–XXL) | empty | NOT_APPLICABLE | — |
| Header: size range XS–XXL, sample size Medium | XS/S/M/L/XL/XXL · Medium | EXAMPLE_VALUE | — |
| Hangtag 2.44 × 1.5 in, cord 5 in, grommet 6 mm | trim example | EXAMPLE_VALUE | — (trims, not garment POMs) |
| Label sizes "XX INCH" | placeholder | EXAMPLE_VALUE | — |
| Flat drawings (front / back / sleeves) and garment-spec/working-varsity-flat/flat.json landmarks | vector coordinates | DRAWING_UNIT | — |
| Garment features drawn on the flats (collar, snaps, welt pockets, ribs, seams) | positions only | POM_LOCATION_ONLY | 50 POMs located by the JACKETEK overlay |

Findings:
- The SPEC SHEET prints one TARGET column for sample size Medium, in inches, with tolerances. The same values are printed in BOTH the Blank and the Example file.
- The header block is demo content: brand "THE DRAGON", style no. "SW-TSH-04" (a T-shirt code), "XX Company", date "MM-DD-YYYY". The values describe no real garment.
- Internal inconsistencies confirm placeholder data: waist 30.7" against a 49" chest, a 21" flat sleeve opening on a rib cuff.
- Three values (chest 49", sleeve from CB 35½", back length 26½") equal Golden Bear Classic M — they may have been copied from Golden Bear's public chart; they confirm nothing independently.
- The GRADING page is empty ("BASE PATTERN: (PROVIDE)", no values in any size).
- No how-to-measure diagram and no POM arrows on the flats. The flat drawings are vector artwork in drawing units, not to scale.

## Size M — proposed provisional targets

| POM | Quantity | Target range | Golden Bear | Supplied chart | Derivation | Status | Confidence | Still needs sample validation |
|---|---|---|---|---|---|---|---|---|
| B01 | Half chest, flat (B01 ÷ 2) | 61.0–62.2 cm (circumference 122.0–124.5) | 49 = 124.46 cm | 61 cm (unverified secondary reference) | Range ends = the two references (Rule 1): supplied 61.0 (unverified secondary reference); Golden Bear 124.46 ÷ 2 = 62.23 → 62.2 (0.1 cm). Not averaged. | PROVISIONAL_TARGET | LOW — Rests on Golden Bear alone (published value; circumference method inferred, not stated). The 61.0 end is an unverified secondary reference (source image unavailable) and adds no confidence; its height below the armhole is unknown (MC-03). | Measure B01 at 1" below armhole (flat × 2) AND pit-to-pit at the armhole; fit on the M model (bagginess). |
| B06 | Centre-back length | 67.3–68.0 cm | 26½ = 67.31 cm | 68 cm (unverified secondary reference) | Range ends = the two references (Rule 1): Golden Bear 67.31 → 67.3; supplied 68.0 (unverified secondary reference). Not averaged. | PROVISIONAL_TARGET | LOW — Rests on Golden Bear alone, whose start point is not stated; the 68.0 end is an unverified secondary reference (source image unavailable) and adds no confidence. Neither source states the start point; a top-of-collar start adds a full collar height (C01, not yet measured), which can exceed the 0.7 cm range itself (MC-04). | Measure CB from the collar seam, CB from the top of the collar, and B07 from HPS; adopt the method, then confirm the range. |

**B09 across shoulder — no longer a target.** Both references were measured on a set-in (Golden Bear) or unknown construction. On JACKETEK's dropped shoulder the shoulder point is placed by the pattern maker, so across shoulder is a construction result: no cm target until the pattern maker proposes the shoulder point and the M sample is measured. Reference range kept: 49.5–50.0 cm (REFERENCE ONLY — superseded as a JACKETEK target by K1 = DROPPED_SHOULDER; previously PROVISIONAL_TARGET 49.5–50.0 cm (approved 2026-10-09, before K1 was decided)).


**Sleeve: no JACKETEK target** (MC-01). Golden Bear 35½ in (90.17 cm) from centre back and the supplied 51 cm from the shoulder seam are different measurements.

## Shoulder construction — K1 RESOLVED: DROPPED_SHOULDER (2026-10-10)

- The JACKETEK target fit is relaxed / baggy.
- The live product direction is visually closer to a dropped shoulder (the website describes "Standard Baggy Fit — roomy and relaxed, with a dropped shoulder").
- The S.i.-based canonical technical flat already uses a dropped shoulder.
- Golden Bear remains a fit / grading benchmark only; its set-in shoulder construction is not authoritative for JACKETEK.

- **Shoulder point:** On the JACKETEK garment the shoulder point (SP) is where the sleeve-attachment (armhole) seam line crosses the shoulder line — the shoulder seam extended to the top fold with the garment laid flat. It sits below and outside the wearer's natural shoulder; its exact position is set by the pattern maker.
- **Golden Bear:** Golden Bear's set-in values stay FIT_REFERENCE / EXTERNAL_REFERENCE (not deleted). Its shoulder (B09) and sleeve (S01) values are NOT directly transferable to the dropped-shoulder construction without pattern / sample validation.
- **S.i. flat:** Compatible: the canonical flat (garment-spec/working-varsity-flat, from the purchased S.i. page, unedited source) is drawn with a dropped shoulder — its shoulder points SP_L / SP_R sit on the body–sleeve seam well below and outside HPS (front: SP y ≈ 289 vs HPS y ≈ 213, drawing units, not to scale). The RFQ's B09 / S02 POM lines and the sleeve-zone unit (shoulder point → cuff seam = S02 − S09) already start at that dropped seam. No drawing change needed.
- No shoulder or sleeve measurement is approved by this decision.

| POM | What changes (dropped shoulder) | Reference still comparable? | Plan status | Measure on M sample |
|---|---|---|---|---|
| B09 Across shoulder | Shoulder point moves down / out to the dropped armhole seam: across shoulder is wider than a set-in measure of the same body and is set by the pattern. | NO — Golden Bear set-in 49.53 cm; supplied 50 cm construction unknown | TBD_PATTERN_MAKER | yes — straight and contour |
| B10 Shoulder length | Shoulder length includes the drop extension. | N/A — no reference | TBD_PATTERN_MAKER | yes |
| B11 Shoulder drop | Slope to a lower shoulder point is larger than on a set-in block. | N/A | TO_MEASURE_ON_SAMPLE | yes (pattern maker confirms the intended value, SC-2) |
| B14 Armhole depth | Dropped shoulders normally lower the armhole point. | N/A | TO_MEASURE_ON_SAMPLE | yes |
| B15 Armhole, straight | Starts at the dropped shoulder point. | N/A (S.i. 9¾" is an example) | TO_MEASURE_ON_SAMPLE | yes |
| B16 Armhole, curved (along seam) | Follows the dropped armhole seam. | N/A | TO_MEASURE_ON_SAMPLE | yes |
| S01 Sleeve length from centre back | Path CB → dropped shoulder point → cuff. Less construction-dependent than S02, but Golden Bear's 90.17 cm is a set-in value. | BENCHMARK ONLY — not directly transferable | VERIFIED_SOURCE (reference only) | yes — to cuff seam AND finished edge, for comparison |
| S02 Sleeve length from shoulder point (overarm) | Starts at the dropped shoulder point: shorter than a set-in sleeve for the same arm. | NO — supplied 51 cm: method conflict MC-01 | TO_MEASURE_ON_SAMPLE | yes — to cuff seam (primary) AND finished edge |
| S03 Underarm sleeve length | Depends on the lower armhole point. | N/A | TO_MEASURE_ON_SAMPLE | yes |
| S04 Bicep width, 1" below armhole | Dropped-shoulder sleeves are usually wider at the top. | N/A | TO_MEASURE_ON_SAMPLE | yes |
| S10 Sleeve cap height (pattern) | Low, flat sleeve cap. | N/A | TBD_PATTERN_MAKER | no (pattern) |
| B01 Chest circumference, 1" (2.54 cm) below armhole | Not a shoulder POM, but the reference level "1" below the armhole" moves down with a lower armhole point. | YES with caveat (MC-03) | PROVISIONAL_TARGET | yes |

| Pattern-maker parameter | Definition | Status |
|---|---|---|
| SC-1 Shoulder-point position (drop extension) | Where the armhole seam meets the shoulder line, stated on the pattern as the extension beyond the natural-shoulder point of the base block (cm, pattern). | TBD_PATTERN_MAKER |
| SC-2 Shoulder drop / slope at the dropped shoulder point | B11 — vertical HPS level → dropped shoulder-point level. | TBD_PATTERN_MAKER (confirmed as B11 on the sample) |
| SC-3 Armhole depth and sleeve-cap height for the dropped shoulder | B14 and S10. | TBD_PATTERN_MAKER |

## All 56 POMs

| POM | Name | Golden Bear (M) | Supplied chart (M) | S.i. Graphics | Current status | Plan status | Proposed target | Method | Unresolved |
|---|---|---|---|---|---|---|---|---|---|
| B01 | Chest circumference, 1" (2.54 cm) below armhole | 49 = 124.46 cm · YES | 61 cm · unverified · PARTIAL | EXAMPLE 49" | VERIFIED_SOURCE | PROVISIONAL_TARGET | 61.0–62.2 cm (half chest) | SOURCE_AMBIGUOUS | Provisional only. Measure B01 at 1" below armhole (flat × 2) AND pit-to-pit at the armhole; fit on the M model (bagginess). |
| B02 | Waist circumference | — | — | EXAMPLE 30.7" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | DISTANCE_TBD | TO_MEASURE_ON_SAMPLE — and the pattern maker must first fix the measuring level. |
| B03 | Body width at waistband seam (above rib) | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B04 | Bottom opening, relaxed | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B05 | Bottom opening, extended | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B06 | Centre-back length | 26½ = 67.31 cm · YES | 68 cm · unverified · PARTIAL | EXAMPLE 26 1/2" | VERIFIED_SOURCE | PROVISIONAL_TARGET | 67.3–68.0 cm | SOURCE_AMBIGUOUS | Provisional only. Measure CB from the collar seam, CB from the top of the collar, and B07 from HPS; adopt the method, then confirm the range. |
| B07 | Back length from HPS | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B08 | Front length from HPS | — | — | EXAMPLE 28" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B09 | Across shoulder | 19½ = 49.53 cm · NO | 50 cm · unverified · NO | EXAMPLE 20 1/2" | VERIFIED_SOURCE | TBD_PATTERN_MAKER | — | PATTERN_DEPENDENT | TBD_PATTERN_MAKER — dropped shoulder point set by the pattern maker; measured on the M sample. |
| B10 | Shoulder length | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TBD_PATTERN_MAKER | — | PATTERN_DEPENDENT | TBD_PATTERN_MAKER — dropped shoulder point set by the pattern maker; measured on the M sample. |
| B11 | Shoulder drop | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B12 | Across front | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | DISTANCE_TBD | TO_MEASURE_ON_SAMPLE — and the pattern maker must first fix the measuring level. |
| B13 | Across back | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | DISTANCE_TBD | TO_MEASURE_ON_SAMPLE — and the pattern maker must first fix the measuring level. |
| B14 | Armhole depth | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B15 | Armhole, straight | — | — | EXAMPLE 9 3/4" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| B16 | Armhole, curved (along seam) | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S01 | Sleeve length from centre back | 35½ = 90.17 cm · BENCHMARK ONLY | — | EXAMPLE 35 1/2" | VERIFIED_SOURCE | VERIFIED_SOURCE | — | SOURCE_AMBIGUOUS | MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED (MC-01, MC-02). |
| S02 | Sleeve length from shoulder point (overarm) | — | 51 cm · unverified · NO | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CONFLICT | MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED (MC-01, MC-02). |
| S03 | Underarm sleeve length | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S04 | Bicep width, 1" below armhole | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S05 | Elbow width | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | DISTANCE_TBD | TO_MEASURE_ON_SAMPLE — and the pattern maker must first fix the measuring level. |
| S06 | Sleeve width at cuff seam (above rib) | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S07 | Cuff opening, relaxed | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S08 | Cuff opening, extended | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S09 | Cuff rib height | — | — | EXAMPLE 2.3" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| S10 | Sleeve cap height (pattern) | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | NOT_ON_GARMENT | TBD_PATTERN_MAKER — construction decision. |
| R01 | Waistband rib height | — | — | EXAMPLE 2.3" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| R02 | Waistband rib cut length | — | — | POM_LOCATION_ONLY | DERIVED_FROM_APPROVED_SPEC | TBD_PATTERN_MAKER | — | NOT_ON_GARMENT | TBD_PATTERN_MAKER — calculated once its inputs are approved (CALCULATED AFTER SAMPLE). |
| R03 | Cuff rib cut length | — | — | POM_LOCATION_ONLY | DERIVED_FROM_APPROVED_SPEC | TBD_PATTERN_MAKER | — | NOT_ON_GARMENT | TBD_PATTERN_MAKER — calculated once its inputs are approved (CALCULATED AFTER SAMPLE). |
| R04 | Collar rib cut length | — | — | POM_LOCATION_ONLY | DERIVED_FROM_APPROVED_SPEC | TBD_PATTERN_MAKER | — | NOT_ON_GARMENT | TBD_PATTERN_MAKER — calculated once its inputs are approved (CALCULATED AFTER SAMPLE). |
| R05 | Rib stripe layout (count, stripe widths, distance from edge) | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| C01 | Collar height at CB | — | — | EXAMPLE 2.3" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| C02 | Collar height at front ends | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| C03 | Collar neck-edge length (attached edge) | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| C04 | Collar outer-edge length, relaxed | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| C05 | Neck width, seam to seam | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| C06 | Front neck drop | — | — | EXAMPLE 7.5" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| C07 | Back neck drop | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| F01 | Front placket / facing width (finished) | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| F02 | Front overlap (CF to front edge) | — | — | POM_LOCATION_ONLY | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| F03 | Snap count | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | NOT_ON_GARMENT | TBD_PATTERN_MAKER — construction decision. |
| F04 | Top snap position below neck seam | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| F05 | Bottom snap position above bottom edge | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| F06 | Snap spacing (centre to centre) | — | — | POM_LOCATION_ONLY | DERIVED_FROM_APPROVED_SPEC | TBD_PATTERN_MAKER | — | NOT_ON_GARMENT | TBD_PATTERN_MAKER — calculated once its inputs are approved (CALCULATED AFTER SAMPLE). |
| F07 | Snap centre from front edge | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| P01 | Pocket opening length | — | — | EXAMPLE 7" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| P02 | Pocket welt width | — | — | EXAMPLE 1.2" | TO_MEASURE_ON_SAMPLE | TO_MEASURE_ON_SAMPLE | — | CLEAR | TO_MEASURE_ON_SAMPLE — no source publishes it. |
| P03 | Pocket position below HPS (top of opening) | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| P04 | Pocket position from CF (top of opening) | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| P05 | Pocket opening angle | — | — | POM_LOCATION_ONLY | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| P06 | Pocket bag depth | — | — | NOT_APPLICABLE | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| P07 | Pocket bag width | — | — | NOT_APPLICABLE | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| L01 | Lining CB length relative to shell | — | — | NOT_APPLICABLE | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| L02 | Lining sleeve length relative to shell | — | — | NOT_APPLICABLE | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| L03 | Lining chest width relative to shell | — | — | NOT_APPLICABLE | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |
| L04 | Inside pocket opening (if fitted) | — | — | NOT_APPLICABLE | TO_SET_BY_PATTERN_MAKER | TBD_PATTERN_MAKER | — | CLEAR | TBD_PATTERN_MAKER — construction decision. |

## Measurement-method conflicts

| ID | POMs | Conflict | Status | Detail | Result |
|---|---|---|---|---|---|
| MC-01 | S01, S02 | Sleeve: centre back vs shoulder seam | OPEN | Golden Bear measures from centre back (S01, 90.17 cm M). The supplied chart measures from the shoulder seam (51 cm M, end point unknown). Different start points: the two numbers are never compared, combined or averaged. Arithmetic only: GB S01 − ½ GB B09 = 65.41 cm, ≈ 14 cm more than 51 cm — far more than a cuff rib, so the supplied chart's end point (cuff seam? elbow? underarm length?) or start point (a dropped shoulder seam) differs. | MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED — no JACKETEK sleeve target. |
| MC-02 | B09, B10, B11, B14, B15, B16, S01, S02, S03, S04, S10 | Shoulder construction (K1) moves the shoulder point | DECISION MADE — K1 = DROPPED_SHOULDER (2026-10-10); measurement consequences remain open | JACKETEK uses a DROPPED SHOULDER. Golden Bear Classic is a set-in block; whether the supplied chart's jacket is dropped is unknown. On a dropped shoulder the shoulder point moves down the arm: across shoulder grows and sleeve-from-shoulder-point shrinks for the same body. Golden Bear's B09 and any set-in shoulder-point sleeve value are therefore not transferable. | K1 resolved. B09 / B10 → TBD_PATTERN_MAKER (shoulder point placed by the pattern maker); S01 / S02 measured on the sample from the dropped shoulder point; no new cm values. |
| MC-03 | B01 | Chest height | OPEN | Golden Bear: circumference 1" below the armhole. Supplied chart: half / flat chest, height not known (pit-to-pit at the armhole is common and reads slightly smaller). Same quantity (flat chest), possibly a different level. | Used together as a provisional RANGE only (Rule 1, with this caveat). Sample records both levels. |
| MC-04 | B06 | Body length start point | OPEN | Golden Bear "Center back" and the supplied "body length" both leave the start point open (CB collar seam / top of collar / HPS). The legacy chart measures front length from HPS (≈ B08), not CB. | Provisional range kept; LOW confidence. Sample records CB-from-collar-seam, CB-from-top-of-collar and B07. |
| MC-05 | B09 | Across shoulder: straight vs contour | OPEN | Neither Golden Bear nor the supplied chart states it. | JACKETEK defines straight at the armhole seam line; sample also records the contour. |
| MC-06 | S07, S06 | S.i. "SLEEVE OPENING (flat)" / "CUFF OPENING (flat)" | OPEN | The spec sheet and the grading page name the same row differently; 21" cannot be a rib cuff edge. | Example value; not mapped to S07 or S06. |
| MC-07 | C01, C02 | S.i. "COLLAR HEIGHT" position | OPEN | Not stated whether at CB or at the front ends. | Example value; JACKETEK measures both (C01, C02). |
| MC-08 | B08, B06 | Legacy chart "jacket length" is a front length | OPEN | official_size_chart.json "JACKET LENGTH" (70 cm M) is measured from the top shoulder/neck point on the front (HPS → hem = B08), not a centre-back length. It must not be compared with B06. | Legacy chart excluded. |

## Legacy official size chart — audit (Phase 7)

**LEGACY · NOT AUTHORITATIVE · NOT USED BY RFQ · NOT JACKETEK MASTER SPEC.** Kept for historical compatibility only (not deleted). The legacy production-drawing PDF built from it must NOT be sent to a factory.

`production-drawing/data/official_size_chart.json` — M 60 / 70 / 62 cm. Its "_source" text still reads "Values are authoritative"; the "_status" key added on 2026-10-09 marks the file LEGACY and overrides it. Values unchanged.

| Legacy field | Current Master Spec | Conflict |
|---|---|---|
| CHEST WIDTH FLAT 60 cm (underarm to underarm) | Provisional half chest 61.0–62.2 cm (B01 ÷ 2) | 1.0–2.2 cm narrower; measured AT the underarm, not 1" below |
| JACKET LENGTH 70 cm (front, from HPS) | B06 centre-back 67.3–68.0 cm (provisional) | Different POM (front length from HPS ≈ B08) — not comparable with B06 (MC-08) |
| SLEEVE LENGTH 62 cm (from the shoulder/sleeve attachment) | No JACKETEK sleeve target; supplied 51 cm from the shoulder seam | Third sleeve method/value; excluded |
| Grade +3 / +2 / +1 cm per size, XS–3XL | Golden Bear +3.81 half chest / +1.27 CB length / +1.905 CB sleeve | Disagrees with Golden Bear on every dimension |

| Code that still reads it | Path | Effect |
|---|---|---|
| production-drawing/build/populate.mjs | scripts/production-pdf.mjs ← server/index.mjs POST /api/admin/orders/:id/production-pdf | STILL ACTIVE: the admin's legacy Production Drawing PDF prints these values (badge reads "LEGACY CHART (2026-10-02) — conflicts with Master Garment Spec v0.1; confirm before production"). Its DERIVED POMs are scaled from this chart via data/measurements.json. |
| production-drawing/flats/varsityFlat.mjs | legacy production drawing flats | Draws the legacy sheet's flat to this chart's proportions. Not used by the RFQ (test-enforced). |
| server/index.mjs measurementsFor() | admin order page | Shown as "Measurements — legacy chart" with the legacy source label. |
| src/features/production/orderToProductionOrder.ts | CHART_SIZES / SIZE_TO_CHART | Uses only the chart's size list (XS–3XL, XXL → 2XL) for the legacy sheet. |
| scripts/techflat/measurement-review.mjs | review package | Quotes the conflict only. |

- Labelled LEGACY: **yes**. RFQ-05 depends on it: **no**. Master Spec depends on it: **no**. RFQ-05 manufacturing-spec.json contains no reference to the chart; the RFQ build reads Master Spec v0.1 only; scripts/techpack/rfq.test.mjs asserts no RFQ source file reads production-drawing/data.
- Keep (not deleted in this phase). Before any order goes to a factory, retire or relabel the legacy Production Drawing PDF so it cannot be mistaken for a spec.

## Final authority

Pattern maker + physical M sample + sample measurement + JACKETEK final approval. Every entry is `approvalState: NOT_APPROVED`.
