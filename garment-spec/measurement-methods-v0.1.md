# JACKETEK measurement methods v0.1

**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated 2026-10-09 by `scripts/measurement/source-matrix.mjs` from Master Spec v0.1 (`garment-spec/jacketek-master-spec-v0.1.json`, unchanged) and `scripts/measurement/sources.mjs`. Regenerate; do not edit by hand.

How every POM is measured on the JACKETEK garment. Where a reference source is ambiguous, JACKETEK's own definition is stated here and the sample records the alternatives too, so the reference can be reconciled afterwards.

## Rules for every POM unless stated

- **Garment:** finished garment, **laid flat** on a table, smoothed without stretching, snaps **closed**, back facing up for back measurements. Never measured worn.
- **Seam allowance:** excluded — finished measurements only. Pattern (S10) and cut-piece (R02–R04) values are stated by the pattern maker.
- **Straight vs along the curve:** straight unless the POM says *along*.
- **Widths:** "flat width × 2" POMs (B01–B05) record the flat width AND the circumference. Sleeve widths (S04–S08) are flat widths = half circumference.
- **Rib:** relaxed unless the POM says stretched (B05, S08: full extension without straining stitches).
- **Lengths include the rib** to the finished edge (B06–B08, S01–S03).
- **Shoulder construction:** K1 = **DROPPED_SHOULDER** (2026-10-10).
- **Shoulder point (SP):** On the JACKETEK garment the shoulder point (SP) is where the sleeve-attachment (armhole) seam line crosses the shoulder line — the shoulder seam extended to the top fold with the garment laid flat. It sits below and outside the wearer's natural shoulder; its exact position is set by the pattern maker. **HPS:** where the shoulder seam meets the collar seam.
- **Sleeve:** S01 starts at centre back; S02 at the shoulder point; S03 at the armhole point. They are three different POMs and are never interchanged.
- **Units:** cm, 0.1 cm. Inches only as source values.
- **Visual reference:** the POM diagrams in the RFQ (S.i. flat + JACKETEK overlay, `server/rfq/techflat/sheets.mjs`); the licensed S.i. files are not modified.

## Across shoulder and sleeve on the dropped shoulder

| Measure | Landmark A | Landmark B | Path | Notes |
|---|---|---|---|---|
| B09 Across shoulder | LEFT shoulder point — dropped shoulder: where the sleeve-attachment (armhole) seam line crosses the shoulder line (shoulder seam extended to the top fold), below and outside the wearer's natural shoulder | RIGHT shoulder point, same definition | Straight, garment flat, back facing up, at the seam LINE | Also record the contour along the back. Value set by the pattern maker's shoulder point; Golden Bear's set-in 19½" does not transfer. |
| S02 Sleeve — shoulder point → cuff seam (JACKETEK primary) | Shoulder point (dropped: armhole seam on the shoulder line) | Cuff seam (where the rib is attached); rib excluded | Along the overarm, sleeve laid straight | The sleeve-zone unit (S02 − S09 in the zone ratios). Also record S02-E to the finished cuff edge (secondary): edge ≈ seam + S09. |
| S01 Sleeve — centre back → cuff seam (comparison only); S01-E → finished cuff edge | CB neck at the collar seam | Cuff seam (S01); finished cuff edge (S01-E) | Along the shoulder line to the dropped shoulder point, then down the overarm | COMPARISON ONLY, never a target. Kept to compare with Golden Bear's "from center back" (set-in; end point assumed cuff edge). Record S01 (→ cuff seam) and S01-E (→ finished cuff edge) separately. |

S01 and S02 are two different measurements: S01 starts at centre back and crosses the shoulder; S02 starts at the dropped shoulder point. They are never interchanged, combined or converted into each other.


## Clarity

| Clarity | Count | Meaning |
|---|---|---|
| CLEAR | 40 | One unambiguous method. |
| SOURCE_AMBIGUOUS | 3 | JACKETEK's method is defined; the reference source does not state its own — sample records the alternatives. |
| CONFLICT | 1 | Two sources measure differently — never combined. |
| DISTANCE_TBD | 4 | A measuring level the pattern maker must fix before the sample. |
| PATTERN_DEPENDENT | 2 | Method clear; the landmark (dropped shoulder point) is placed by the pattern maker. |
| NOT_ON_GARMENT | 6 | Pattern / cut piece / count / calculation. |

