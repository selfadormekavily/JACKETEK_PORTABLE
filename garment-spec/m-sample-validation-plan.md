# JACKETEK M sample — validation plan

**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated 2026-10-09 by `scripts/measurement/source-matrix.mjs` from Master Spec v0.1 (`garment-spec/jacketek-master-spec-v0.1.json`, unchanged) and `scripts/measurement/sources.mjs`. Regenerate; do not edit by hand.

What happens when the first physical M sample arrives. The sample is the first JACKETEK measurement; everything before it is reference, provisional, derived or TBD.

## Before the sample is made

1. **K1 is decided: DROPPED_SHOULDER** (2026-10-10). The pattern maker must provide / confirm: the actual shoulder drop and shoulder-point position (SC-1, SC-2, SC-3), and mark the shoulder point on the sample.
2. **Pattern maker proposes** every TBD_PATTERN_MAKER item (list below) and the measuring levels for B02, B12, B13, S05.
3. **Pattern maker receives** `measurement-methods-v0.1.md` and builds to the provisional ranges (B01 **Half Chest — Flat Width** 61.0–62.2 cm — the circumference is derived as flat width × 2, not a separately measured POM; B06 67.3–68.0 cm). Across shoulder has no target: it follows from the dropped shoulder point the pattern maker sets. The **sleeve length is set on the fit model**, not taken from any chart.

## When the sample arrives

