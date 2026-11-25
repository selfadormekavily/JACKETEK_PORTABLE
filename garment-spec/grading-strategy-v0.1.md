# JACKETEK grading strategy v0.1

**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated 2026-10-09 by `scripts/measurement/source-matrix.mjs` from Master Spec v0.1 (`garment-spec/jacketek-master-spec-v0.1.json`, unchanged) and `scripts/measurement/sources.mjs`. Regenerate; do not edit by hand.

**The M sample stays the anchor size.** No full production size chart is created in this phase. Golden Bear's published steps are a grade **reference**: once the JACKETEK M is approved, they are applied as increments to the approved M, never as Golden Bear's absolute values.

## Core dimensions

| Dimension | Golden Bear step / size | Supplied chart step | Legacy chart step (excluded) | Agree? | Proposed provisional JACKETEK grade | Status | Dependency |
|---|---|---|---|---|---|---|---|
| Chest (B01, circumference) | +3 in = +7.62 cm (half: +3.81) | Not available (source image unavailable) | +3 cm half (= +6 cm circ.) | Cannot be checked — supplied grading not available; legacy chart (excluded) disagrees | +7.62 cm circumference (+3.81 cm half) per size — Golden Bear's step, applied as an increment to the JACKETEK M sample | PROVISIONAL_TARGET (grade reference) | Pattern maker confirms the grade rule on the approved M pattern; no absolute size values until then. |
| Across shoulder (B09) | +0.75 in = +1.905 cm | Not available (source image unavailable) | — | Not applicable — Golden Bear grades a set-in shoulder | None. Golden Bear +1.905 cm (set-in) kept as reference only | TBD_PATTERN_MAKER | K1 = DROPPED_SHOULDER: the pattern maker grades the dropped shoulder point. |
| Centre-back length (B06) | +0.5 in = +1.27 cm | Not available (source image unavailable) | +2 cm (front length, excluded) | Cannot be checked; legacy (different POM) disagrees | +1.27 cm per size (Golden Bear) | PROVISIONAL_TARGET (grade reference) | Pattern maker; start point fixed on the sample (MC-04). |
| Sleeve (S01 from CB / S02 from shoulder point) | +0.75 in = +1.905 cm | Not available (source image unavailable) | +1 cm (shoulder attachment, excluded) | No — methods differ (MC-01) | None. Golden Bear +1.905 cm from CB (set-in) kept as reference only | TBD_PATTERN_MAKER | Sleeve base length set on the fit model first (dropped shoulder); then the pattern maker sets the grade. |

Golden Bear steps are read from its published rows (no grade rule is printed); the rows are exactly linear XS–4XL (checked by the generator, page re-read 2026-10-09).

## Golden Bear Classic rows (reference, cm)

| Size | Chest circ. (B01) | Half chest | Across shoulder (B09) | Centre back (B06) | Sleeve from CB (S01) |
|---|---|---|---|---|---|
| XS | 109.22 | 54.6 | 45.72 | 64.77 | 86.36 |
| S | 116.84 | 58.4 | 47.625 | 66.04 | 88.265 |
| M | 124.46 | 62.2 | 49.53 | 67.31 | 90.17 |
| L | 132.08 | 66 | 51.435 | 68.58 | 92.075 |
| XL | 139.7 | 69.9 | 53.34 | 69.85 | 93.98 |
| XXL | 147.32 | 73.7 | 55.245 | 71.12 | 95.885 |
| 3XL | 154.94 | 77.5 | 57.15 | 72.39 | 97.79 |
| 4XL | 162.56 | 81.3 | 59.055 | 73.66 | 99.695 |

## Every other POM

No source publishes a grade for any other POM. All remaining grade rules are **TBD_PATTERN_MAKER**, set on the approved M pattern. Fixed-by-design candidates (rib heights R01 / S09, collar heights C01 / C02, placket F01, welt width P02, snap-to-edge F07) are typically not graded — the pattern maker confirms.

## Size range

Master Spec sizes: XS–XXL (base M). Golden Bear publishes XS–4XL; the legacy chart XS–3XL; S.i.'s header XS–XXL (example). The JACKETEK range beyond XXL is not decided here.

## Why the supplied chart's grading is not used

Master Spec v0.1 recorded only that the chart's XS–4XL progression "appears irregular" and deliberately did not record it. The values are not in the project, so its grading cannot be compared. If the original chart is found, its steps can be added here and compared — but they are only adopted where they agree with Golden Bear; otherwise TBD_PATTERN_MAKER (no averaging).