## Body

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B01 | Chest circumference, 1" (2.54 cm) below armhole | Side seam, 2.54 cm (1") below the LEFT armhole point, measured down the side seam | Same point on the RIGHT side | flat, snapped closed | straight | flat width × 2 (= circumference) | excluded (above waistband) | — | — | SOURCE_AMBIGUOUS | JACKETEK: garment flat, snapped closed, straight side seam to side seam at 2.54 cm below the armhole point; record the flat width AND × 2. Also record pit-to-pit AT the armhole point (to compare with the supplied chart, whose height is unknown). |
| B02 | Waist circumference | Side seam at waist level | Opposite side seam at waist level | flat, snapped closed | straight | flat width × 2 (= circumference) | excluded | — | — | DISTANCE_TBD | Waist level = a fixed distance below HPS that the pattern maker must state before the sample. S.i.'s 30.7" is an example value, not a level. |
| B03 | Body width at waistband seam (above rib) | Waistband seam at the side | Waistband seam at the opposite side | flat, snapped closed | straight along the seam line | flat width × 2 (= circumference) | excluded (seam above the rib) | — | — | CLEAR | — |
| B04 | Bottom opening, relaxed | Finished bottom edge at the side fold | Opposite side fold | flat, snapped closed, relaxed | straight along the edge | flat width × 2 (= circumference) | included (rib edge) | relaxed | — | CLEAR | — |
| B05 | Bottom opening, extended | Finished bottom edge at the side fold | Opposite side fold | flat, snapped closed, stretched | straight along the edge | flat width × 2 (= circumference) | included (rib edge) | stretched to full extension without straining stitches | — | CLEAR | — |
| B06 | Centre-back length | CB neck: the collar seam at centre back | Finished bottom edge of the waistband rib at CB | flat, back facing up | straight, vertical along CB | single length | included | relaxed | — | SOURCE_AMBIGUOUS | JACKETEK: CB collar seam → finished rib edge. Golden Bear and the supplied chart do not state the start point; a start at the top of the collar adds a collar height (≈ C01). On the sample measure BOTH (collar seam and top of collar) and B07 (from HPS). |
| B07 | Back length from HPS | HPS (shoulder seam meets collar seam) | Finished bottom edge | flat, back facing up | straight, parallel to CB | single length | included | relaxed | — | CLEAR | — |
| B08 | Front length from HPS | HPS | Finished bottom edge | flat, snapped closed | straight, parallel to CF | single length | included | relaxed | — | CLEAR | Same definition as S.i. row 1 "FRONT LENGTH from HPS" (its 28" is an example value). |
| B09 | Across shoulder | LEFT shoulder point — dropped shoulder: where the sleeve-attachment (armhole) seam line crosses the shoulder line (shoulder seam extended to the top fold), below and outside the wearer's natural shoulder | RIGHT shoulder point, same definition | flat, back facing up | straight point to point across the back, garment flat, back facing up | single width | — | — | — | PATTERN_DEPENDENT | K1 = DROPPED_SHOULDER. The shoulder point is wherever the pattern maker places the armhole seam, so B09 is a construction result, not a fit reference. Measured straight at the seam LINE (not the seam edge); on the sample also record the contour along the back. Golden Bear's 19½" is a set-in measure and does not transfer. |
| B10 | Shoulder length | HPS | Shoulder point (dropped: armhole seam on the shoulder line) | flat | straight along the shoulder seam / shoulder line | single length | — | — | — | PATTERN_DEPENDENT | K1 = DROPPED_SHOULDER: includes the drop extension, so it is set by where the pattern maker places the shoulder point; confirmed on the sample. |
| B11 | Shoulder drop | HPS level | Shoulder-point level (dropped shoulder point) | flat | vertical | single distance | — | — | — | CLEAR | Shoulder slope to the DROPPED shoulder point — larger than on a set-in block. Not the same as the drop extension (see the shoulder-construction parameters). |
| B12 | Across front | Left front armhole seam | Right front armhole seam | flat, snapped closed | straight | single width | — | — | — | DISTANCE_TBD | Level below HPS to be fixed by the pattern maker. |
| B13 | Across back | Left back armhole seam | Right back armhole seam | flat, back facing up | straight | single width | — | — | — | DISTANCE_TBD | Level below HPS to be fixed by the pattern maker. |
| B14 | Armhole depth | HPS level | Armhole-point (underarm) level | flat | vertical | single distance | — | — | — | CLEAR | Dropped shoulders normally lower the armhole point; the depth is the pattern maker's. |
| B15 | Armhole, straight | Shoulder point (dropped) | Armhole point | flat | straight | one side | — | — | — | CLEAR | Starts at the DROPPED shoulder point. Same name as S.i. row 6 "ARMHOLE (straight)" (9¾" is an example value). |
| B16 | Armhole, curved (along seam) | Shoulder point (dropped) | Shoulder point (full circuit, front + back) | flat | along the curve of the armhole seam | full armhole | — | — | — | CLEAR | Along the dropped armhole seam. |

## Sleeve

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 | Sleeve length from centre back | CB neck at the collar seam | Cuff seam (rib excluded) = S01; finished cuff edge = S01-E (both comparison only) | flat, sleeve laid straight | along the shoulder line to the dropped shoulder point, then down the overarm | single length | excluded at the cuff seam (edge value also recorded) | relaxed | centre back | SOURCE_AMBIGUOUS | Retained as a COMPARISON reference with Golden Bear (which states only "from center back"; end point assumed cuff edge). A CB sleeve changes less with the shoulder construction than a shoulder-point sleeve, but Golden Bear's value is still set-in and not directly transferable. Never interchanged with S02 (MC-01). Sample: record S01 = CB → cuff seam AND S01-E = CB → finished cuff edge, separately; both are comparison / reference measurements, not JACKETEK sleeve targets. |
| S02 | Sleeve length from shoulder point (overarm) | Shoulder point (dropped: armhole seam on the shoulder line) | Cuff seam (rib excluded) = S02, JACKETEK primary; finished cuff edge = S02-E, secondary | flat, sleeve laid straight | along the overarm, sleeve laid straight | single length | excluded at the cuff seam (edge value also recorded) | relaxed | shoulder point | CONFLICT | JACKETEK primary sleeve method: shoulder point → cuff seam (the unit the sleeve embroidery zones use: S02 − S09). v0.1 wrote S02 to the finished cuff edge: the sample records both, and edge = seam + S09. On the dropped shoulder the shoulder point is lower on the arm, so S02 is shorter than on a set-in sleeve for the same arm. The supplied chart's 51 cm is not entered (MC-01). |
| S03 | Underarm sleeve length | Armhole point | Finished cuff edge | flat | along the underarm seam | single length | included | relaxed | underarm | CLEAR | Depends on the armhole depth the dropped-shoulder pattern sets. |
| S04 | Bicep width, 1" below armhole | Underarm seam, 2.54 cm below the armhole point | Sleeve fold opposite | flat | straight, perpendicular to the sleeve centre line | flat width (half circumference) | — | — | — | CLEAR | A dropped-shoulder sleeve is usually wider at the top; value from the pattern, measured on the sample. |
| S05 | Elbow width | Underarm seam at elbow level | Sleeve fold opposite | flat | straight, perpendicular to the sleeve line | flat width (half circumference) | — | — | — | DISTANCE_TBD | Elbow level = distance from the shoulder point to be fixed by the pattern maker. |
| S06 | Sleeve width at cuff seam (above rib) | Cuff seam, underarm side | Cuff seam, fold side | flat | straight along the cuff seam | flat width (half circumference) | excluded (seam above the rib) | — | — | CLEAR | — |
| S07 | Cuff opening, relaxed | Finished cuff edge | Finished cuff edge, opposite fold | flat, relaxed | straight along the edge | flat width (half circumference) | included (rib edge) | relaxed | — | CLEAR | S.i. row 9 "SLEEVE OPENING (flat)" 21" is an example value and cannot be a rib cuff edge — not mapped. |
| S08 | Cuff opening, extended | Finished cuff edge | Finished cuff edge, opposite fold | flat, stretched | straight along the edge | flat width (half circumference) | included (rib edge) | stretched to full extension | — | CLEAR | — |
| S09 | Cuff rib height | Cuff seam | Finished cuff edge | flat, relaxed | straight | single height | rib only | relaxed | — | CLEAR | — |
| S10 | Sleeve cap height (pattern) | Bicep line (pattern) | Top of the sleeve cap (pattern) | pattern piece | straight on the net pattern | pattern measure (excl. seam allowance) | — | — | — | NOT_ON_GARMENT | Pattern only. K1 = DROPPED_SHOULDER: a low, flat cap — the pattern maker sets it. |

## Rib

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | Waistband rib height | Waistband seam at CB | Finished bottom edge at CB | flat, relaxed | straight | single height | rib only | relaxed | — | CLEAR | — |
| R02 | Waistband rib cut length | — | — | cut piece | cut piece | cut length | rib piece | unstretched | — | NOT_ON_GARMENT | Computed: B03 × the rib ratio the pattern maker sets; the pattern maker states whether seam allowance is included. |
| R03 | Cuff rib cut length | — | — | cut piece | cut piece | cut length | rib piece | unstretched | — | NOT_ON_GARMENT | Computed: S06 × the rib ratio; seam allowance as the pattern maker states. |
| R04 | Collar rib cut length | — | — | cut piece | cut piece | cut length | rib piece | unstretched | — | NOT_ON_GARMENT | Computed: C03 × the rib ratio; seam allowance as the pattern maker states. |
| R05 | Rib stripe layout (count, stripe widths, distance from edge) | Finished edge | Each stripe edge | flat, relaxed | straight, perpendicular to the edge | per rib piece | rib only | relaxed | — | CLEAR | — |

## Collar & neck

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | Collar height at CB | Collar seam at CB | Collar outer edge at CB | flat, relaxed | straight, collar standing / unfolded | single height | collar rib | relaxed | — | CLEAR | S.i. row 11 "COLLAR HEIGHT" does not say where; JACKETEK measures at CB (C01) and the front ends (C02). |
| C02 | Collar height at front ends | Collar seam at the front end | Collar outer edge at the front end | flat, relaxed | straight | single height | collar rib | relaxed | — | CLEAR | — |
| C03 | Collar neck-edge length (attached edge) | Left collar front end | Right collar front end | flat, relaxed | along the collar seam (curve) | full length | collar rib | relaxed | — | CLEAR | — |
| C04 | Collar outer-edge length, relaxed | Left outer corner | Right outer corner | flat, relaxed | along the outer edge (curve) | full length | collar rib | relaxed | — | CLEAR | — |
| C05 | Neck width, seam to seam | Left HPS at the collar seam | Right HPS at the collar seam | flat | straight | single width | — | — | — | CLEAR | — |
| C06 | Front neck drop | HPS line | Collar seam at CF | flat, snapped closed | vertical | single distance | — | — | — | CLEAR | Same name as S.i. row 10 "FRONT NECKLINE DROP" (7.5" is an example value). |
| C07 | Back neck drop | HPS line | Collar seam at CB | flat, back facing up | vertical | single distance | — | — | — | CLEAR | — |

## Front & closure

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | Front placket / facing width (finished) | Front edge | Placket inner stitch line | flat, snapped closed | straight, perpendicular to the front edge | single width | — | — | — | CLEAR | — |
| F02 | Front overlap (CF to front edge) | CF line | Overlapping front edge | flat, snapped closed | straight, perpendicular | single width | — | — | — | CLEAR | — |
| F03 | Snap count | — | — | — | count | count | — | — | — | NOT_ON_GARMENT | A count, not a length. |
| F04 | Top snap position below neck seam | Collar seam at the front edge | Top snap centre | flat, snapped closed | straight along the front edge | single distance | — | — | — | CLEAR | — |
| F05 | Bottom snap position above bottom edge | Finished bottom edge | Bottom snap centre | flat, snapped closed | straight along the front edge | single distance | included if the snap sits on the rib | relaxed | — | CLEAR | — |
| F06 | Snap spacing (centre to centre) | Snap centre | Next snap centre | flat, snapped closed | straight | single distance | — | — | — | NOT_ON_GARMENT | Computed from F03–F05 (equal spacing unless the pattern maker states otherwise); verified on the sample. |
| F07 | Snap centre from front edge | Front edge | Snap centre | flat, snapped closed | straight, perpendicular | single distance | — | — | — | CLEAR | — |

## Pockets

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | Pocket opening length | Upper end of the opening | Lower end of the opening | flat, snapped closed | straight along the opening | single length | — | — | — | CLEAR | S.i. row 12 "WELT POCKET LENGTH" (7" is an example value). |
| P02 | Pocket welt width | Welt seam | Welt edge | flat | straight, perpendicular to the opening | single width | — | — | — | CLEAR | S.i. row 13 "WELT POCKET WIDTH" (1.2" is an example value). |
| P03 | Pocket position below HPS (top of opening) | HPS | Upper end of the opening | flat, snapped closed | vertical | single distance | — | — | — | CLEAR | — |
| P04 | Pocket position from CF (top of opening) | CF line | Upper end of the opening | flat, snapped closed | horizontal | single distance | — | — | — | CLEAR | — |
| P05 | Pocket opening angle | Vertical reference | Opening line | flat, snapped closed | angle | degrees | — | — | — | CLEAR | — |
| P06 | Pocket bag depth | Lower end of the opening (inside) | Bottom of the pocket bag | flat (inside) | straight | single length | — | — | — | CLEAR | — |
| P07 | Pocket bag width | Pocket bag edge | Opposite bag edge | flat (inside) | straight, widest point | single width | — | — | — | CLEAR | — |

## Lining

| POM | Name | Landmark A | Landmark B | Laid | Path | Extent | Rib | Rib state | Sleeve ref. | Clarity | Resolution / note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L01 | Lining CB length relative to shell | Lining CB neck | Lining hem seam | inside out, flat | straight along CB | difference lining − shell | — | — | — | CLEAR | — |
| L02 | Lining sleeve length relative to shell | Lining armhole | Lining cuff seam | inside out, flat | along the overarm | difference lining − shell | — | — | — | CLEAR | — |
| L03 | Lining chest width relative to shell | Lining side seam | Opposite lining side seam | inside out, flat | straight | difference lining − shell | — | — | — | CLEAR | — |
| L04 | Inside pocket opening (if fitted) | Opening end | Opening end | inside, flat | straight | single length | — | — | — | CLEAR | Only if an inside pocket is fitted (undecided). |

## Method conflicts

| ID | POMs | Conflict | Result |
|---|---|---|---|
| MC-01 | S01, S02 | Sleeve: centre back vs shoulder seam | MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED — no JACKETEK sleeve target. |
| MC-02 | B09, B10, B11, B14, B15, B16, S01, S02, S03, S04, S10 | Shoulder construction (K1) moves the shoulder point | K1 resolved. B09 / B10 → TBD_PATTERN_MAKER (shoulder point placed by the pattern maker); S01 / S02 measured on the sample from the dropped shoulder point; no new cm values. |
| MC-03 | B01 | Chest height | Used together as a provisional RANGE only (Rule 1, with this caveat). Sample records both levels. |
| MC-04 | B06 | Body length start point | Provisional range kept; LOW confidence. Sample records CB-from-collar-seam, CB-from-top-of-collar and B07. |
| MC-05 | B09 | Across shoulder: straight vs contour | JACKETEK defines straight at the armhole seam line; sample also records the contour. |
| MC-06 | S07, S06 | S.i. "SLEEVE OPENING (flat)" / "CUFF OPENING (flat)" | Example value; not mapped to S07 or S06. |
| MC-07 | C01, C02 | S.i. "COLLAR HEIGHT" position | Example value; JACKETEK measures both (C01, C02). |
| MC-08 | B08, B06 | Legacy chart "jacket length" is a front length | Legacy chart excluded. |