1. Factory / pattern maker has proposed the missing construction dimensions (TBD_PATTERN_MAKER).
2. The M sample is produced.
3. **Every required POM is measured** (MEASURE ON SAMPLE below), flat, by the written method, with a photo of the tape on each core POM. Ambiguous POMs record every alternative (B01 at 1" below AND at the armhole; B06 from the collar seam AND the top of the collar, plus B07; B09 straight AND contour; S01 = centre back → cuff seam AND S01-E = centre back → finished cuff edge, recorded separately as comparison measurements; S02 = shoulder point → cuff seam (primary) AND S02-E = shoulder point → finished cuff edge (secondary)).
4. **Actual vs target** is compared for B01, B06 (provisional ranges); B09 and the sleeve against the pattern maker's stated values; Golden Bear (set-in) only as a benchmark for B09 / S01.
5. **Variance** = actual − nearest range end (0 inside the range), in cm and %; S.i.'s example tolerances are not used — JACKETEK tolerances are set at approval.
6. **JACKETEK approves / rejects / requests an adjustment** per POM, with the fit-on-body review (bagginess, sleeve on the fit model).
7. **Master Spec is revised** (new version, approved values marked by approval, old provenance kept).
8. **Only then** can a Production Tech Pack v1.0 be created, and grading applied from the approved M.

## Classification of all 56 POMs

| Class | Count | Meaning |
|---|---|---|
| MEASURE ON SAMPLE | 35 | Measured on the sample; compared with the provisional target where one exists. |
| PATTERN MAKER TO SET | 17 | Set by the pattern maker; verified on the sample where it can be measured. |
| CALCULATED AFTER SAMPLE | 4 | Computed from approved values + a ratio the pattern maker sets. |
| REFERENCE ONLY | 0 | None — S01 is a reference but is also measured on the sample. |
| NOT REQUIRED | 0 | None (L04 applies only if an inside pocket is fitted). |

| POM | Name | Class | Compare with | Record | Verify on sample |
|---|---|---|---|---|---|
| B01 | Chest circumference, 1" (2.54 cm) below armhole | MEASURE ON SAMPLE | Provisional 61.0–62.2 cm (half chest) | All alternative methods (see methods doc) | yes |
| B02 | Waist circumference | MEASURE ON SAMPLE | — | At the level the pattern maker fixed | yes |
| B03 | Body width at waistband seam (above rib) | MEASURE ON SAMPLE | — | As defined | yes |
| B04 | Bottom opening, relaxed | MEASURE ON SAMPLE | — | As defined | yes |
| B05 | Bottom opening, extended | MEASURE ON SAMPLE | — | As defined | yes |
| B06 | Centre-back length | MEASURE ON SAMPLE | Provisional 67.3–68.0 cm | All alternative methods (see methods doc) | yes |
| B07 | Back length from HPS | MEASURE ON SAMPLE | — | As defined | yes |
| B08 | Front length from HPS | MEASURE ON SAMPLE | — | As defined | yes |
| B09 | Across shoulder | PATTERN MAKER TO SET | Pattern maker's value; GB 49.53 set-in reference only | As defined | yes |
| B10 | Shoulder length | PATTERN MAKER TO SET | Pattern maker's value | As defined | yes |
| B11 | Shoulder drop | MEASURE ON SAMPLE | — | As defined | yes |
| B12 | Across front | MEASURE ON SAMPLE | — | At the level the pattern maker fixed | yes |
| B13 | Across back | MEASURE ON SAMPLE | — | At the level the pattern maker fixed | yes |
| B14 | Armhole depth | MEASURE ON SAMPLE | — | As defined | yes |
| B15 | Armhole, straight | MEASURE ON SAMPLE | — | As defined | yes |
| B16 | Armhole, curved (along seam) | MEASURE ON SAMPLE | — | As defined | yes |
| S01 | Sleeve length from centre back | MEASURE ON SAMPLE | Comparison only — no JACKETEK target (S01 → cuff seam, S01-E → finished cuff edge); Golden Bear 90.17 cm set-in benchmark only | All alternative methods (see methods doc) | yes |
| S02 | Sleeve length from shoulder point (overarm) | MEASURE ON SAMPLE | Pattern maker's value | All alternative methods (see methods doc) | yes |
| S03 | Underarm sleeve length | MEASURE ON SAMPLE | — | As defined | yes |
| S04 | Bicep width, 1" below armhole | MEASURE ON SAMPLE | — | As defined | yes |
| S05 | Elbow width | MEASURE ON SAMPLE | — | At the level the pattern maker fixed | yes |
| S06 | Sleeve width at cuff seam (above rib) | MEASURE ON SAMPLE | — | As defined | yes |
| S07 | Cuff opening, relaxed | MEASURE ON SAMPLE | — | As defined | yes |
| S08 | Cuff opening, extended | MEASURE ON SAMPLE | — | As defined | yes |
| S09 | Cuff rib height | MEASURE ON SAMPLE | — | As defined | yes |
| S10 | Sleeve cap height (pattern) | PATTERN MAKER TO SET | — | As defined | no (pattern) |
| R01 | Waistband rib height | MEASURE ON SAMPLE | — | As defined | yes |
| R02 | Waistband rib cut length | CALCULATED AFTER SAMPLE | — | As defined | yes |
| R03 | Cuff rib cut length | CALCULATED AFTER SAMPLE | — | As defined | yes |
| R04 | Collar rib cut length | CALCULATED AFTER SAMPLE | — | As defined | yes |
| R05 | Rib stripe layout (count, stripe widths, distance from edge) | PATTERN MAKER TO SET | — | As defined | yes |
| C01 | Collar height at CB | MEASURE ON SAMPLE | — | As defined | yes |
| C02 | Collar height at front ends | MEASURE ON SAMPLE | — | As defined | yes |
| C03 | Collar neck-edge length (attached edge) | MEASURE ON SAMPLE | — | As defined | yes |
| C04 | Collar outer-edge length, relaxed | MEASURE ON SAMPLE | — | As defined | yes |
| C05 | Neck width, seam to seam | MEASURE ON SAMPLE | — | As defined | yes |
| C06 | Front neck drop | MEASURE ON SAMPLE | — | As defined | yes |
| C07 | Back neck drop | MEASURE ON SAMPLE | — | As defined | yes |
| F01 | Front placket / facing width (finished) | MEASURE ON SAMPLE | — | As defined | yes |
| F02 | Front overlap (CF to front edge) | MEASURE ON SAMPLE | — | As defined | yes |
| F03 | Snap count | PATTERN MAKER TO SET | — | As defined | yes |
| F04 | Top snap position below neck seam | PATTERN MAKER TO SET | — | As defined | yes |
| F05 | Bottom snap position above bottom edge | PATTERN MAKER TO SET | — | As defined | yes |
| F06 | Snap spacing (centre to centre) | CALCULATED AFTER SAMPLE | — | As defined | yes |
| F07 | Snap centre from front edge | PATTERN MAKER TO SET | — | As defined | yes |
| P01 | Pocket opening length | MEASURE ON SAMPLE | — | As defined | yes |
| P02 | Pocket welt width | MEASURE ON SAMPLE | — | As defined | yes |
| P03 | Pocket position below HPS (top of opening) | PATTERN MAKER TO SET | — | As defined | yes |
| P04 | Pocket position from CF (top of opening) | PATTERN MAKER TO SET | — | As defined | yes |
| P05 | Pocket opening angle | PATTERN MAKER TO SET | — | As defined | yes |
| P06 | Pocket bag depth | PATTERN MAKER TO SET | — | As defined | yes |
| P07 | Pocket bag width | PATTERN MAKER TO SET | — | As defined | yes |
| L01 | Lining CB length relative to shell | PATTERN MAKER TO SET | — | As defined | yes |
| L02 | Lining sleeve length relative to shell | PATTERN MAKER TO SET | — | As defined | yes |
| L03 | Lining chest width relative to shell | PATTERN MAKER TO SET | — | As defined | yes |
| L04 | Inside pocket opening (if fitted) | PATTERN MAKER TO SET | — | As defined | yes |

## Shoulder and sleeve — the pattern maker provides / confirms (K1 = DROPPED_SHOULDER)

| Item | Provided by the pattern maker | Measured on the M sample |
|---|---|---|
| Actual shoulder drop (SC-1 drop extension, SC-2 / B11 slope) | Yes — stated on the pattern | B11; shoulder point marked and photographed |
| Actual shoulder point | Yes — marked on the pattern and the sample | Yes — photo |
| Across shoulder (B09) | Intended value | Straight at the seam line AND contour |
| S02 Sleeve — shoulder point → cuff seam (PRIMARY) | Intended value, set on the fit model | Yes — no target; compared with the pattern maker's value |
| S02-E Sleeve — shoulder point → finished cuff edge (SECONDARY) | — | Yes — recorded separately (≈ S02 + S09) |
| S01 Sleeve — centre back → cuff seam (COMPARISON ONLY) | — | Yes — reference only, not a JACKETEK sleeve target; Golden Bear (set-in) benchmark only |
| S01-E Sleeve — centre back → finished cuff edge (COMPARISON ONLY) | — | Yes — reference only, not a JACKETEK sleeve target |
| Armhole depth / sleeve cap (B14, S10) | Yes (SC-3) | B14 yes; S10 pattern only |

Nothing here is production approved.

## Sample record per POM

`pomId · method used · value (cm, 0.1) · photo · measured by · date · target / range · variance · decision (approve / reject / adjust) · note`
