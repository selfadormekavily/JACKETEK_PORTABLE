# JACKETEK Master Garment Spec — Validation Draft v0.1

**Status: VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Date: 2026-10-08. Not connected to the website.

Product: Senior / Varsity / Letterman jacket with a deliberately roomy, baggy silhouette.

**Decisions recorded**

- Primary silhouette reference: **Golden Bear Classic Fit Varsity Jacket**, base size M.
- Primary tech-pack reference: **S.i. Graphics Varsity Letterman Jacket Tech Pack**, used for document structure, POM organisation, BOM, artwork and construction format **only**. Its example numbers are not used anywhere in this document.
- Secondary: a **JACKETEK visual fit reference** (size chart supplied by JACKETEK) is added as `SECONDARY_VISUAL_REFERENCE` — M values only, used as a visual-fit cross-check. Not verified, not used for grading (§3A).
- LineDrop PixelVarsity is **not** used (could not be independently verified).
- Golden Bear L is **not** relabelled as JACKETEK M. Any extra ease is decided on a physical sample by a pattern maker, without blindly lengthening sleeve or body.

**How to read this document**

| Status (one per measurement) | Certainty tag | Meaning |
|---|---|---|
| VERIFIED_SOURCE | KNOWN | A number published by the primary source. Still a reference, not a JACKETEK production value. |
| TO_MEASURE_ON_SAMPLE | NEEDS SAMPLE | No reliable number exists. Measure it on the physical reference sample. Value left blank. |
| TO_SET_BY_PATTERN_MAKER | NEEDS PATTERN MAKER | A JACKETEK design/pattern decision. Value left blank. |
| DERIVED_FROM_APPROVED_SPEC | DERIVED | Calculated from other values once they are approved (or, for §3, from the published base + grade). |

**UNKNOWN** marks items whose existence on the JACKETEK jacket is itself undecided (e.g. zipper, cuff protector, quilting).

Revision: v0.1 rev 2 — added §3A secondary visual fit reference, the provisional target range in §5, and §12 sample strategy.

Contents: 1 POM register · 2 Source status · 3 Golden Bear values · 3A Secondary visual fit reference · 4 Measurement method normalisation · 5 JACKETEK fit validation · 6 BOM · 7 Construction · 8 Embroidery zones · 9 Fixed vs customer data · 10 Sample checklist · 11 Certainty overview · 12 Sample strategy · 13 Summary

## 1. POM register

56 points of measure. Abbreviations: HPS = high point shoulder (shoulder meets collar), SP = shoulder point (shoulder meets sleeve), CB/CF = centre back/front. Values for VERIFIED_SOURCE POMs are in §3; every other value is blank by design.

### Body

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| B01 | Chest circumference, 1" (2.54 cm) below armhole | محيط الصدر: يُقاس أفقياً على بُعد 1 إنش (2.54 سم) تحت نقطة الإبط، من خياطة الجنب إلى خياطة الجنب، والقيمة هي المحيط الكامل (العرض المسطح × 2). | Straight across the body at 1" below the armhole point, side seam to side seam; reported as full circumference (flat width × 2). | Side seam, 1" below left armhole point | Side seam, 1" below right armhole point | flat, snapped closed | in (source) / cm | `VERIFIED_SOURCE` | **KNOWN** |
| B02 | Waist circumference | محيط الخصر: عرض الجسم الأفقي عند مستوى الخصر (على مسافة ثابتة من نقطة الكتف العليا HPS تُحدَّد لاحقاً)، المحيط الكامل. | Straight across the body at a fixed distance below HPS (distance to be fixed by pattern maker), side seam to side seam × 2. | Side seam at waist level | Opposite side seam at waist level | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B03 | Body width at waistband seam (above rib) | عرض الجسم عند خياطة تركيب الحزام المطاطي (فوق الرِّب مباشرة)، المحيط الكامل. | Along the seam joining body to waistband rib, side to side, × 2. | Waistband seam at side | Waistband seam at opposite side | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B04 | Bottom opening, relaxed | فتحة الأسفل وهي مرتخية: محيط الحافة السفلية للحزام المطاطي دون أي شد. | Along the finished bottom edge of the waistband rib, relaxed, × 2. | Bottom edge at side fold | Bottom edge at opposite side fold | flat, snapped closed, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B05 | Bottom opening, extended | فتحة الأسفل مشدودة: محيط الحافة السفلية للحزام المطاطي عند شدّه إلى أقصى امتداد دون إجهاد الغرز. | Same line as B04, stretched to full extension without straining stitches, × 2. | Bottom edge at side fold | Bottom edge at opposite side fold | flat, snapped closed, stretched | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B06 | Centre-back length | الطول من منتصف الظهر: من منتصف الظهر عند خياطة الياقة نزولاً حتى الحافة السفلية للحزام. (نقطة البداية عند Golden Bear غير محددة — انظر القسم 4.) | Vertical along the CB line from the CB neck point to the finished bottom edge. Golden Bear's start point is NOT stated (see §4). | CB neck (collar seam — UNCONFIRMED for source) | Finished bottom edge of waistband rib (UNCONFIRMED for source) | flat, back facing up | in (source) / cm | `VERIFIED_SOURCE` | **KNOWN** |
| B07 | Back length from HPS | الطول الخلفي من نقطة الكتف العليا (HPS) حتى الحافة السفلية، يُقاس على الظهر موازياً لمنتصف الظهر. | From HPS straight down, parallel to CB, to the finished bottom edge (back view). Measured to reconcile B06's start point. | HPS | Finished bottom edge | flat, back facing up | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B08 | Front length from HPS | الطول الأمامي: من نقطة الكتف العليا (التقاء الكتف بالياقة) نزولاً موازياً لمنتصف الأمام حتى الحافة السفلية. | From HPS straight down, parallel to CF, to the finished bottom edge. | HPS | Finished bottom edge | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B09 | Across shoulder | عرض الكتفين: من نقطة الكتف إلى نقطة الكتف (عند خياطة تركيب الكم) عبر الظهر. | Straight line across the back from shoulder point to shoulder point (armhole seam at the shoulder). Straight vs contour NOT stated by source (see §4). | Left shoulder point | Right shoulder point | flat, back facing up | in (source) / cm | `VERIFIED_SOURCE` | **KNOWN** |
| B10 | Shoulder length | طول الكتف: من نقطة الكتف العليا (HPS) إلى نقطة الكتف عند خياطة الكم. | Along the shoulder seam from HPS to shoulder point. | HPS | Shoulder point | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B11 | Shoulder drop | ميل الكتف: الفرق العمودي بين مستوى نقطة الكتف العليا ومستوى نقطة الكتف. | Vertical distance between the HPS level and the shoulder-point level. | HPS level | Shoulder point level | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B12 | Across front | عرض الأمام: المسافة بين خياطتي تركيب الكم من الأمام، على مسافة ثابتة تحت HPS. | Armhole seam to armhole seam across the front at a fixed distance below HPS (distance set by pattern maker). | Left front armhole seam | Right front armhole seam | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B13 | Across back | عرض الظهر: المسافة بين خياطتي تركيب الكم من الخلف، على مسافة ثابتة تحت HPS. | Armhole seam to armhole seam across the back at a fixed distance below HPS. | Left back armhole seam | Right back armhole seam | flat, back facing up | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B14 | Armhole depth | عمق الإبط: المسافة العمودية من نقطة الكتف العليا (HPS) إلى مستوى نقطة الإبط. | Vertical from HPS level to the armhole point (underarm) level. | HPS | Armhole point level | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B15 | Armhole, straight | فتحة الإبط المستقيمة: خط مستقيم من نقطة الكتف إلى نقطة الإبط، والجاكيت مسطح. | Straight line from shoulder point to armhole point, garment flat. | Shoulder point | Armhole point | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| B16 | Armhole, curved (along seam) | طول خط الإبط المنحني: يُقاس على طول خياطة تركيب الكم (الأمام + الخلف). | Along the armhole seam, front + back, shoulder point round to shoulder point. | Shoulder point | Shoulder point (full circuit) | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |

### Sleeve

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| S01 | Sleeve length from centre back | طول الكم من منتصف الظهر: من منتصف الظهر عند الرقبة، مروراً بنقطة الكتف، على طول أعلى الكم حتى حافة الكم. (المسار ونقطة البداية والنهاية غير محددة عند المصدر.) | From the CB neck point across the shoulder to the shoulder point, then down the overarm to the cuff edge. Source does not state start, path or end (see §4). | CB neck point (UNCONFIRMED for source) | Cuff edge (UNCONFIRMED: rib edge assumed) | flat, sleeve laid straight | in (source) / cm | `VERIFIED_SOURCE` | **KNOWN** |
| S02 | Sleeve length from shoulder point (overarm) | طول الكم من نقطة الكتف: من نقطة الكتف على طول الخط العلوي للكم حتى حافة الكم. | From shoulder point along the overarm to the finished cuff edge. | Shoulder point | Finished cuff edge | flat, sleeve laid straight | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S03 | Underarm sleeve length | طول الكم الداخلي: من نقطة الإبط على طول خياطة الكم الداخلية حتى حافة الكم. | From armhole point along the underarm seam to the finished cuff edge. | Armhole point | Finished cuff edge | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S04 | Bicep width, 1" below armhole | عرض العضد: عرض الكم المسطح على بُعد 1 إنش (2.54 سم) تحت الإبط، عمودياً على خط الكم (نصف المحيط). | Flat width perpendicular to the sleeve centre line, 1" below the armhole point (half circumference). | Underarm seam, 1" below armhole point | Sleeve fold opposite | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S05 | Elbow width | عرض الكوع: عرض الكم المسطح عند مستوى الكوع (على مسافة ثابتة من نقطة الكتف تُحدَّد لاحقاً). | Flat width perpendicular to the sleeve line at a fixed distance from shoulder point (distance set by pattern maker). | Underarm seam at elbow level | Sleeve fold opposite | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S06 | Sleeve width at cuff seam (above rib) | عرض الكم عند خياطة تركيب رِب الكم (فوق الرِّب مباشرة). | Flat width along the seam joining sleeve to cuff rib. | Cuff seam, underarm side | Cuff seam, fold side | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S07 | Cuff opening, relaxed | فتحة الكم وهي مرتخية: عرض الحافة النهائية للكم دون شد. | Flat width along the finished cuff edge, relaxed. | Cuff edge | Cuff edge opposite | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S08 | Cuff opening, extended | فتحة الكم مشدودة: عرض الحافة النهائية للكم عند شدّها إلى أقصى امتداد. | Flat width along the finished cuff edge, stretched to full extension. | Cuff edge | Cuff edge opposite | flat, stretched | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S09 | Cuff rib height | ارتفاع رِب الكم: من خياطة تركيب الرِّب حتى حافة الكم النهائية. | From the cuff seam to the finished cuff edge. | Cuff seam | Finished cuff edge | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| S10 | Sleeve cap height (pattern) | ارتفاع رأس الكم: قياس على الباترون (وليس على القطعة الجاهزة) يحدده الباترونيست. | Pattern measurement: from the bicep line to the top of the sleeve cap on the sleeve pattern. | Bicep line (pattern) | Cap top (pattern) | pattern piece | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |

### Rib

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| R01 | Waistband rib height | ارتفاع رِب الحزام السفلي: من خياطة التركيب حتى الحافة السفلية. | From the waistband seam to the finished bottom edge, at CB. | Waistband seam | Finished bottom edge | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| R02 | Waistband rib cut length | طول قصّ رِب الحزام: يُحسب من فتحة الأسفل المعتمدة ونسبة شد الرِّب التي يحددها الباترونيست. | Computed from approved bottom opening (B03/B04) and the rib-to-opening ratio set by the pattern maker. | — | — | cut piece | cm | `DERIVED_FROM_APPROVED_SPEC` | **DERIVED** |
| R03 | Cuff rib cut length | طول قصّ رِب الكم: يُحسب من عرض الكم المعتمد عند الخياطة ونسبة الشد. | Computed from approved sleeve width at cuff seam (S06) and the rib ratio. | — | — | cut piece | cm | `DERIVED_FROM_APPROVED_SPEC` | **DERIVED** |
| R04 | Collar rib cut length | طول قصّ رِب الياقة: يُحسب من طول خط الرقبة المعتمد ونسبة الشد. | Computed from approved collar neck-edge length (C03) and the rib ratio. | — | — | cut piece | cm | `DERIVED_FROM_APPROVED_SPEC` | **DERIVED** |
| R05 | Rib stripe layout (count, stripe widths, distance from edge) | تصميم الخطوط على الرِّب: عدد الخطوط وعرض كل خط وبُعدها عن الحافة (للياقة والكم والحزام). | Per rib piece: number of stripes, each stripe width and its distance from the finished edge. | Finished edge | Each stripe edge | flat, relaxed | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |

### Collar & neck

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| C01 | Collar height at CB | ارتفاع الياقة عند منتصف الظهر: من خياطة تركيب الياقة حتى حافتها الخارجية. | At CB, from the collar seam to the collar's outer edge, collar standing/unfolded. | Collar seam at CB | Collar outer edge at CB | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| C02 | Collar height at front ends | ارتفاع الياقة عند طرفيها الأماميين. | At the collar's front end, from collar seam to outer edge. | Collar seam at front end | Collar outer edge at front end | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| C03 | Collar neck-edge length (attached edge) | طول الياقة عند خط التركيب: من الطرف الأمامي إلى الطرف الأمامي الآخر على طول خياطة الرقبة. | Along the collar seam from front end to front end. | Left collar front end | Right collar front end | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| C04 | Collar outer-edge length, relaxed | طول الحافة الخارجية للياقة وهي مرتخية. | Along the collar's outer edge from front end to front end, relaxed. | Left outer corner | Right outer corner | flat, relaxed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| C05 | Neck width, seam to seam | عرض فتحة الرقبة: المسافة المستقيمة بين نقطتي الكتف العليا (HPS) عند خياطة الياقة. | Straight line between left and right HPS at the collar seam. | Left HPS | Right HPS | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| C06 | Front neck drop | انخفاض الرقبة الأمامي: المسافة العمودية من خط HPS إلى أدنى نقطة في خياطة الياقة عند منتصف الأمام. | Vertical from the HPS line to the collar seam at CF. | HPS line | Collar seam at CF | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| C07 | Back neck drop | انخفاض الرقبة الخلفي: المسافة العمودية من خط HPS إلى خياطة الياقة عند منتصف الظهر. | Vertical from the HPS line to the collar seam at CB. | HPS line | Collar seam at CB | flat, back facing up | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |

### Front & closure

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| F01 | Front placket / facing width (finished) | عرض المرد الأمامي (شريط الكبسات) بعد التشطيب. | Finished width of the snap placket/facing, perpendicular to the front edge. | Front edge | Placket inner stitch line | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| F02 | Front overlap (CF to front edge) | التراكب الأمامي: المسافة من خط منتصف الأمام إلى حافة الأمام العلوية. | From the CF line to the overlapping front edge. | CF line | Front edge | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| F03 | Snap count | عدد الكبسات في الأمام. | Number of snap sets on the front closure (count, not a length). | — | — | — | count | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| F04 | Top snap position below neck seam | موضع الكبسة العليا: المسافة من خياطة الياقة عند الأمام حتى مركز الكبسة. | From the collar seam at the front edge down to the top snap centre. | Collar seam at front edge | Top snap centre | flat, snapped closed | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| F05 | Bottom snap position above bottom edge | موضع الكبسة السفلى: المسافة من الحافة السفلية حتى مركز الكبسة (أو على رِب الحزام). | From the finished bottom edge up to the bottom snap centre. | Finished bottom edge | Bottom snap centre | flat, snapped closed | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| F06 | Snap spacing (centre to centre) | المسافة بين الكبسات (من المركز إلى المركز): تُحسب من عدد الكبسات وموضعي العليا والسفلى. | Computed from F03–F05 (equal spacing unless the pattern maker specifies otherwise). | Snap centre | Next snap centre | flat, snapped closed | cm | `DERIVED_FROM_APPROVED_SPEC` | **DERIVED** |
| F07 | Snap centre from front edge | بُعد مركز الكبسة عن حافة الأمام. | Perpendicular from the front edge to the snap centre. | Front edge | Snap centre | flat, snapped closed | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |

### Pockets

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| P01 | Pocket opening length | طول فتحة الجيب: على طول الفتحة من طرف إلى طرف. | Along the pocket opening, end to end. | Opening end (top) | Opening end (bottom) | flat, snapped closed | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| P02 | Pocket welt width | عرض شريط الجيب (الويلت). | Finished welt width, perpendicular to the opening. | Welt seam | Welt edge | flat | cm | `TO_MEASURE_ON_SAMPLE` | **NEEDS SAMPLE** |
| P03 | Pocket position below HPS (top of opening) | موضع الجيب العمودي: من HPS حتى الطرف العلوي لفتحة الجيب. | Vertical from HPS to the upper end of the pocket opening. | HPS | Upper end of opening | flat, snapped closed | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| P04 | Pocket position from CF (top of opening) | موضع الجيب الأفقي: من منتصف الأمام حتى الطرف العلوي لفتحة الجيب. | Horizontal from CF to the upper end of the pocket opening. | CF line | Upper end of opening | flat, snapped closed | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| P05 | Pocket opening angle | زاوية فتحة الجيب بالنسبة للخط العمودي. | Angle of the opening from vertical (degrees). | Vertical reference | Opening line | flat, snapped closed | deg | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| P06 | Pocket bag depth | عمق كيس الجيب الداخلي. | From the opening's lower end to the bottom of the pocket bag. | Opening lower end | Bag bottom | flat (inside) | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| P07 | Pocket bag width | عرض كيس الجيب الداخلي. | Widest point of the pocket bag. | Bag edge | Bag edge opposite | flat (inside) | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |

### Lining

| POM ID | Name | Arabic explanation | Method | Start | End | Condition | Unit | Source status | Certainty |
|---|---|---|---|---|---|---|---|---|---|
| L01 | Lining CB length relative to shell | طول البطانة عند منتصف الظهر مقارنةً بالقماش الخارجي (مقدار الزيادة أو الثنية). | Difference between lining CB length and shell CB length (jump/ease allowance). | Lining CB neck | Lining hem seam | inside out, flat | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| L02 | Lining sleeve length relative to shell | طول بطانة الكم مقارنةً بالكم الخارجي. | Difference between lining sleeve length and shell sleeve length. | Lining armhole | Lining cuff seam | inside out, flat | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| L03 | Lining chest width relative to shell | عرض البطانة عند الصدر مقارنةً بالقماش الخارجي (مع مراعاة سماكة الحشوة إن وُجدت). | Difference between lining chest and shell chest, allowing for quilt/wadding bulk. | Lining side seam | Lining side seam opposite | inside out, flat | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |
| L04 | Inside pocket opening (if fitted) | فتحة الجيب الداخلي في البطانة (إن وُجد — غير مقرر بعد). | Opening length of an inside lining pocket. Whether one is fitted is undecided. | Opening end | Opening end | inside, flat | cm | `TO_SET_BY_PATTERN_MAKER` | **NEEDS PATTERN MAKER** |

## 2. Source status

| Status | POMs | IDs |
|---|---|---|
| `VERIFIED_SOURCE` | 4 | B01, B06, B09, S01 |
| `TO_MEASURE_ON_SAMPLE` | 33 | B02, B03, B04, B05, B07, B08, B10, B11, B12, B13, B14, B15, B16, S02, S03, S04, S05, S06, S07, S08, S09, R01, C01, C02, C03, C04, C05, C06, C07, F01, F02, P01, P02 |
| `TO_SET_BY_PATTERN_MAKER` | 15 | S10, R05, F03, F04, F05, F07, P03, P04, P05, P06, P07, L01, L02, L03, L04 |
| `DERIVED_FROM_APPROVED_SPEC` | 4 | R02, R03, R04, F06 |

Rules applied: no blank was filled from an industry average, a sewing blog, a template placeholder or another brand. Dehen 1920, Sport-Tek and the S.i. Graphics example values from the research are **not** used as values. Rib, collar, armhole and placement figures found in the research were all low-authority and are left blank.

## 3. Golden Bear Classic Fit reference values

> **REFERENCE — NOT YET JACKETEK PRODUCTION APPROVED**

Source: [Golden Bear size chart](https://www.goldenbearsportswear.com/pages/size-chart), accessed 2026-10-08. Garment measurements, published in inches. Inches are the source values; cm are exact conversions (× 2.54). XS–XXL are derived only from the published M base and the published grade. They match the per-size rows Golden Bear publishes (checked by the build script).

**Base M and grade**

| POM | Name | Source label | M (in, source) | M (cm) | Grade / size (in) | Grade / size (cm) | Status |
|---|---|---|---|---|---|---|---|
| B01 | Chest circumference, 1" (2.54 cm) below armhole | "Chest (1" below armhole)" | 49 | 124.46 | +3 | +7.62 | `VERIFIED_SOURCE` |
| B09 | Across shoulder | "Across Shoulder" | 19½ | 49.53 | +¾ | +1.905 | `VERIFIED_SOURCE` |
| S01 | Sleeve length from centre back | "Sleeve (from center back)" | 35½ | 90.17 | +¾ | +1.905 | `VERIFIED_SOURCE` |
| B06 | Centre-back length | "Center back" | 26½ | 67.31 | +½ | +1.27 | `VERIFIED_SOURCE` |

**Per size** (in / cm)

| POM | XS | S | M | L | XL | XXL |
|---|---|---|---|---|---|---|
| B01 Chest circumference, 1" (2.54 cm) below armhole | 43 / 109.22 | 46 / 116.84 | 49 / 124.46 (base) | 52 / 132.08 | 55 / 139.7 | 58 / 147.32 |
| B09 Across shoulder | 18 / 45.72 | 18¾ / 47.625 | 19½ / 49.53 (base) | 20¼ / 51.435 | 21 / 53.34 | 21¾ / 55.245 |
| S01 Sleeve length from centre back | 34 / 86.36 | 34¾ / 88.265 | 35½ / 90.17 (base) | 36¼ / 92.075 | 37 / 93.98 | 37¾ / 95.885 |
| B06 Centre-back length | 25½ / 64.77 | 26 / 66.04 | 26½ / 67.31 (base) | 27 / 68.58 | 27½ / 69.85 | 28 / 71.12 |

Certainty: M values are **KNOWN** (published). XS, S, L, XL, XXL are **DERIVED** (base + grade), and agree with the published rows.

## 3A. Secondary visual fit reference

> **Classification: `SECONDARY_VISUAL_REFERENCE`** — JACKETEK visual fit reference / secondary benchmark. **Not** `VERIFIED_SOURCE`: its original source and measuring methods have not been independently verified. Golden Bear Classic remains the primary verified reference.

A second real-world varsity / senior jacket size chart, supplied by JACKETEK, whose silhouette JACKETEK visually prefers. Its purpose:

- confirm that the preferred silhouette is numerically close to Golden Bear Classic M;
- help define the JACKETEK target fit.

It does **not** define factory grading and does **not** replace physical sample approval. **Only its M values are recorded.** Its XS–4XL progression appears irregular and is deliberately not copied into this spec (not even into the JSON).

| Measurement (M) | Visual reference | Method as known | Status |
|---|---|---|---|
| Chest, half / flat | 61 cm | Half / flat chest; how far below the armhole is not known | `SECONDARY_VISUAL_REFERENCE` |
| Across shoulder | 50 cm | Not stated | `SECONDARY_VISUAL_REFERENCE` |
| Body length | 68 cm | Start point (CB collar seam / top of collar / HPS) not known | `SECONDARY_VISUAL_REFERENCE` |
| Sleeve from shoulder seam | 51 cm | From the shoulder seam; end point not known | `SECONDARY_VISUAL_REFERENCE` — not comparable with Golden Bear |

**Comparison with Golden Bear Classic M**

| Measurement | Visual reference M | Golden Bear M | Difference (visual − GB) | Caveat |
|---|---|---|---|---|
| Chest, half / flat | 61 cm | 62.23 cm (49 in ÷ 2 = half of 124.46) | -1.23 cm (-1.98 %) | GB value is the published circumference ÷ 2 (1" below armhole). Where the visual chart measures its half chest (pit-to-pit at the armhole, or lower) is not known. |
| Across shoulder | 50 cm | 49.53 cm (B09) | +0.47 cm (+0.95 %) | Neither chart states straight vs contour. |
| Body length | 68 cm | 67.31 cm (B06) | +0.69 cm (+1.03 %) | GB is centre-back length (start point not stated). The visual chart's start point (CB collar seam, top of collar or HPS) is not known. |

**These three comparable measurements are extremely close.** Each differs from Golden Bear Classic M by less than 1.3 cm, which is about 2 % or less. The visual reference is 1.23 cm narrower in half chest (2.46 cm in full circumference), 0.47 cm wider in the shoulder and 0.69 cm longer in the body. Differences this small are within what an unknown measuring method alone could explain (e.g. chest taken at the armhole instead of 1" below it, or length from the top of the collar instead of the collar seam). So the jacket JACKETEK prefers visually and Golden Bear Classic M describe essentially the **same chest, shoulder and length proportions**. This supports keeping Golden Bear Classic M as the base block.

**Sleeve — not compared.** Golden Bear measures the sleeve from centre back (35½ in / 90.17 cm); the visual chart from the shoulder seam (51 cm). The two numbers must not be compared. One flag only: subtracting half of Golden Bear's across shoulder from its CB sleeve gives 65.41 cm (arithmetic, not a published POM). The visual chart's 51 cm is far shorter, so its sleeve is probably measured to a different end point or along the underarm. **Confirm the visual chart's sleeve method before it informs any sleeve decision.** The sleeve is set on the fit model (§5).

**To upgrade this reference** (optional): record the brand, the chart's URL or a photo of the label, and its stated measuring methods. If they can be independently verified, the M values may be reclassified; the grading still would not be used.

## 4. Measurement method normalisation

Each sourced value is recorded with what the source actually says and what it does not. Values measured by different methods are never combined.

| POM | Source wording | Stated by source | Assumed in this draft (to confirm) | Not stated |
|---|---|---|---|---|
| B01 Chest | "Chest (1" below armhole)" | 1" below armhole | Full circumference = flat width × 2, snapped closed, measured side seam to side seam | Flat × 2 vs tape; closed or open; exact armhole reference |
| S01 Sleeve | "Sleeve (from center back)" | Starts at centre back | CB at collar seam → shoulder seam → SP → overarm → finished cuff edge (rib included) | Start height, path, end point |
| B06 CB length | "Center back" | Measured at CB | CB collar seam → finished bottom edge (rib included) | Start point (collar seam / top of collar / HPS), end point |
| B09 Across shoulder | "Across Shoulder" | Across the shoulders | Straight, SP to SP across the back, at the seam line | Straight vs contour; seam line vs edge; raglan styles |
| Visual reference (all) | Half chest / shoulder / body length / sleeve from shoulder seam | Sleeve starts at shoulder seam; chest is a half (flat) value | None — not used to define any method | Chest height below armhole; shoulder method; length start; sleeve end. Never combined with Golden Bear values beyond the §3A cross-check |

**Unresolved Golden Bear method ambiguities**

| ID | POM | Issue | Detail |
|---|---|---|---|
| GB-A1 | B06 | Centre-back length: start point not stated | Header reads only "Center back". Could be from the CB collar seam, from the top of the collar, or from HPS. A collar is roughly a rib's height, so the choice moves the value by that amount. |
| GB-A2 | B06 | Centre-back length: end point not stated | Assumed to be the finished bottom edge of the waistband rib (rib included). Not stated. |
| GB-A3 | S01 | Sleeve from CB: start point not stated | "From center back" — CB at the collar seam is assumed; the top of the collar is also used in the trade. |
| GB-A4 | S01 | Sleeve from CB: path not stated | Whether the tape follows the shoulder seam to the shoulder point and then the overarm, or runs straight from CB to the cuff, is not stated. |
| GB-A5 | S01 | Sleeve from CB: end point not stated | Assumed to be the finished cuff edge (cuff rib included); a leather cuff protector edge or the cuff seam are alternatives. |
| GB-A6 | B01 | Chest: circumference inferred, method not stated | Circumference is inferred (XS 43" cannot be a flat half; the Semifinalist × Golden Bear chart reads "Chest Circumference (one inch below Armhole)"). Whether it is flat × 2 or a tape round the body, and whether snapped closed, is not stated. |
| GB-A7 | B01 | Chest: "1 inch below armhole" reference | Assumed vertical 1" below the armhole point at the side seam. Not stated whether measured on the side seam or on the sleeve seam junction. |
| GB-A8 | B09 | Across shoulder: straight vs contour | Not stated whether straight point-to-point or following the back's curve; not stated whether measured at the seam line or the seam edge. |
| GB-A9 | B09 | Across shoulder on raglan styles | The same Classic chart covers The Ralston (raglan sleeve), where a shoulder point/seam does not exist. The chart does not say how its shoulder is taken there. |
| GB-A10 | ALL | Spec vs measured garment, tolerances, version | No tolerances, no chart date/version, and no statement whether values are pattern specs or measured production garments. |
| GB-A11 | ALL | One chart for several constructions | Classic covers melton/leather (Albany), all-wool (Portola), all-leather (Weldon) and raglan (Ralston) with one table. Golden Bear notes "Quilt lining adds bulk to the inside of the jacket, including the sleeves." |

**Rule for the sample:** where a POM is ambiguous, the checklist (§10) asks for **every** candidate method to be measured and recorded separately (e.g. B06 from the collar seam **and** from the top of the collar, and B07 from HPS). The method whose result matches the published value is then adopted and written into v1.0.

**Conflicts with the current product that the block must resolve**

| ID | Topic | Detail |
|---|---|---|
| K1 | Shoulder construction | The site describes the one fit as "Standard Baggy Fit — roomy and relaxed, with a dropped shoulder". Golden Bear Classic (the chosen base) is published as a set-in sleeve block (one chart also covers the raglan Ralston). A dropped shoulder changes B09, S01, armhole and sleeve cap — it cannot be read from the Golden Bear chart. Decide set-in vs dropped before the pattern maker starts. |
| K2 | Materials | The configurator offers leather or "Cotton Fabric" for body and sleeves. Golden Bear's reference is melton wool / leather with quilted lining. No reference covers a cotton-fabric body; drape, bulk and the effect on fit must be checked on a sample in each material. |
| K3 | Embroidery zones | The ten zones are positioned on the 3D reference model and are identical for all sizes. They are not physical dimensions and were not measured on a garment. |
| K4 | Units | Golden Bear and the S.i. Graphics template are imperial; the configurator and production sheet are metric. This draft keeps inches as the source values and states cm as exact conversions. The factory's working unit is TBD. |

## 5. JACKETEK fit validation

Golden Bear Classic M is the **starting block**. It is the roomiest of Golden Bear's published blocks ("Roomy in the chest, waist, and arms"). Whether it is baggy enough for JACKETEK is decided on the body, not on paper. **No ease target is set in this draft.** Golden Bear publishes no body chart, so no ease figure can be sourced; ease is recorded as measured on the day (FV08).

> **PROVISIONAL TARGET RANGE — REQUIRES SAMPLE APPROVAL**
>
> JACKETEK M, provisional target zone (not a production spec):
>
> | Measurement | Provisional range | Ends of the range |
> |---|---|---|
> | Half chest (flat) | 61 – 62.2 cm | Visual reference 61 cm · Golden Bear 62.23 cm (49 in ÷ 2) |
> | Across shoulder | 49.5 – 50 cm | Golden Bear 49.53 cm · visual reference 50 cm |
> | Body length | 67.3 – 68 cm | Golden Bear 67.31 cm · visual reference 68 cm |
> | Sleeve | **no target** | The two charts measure the sleeve differently; set on the fit model |
>
> The range is bounded by the two references' M values. It does not change any POM status: B01, B06 and B09 stay Golden Bear `VERIFIED_SOURCE` reference values, and the final JACKETEK values are set only after the sample is approved. Measure the sample to Golden Bear's methods (§4) so its readings can be checked against this range.

| Field | What to record | Unit / scale | Note | Value |
|---|---|---|---|---|
| FV01 | Fit model ID / name | text | Who wore the sample. |   |
| FV02 | Wearer height | cm |   |   |
| FV03 | Wearer body chest | cm | Body measurement, tape under the arms, relaxed breathing. |   |
| FV04 | Wearer body waist | cm |   |   |
| FV05 | Wearer arm length (CB neck → shoulder → wrist bone) | cm | Same path as S01, on the body. |   |
| FV06 | Sample size and construction | text | e.g. Golden Bear Classic M, set-in sleeve, melton/leather, quilted lining. |   |
| FV07 | Garment chest (B01, as measured) | cm | From the measurement checklist. |   |
| FV08 | Chest ease = FV07 − FV03 | cm | Calculated on the day; no target is set in this draft. |   |
| FV09 | Shoulder impression | choice: sits at shoulder / slightly extended / dropped | Where the armhole seam sits on the body. |   |
| FV10 | Sleeve volume | choice: close / classic / full / too full | Bicep and elbow when the arm hangs and bends. |   |
| FV11 | Body width | choice: close / classic / roomy / baggy / too wide | Front and side view, snapped closed. |   |
| FV12 | Body length | choice: short / correct / long | Where the waistband sits on the body (note: at belt / below belt / hip). |   |
| FV13 | Hem behaviour | choice: flat / slight blouse / strong blouse / rides up | How the body blouses over the waistband rib, standing and arms raised. |   |
| FV14 | Sleeve length | choice: short / correct / long | Where the cuff sits with arms down and arms forward. |   |
| FV15 | Visual bagginess rating | 1–5 (1 = fitted, 5 = very baggy) | Agreed by the reviewers against the JACKETEK brief. |   |
| FV16 | Photos taken (front, side, back, arms raised, arms forward) | yes / no |   |   |
| FV17 | Reviewer(s) | text |   |   |
| FV18 | Decision | APPROVED / REVISE |   |   |
| FV19 | Revision notes for the pattern maker | text | Which POMs change and why. Length changes recorded separately from width changes. |   |

If REVISE: the pattern maker changes widths (chest, shoulder, bicep, body) separately from lengths. Any length change must be justified on the fit sample, not carried along with a width change.

## 6. BOM register

Skeleton only. No supplier specification is invented; every open field is **TBD**. Structure follows the S.i. Graphics BOM page.

| ID | Category | Component | Placement | Description / current knowledge | Data source | Composition | Weight / thickness | Supplier | Supplier ref | Consumption (M) | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BOM01 | Shell | Body fabric | Body panels (fronts, back) | Customer choice: leather or cotton fabric (configurator) | Customer order (material + colour) | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM02 | Shell | Sleeve fabric | Sleeves | Customer choice: leather or cotton fabric (configurator) | Customer order (material + colour) | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM03 | Lining | Body lining | Body inside | TBD (Golden Bear reference: quilted satin acetate) | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM04 | Lining | Sleeve lining | Sleeves inside | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM05 | Lining | Wadding / quilt batting | Between shell and lining | TBD — whether JACKETEK is quilted is undecided | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM06 | Rib | Collar rib | Collar | TBD (knit structure, yarn, weight) | Colour: customer trim colour | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM07 | Rib | Cuff rib | Cuffs | TBD | Colour: customer trim colour | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM08 | Rib | Waist rib | Waistband | TBD | Colour: customer trim colour | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM09 | Rib | Rib stripe yarn | Collar / cuff / waist stripes | TBD — the configurator has no stripe option today | Undecided | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM10 | Hardware | Snaps (cap, socket, stud, post) | Front closure | TBD (type, size, metal) | Finish: customer (black / silver / gold / gunmetal) | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM11 | Hardware | Zipper | Under the snap placket | Not fitted (configurator ZIPPER_ENABLED = false) | Master (disabled) | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM12 | Pockets | Pocketing | Pocket bags | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM13 | Pockets | Pocket welt material | Pocket welts | TBD (leather or shell fabric) | Undecided | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM14 | Thread | Sewing thread — fabric seams | All fabric seams | TBD (type, ticket) | Colour matching rule TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM15 | Thread | Sewing thread — leather seams | Leather seams / topstitch | TBD | Colour matching rule TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM16 | Thread | Embroidery thread | Embroidery zones | TBD (brand, type, weight); colours from the configurator thread palette (19) | Customer order (thread colours) | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM17 | Support | Embroidery backing / stabiliser | Behind each embroidery zone | TBD (per shell material) | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM18 | Support | Interfacing — front facing / placket | Snap placket | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM19 | Support | Interfacing — pocket welts | Welts | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM20 | Support | Snap reinforcement | Behind each snap | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM21 | Patch | Patch base / backing (only if a patch method is adopted) | Patches | TBD — configurator models direct satin embroidery only | Undecided | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM22 | Trim | Leather cuff protector / binding | Cuff edge | UNKNOWN — seen on Golden Bear reference; not decided for JACKETEK | Undecided | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM23 | Trim | Hanger loop | Inside neck | UNKNOWN | Undecided | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM24 | Labels | Main / brand label | TBD | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM25 | Labels | Size label | TBD | TBD | Derived from customer size | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM26 | Labels | Care / content label | TBD | TBD (content depends on customer materials) | Derived from customer materials | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM27 | Packaging | Hangtag | TBD | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |
| BOM28 | Packaging | Polybag / folding | — | TBD | Master | TBD | TBD | TBD | TBD | TBD | TBD |

## 7. Construction register

Fields the factory needs. No technical value is filled. Status for every row: `TO_SET_BY_PATTERN_MAKER` (with the factory).

| ID | Operation | Fields required | Value | Validation status |
|---|---|---|---|---|
| CON01 | Shoulder seam | seam type (ISO 4915/4916 class), seam allowance, stitch type, SPI, topstitch |   | `TO_SET_BY_PATTERN_MAKER` |
| CON02 | Side seam | seam type, seam allowance, stitch type, SPI |   | `TO_SET_BY_PATTERN_MAKER` |
| CON03 | Sleeve underarm seam | seam type, seam allowance, stitch type, SPI |   | `TO_SET_BY_PATTERN_MAKER` |
| CON04 | Sleeve attachment | set-in vs dropped shoulder (OPEN — see conflict K1), seam type, allowance, topstitch |   | `TO_SET_BY_PATTERN_MAKER` |
| CON05 | Leather seams | seam type, needle, thread, SPI, edge finish, topstitch (no pins on leather) |   | `TO_SET_BY_PATTERN_MAKER` |
| CON06 | Collar rib attachment | method, stretch control, seam allowance, stitch type |   | `TO_SET_BY_PATTERN_MAKER` |
| CON07 | Cuff rib attachment | method, stretch control, seam allowance, stitch type |   | `TO_SET_BY_PATTERN_MAKER` |
| CON08 | Waist rib attachment | method, stretch control, seam allowance, stitch type |   | `TO_SET_BY_PATTERN_MAKER` |
| CON09 | Front placket / facing | construction, interfacing, edge stitch |   | `TO_SET_BY_PATTERN_MAKER` |
| CON10 | Snap setting | setting method, reinforcement, placement per F03–F07 |   | `TO_SET_BY_PATTERN_MAKER` |
| CON11 | Pocket construction | welt type, bag attachment, bartacks |   | `TO_SET_BY_PATTERN_MAKER` |
| CON12 | Lining construction | bagged vs other, quilting pattern (if quilted), jump hems, attachment to rib |   | `TO_SET_BY_PATTERN_MAKER` |
| CON13 | Embroidery application | embroider panels before assembly vs after; hooping limits per zone; backing removal |   | `TO_SET_BY_PATTERN_MAKER` |
| CON14 | Label placement | main, size, care label positions |   | `TO_SET_BY_PATTERN_MAKER` |
| CON15 | Pressing | per material (leather vs cotton fabric), temperature, method |   | `TO_SET_BY_PATTERN_MAKER` |
| CON16 | Measurement tolerances | tolerance per POM (S.i. Graphics template has fields; no verified values) |   | `TO_SET_BY_PATTERN_MAKER` |

## 8. Embroidery / patch placement system

The ten fixed zones are the configurator's zones (`src/features/configurator/model/embroideryGeometry.ts`). **No physical coordinate is set here.** Every physical field is blank with status `TO_SET_BY_PATTERN_MAKER`, to be approved on the M sample.

**8.1 What must be locked per zone**

| Zone ID | Name | Garment panel | Primary physical anchor (proposed) | Secondary physical anchor (proposed) | Max width (cm) | Max height (cm) | X reference (cm) | Y reference (cm) | Status |
|---|---|---|---|---|---|---|---|---|---|
| leftChest | Left Chest | Left front (wearer's left) | HPS — vertical distance to zone centre (current production sheet expresses body zones as "below HPS") | CF line — horizontal distance to zone centre |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| rightChest | Right Chest | Right front (wearer's right) | HPS — vertical distance to zone centre (current production sheet expresses body zones as "below HPS") | CF line — horizontal distance to zone centre |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| mainBack | Main Back | Back | HPS — vertical distance to zone centre (alternative: CB collar seam; pattern maker to choose) | CB line — horizontal (zone centred on CB) |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| backQuote | Lower Back Text (text only) | Back | HPS — vertical distance to zone centre (alternative: CB collar seam; pattern maker to choose) | CB line — horizontal (zone centred on CB) |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| leftSleeveUpper | Left Sleeve — Upper | Left sleeve, outer side | SP (shoulder point) — distance down the sleeve to zone centre (current sheet: "below SP") | Sleeve outer centre line (overarm line) — zone centred on it; cuff seam as clearance check |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| leftSleeveMiddle | Left Sleeve — Middle | Left sleeve, outer side | SP (shoulder point) — distance down the sleeve to zone centre (current sheet: "below SP") | Sleeve outer centre line (overarm line) — zone centred on it; cuff seam as clearance check |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| leftSleeveLower | Left Sleeve — Lower | Left sleeve, outer side | SP (shoulder point) — distance down the sleeve to zone centre (current sheet: "below SP") | Sleeve outer centre line (overarm line) — zone centred on it; cuff seam as clearance check |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| rightSleeveUpper | Right Sleeve — Upper | Right sleeve, outer side | SP (shoulder point) — distance down the sleeve to zone centre (current sheet: "below SP") | Sleeve outer centre line (overarm line) — zone centred on it; cuff seam as clearance check |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| rightSleeveMiddle | Right Sleeve — Middle | Right sleeve, outer side | SP (shoulder point) — distance down the sleeve to zone centre (current sheet: "below SP") | Sleeve outer centre line (overarm line) — zone centred on it; cuff seam as clearance check |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |
| rightSleeveLower | Right Sleeve — Lower | Right sleeve, outer side | SP (shoulder point) — distance down the sleeve to zone centre (current sheet: "below SP") | Sleeve outer centre line (overarm line) — zone centred on it; cuff seam as clearance check |   |   |   |   | `TO_SET_BY_PATTERN_MAKER` |

**8.2 Per-order fields (filled from the customer's design for each order)**

| Field | Comes from | Notes |
|---|---|---|
| Artwork finished width / height (cm) | Zone box × artwork aspect × inZone.scale | Derived at order time (§8.4) |
| Customer offset X / Y (cm) | inZone.x × box W, inZone.y × box H | Derived at order time |
| Thread colours | embroidery[].thread or image colourway | From the thread palette |
| Fill | Design artwork / digitising | Configurator stitch style today: satin only |
| Outline | Design artwork / colourway slot | Present only on designs with an outline slot |
| Rotation | — | Not supported in fixed zones (always 0) |
| Artwork ID | Library id / upload file / text + font | Stored on the order |
| Production method | TBD | Direct embroidery is the only method modelled; chenille / patch not modelled |

**8.3 Current software values (information only — not physical)**

> These come from the 3D reference model the configurator uses. They were **not** measured on a garment, are the **same for every size**, and must **not** be used as factory dimensions. They are listed so the pattern maker can see what the customer is currently shown.

| Zone ID | Box W × H (cm, 3D model) | Centre from centre line (cm, 3D model) | Centre below anchor (cm, 3D model) |
|---|---|---|---|
| leftChest | 10 × 10 | 11 (wearer's left) | 14.3 below HPS |
| rightChest | 10 × 10 | 11 (wearer's right) | 14.3 below HPS |
| mainBack | 30 × 26 | 0 (centre) | 21.3 below HPS |
| backQuote | 30 × 7 | 0 (centre) | 39.8 below HPS |
| leftSleeveUpper | 8.4 × 11.2 | 0 (sleeve centre line) | 13.5 below SP (shoulder point) |
| leftSleeveMiddle | 8.4 × 11.2 | 0 (sleeve centre line) | 27.5 below SP (shoulder point) |
| leftSleeveLower | 8.4 × 11.2 | 0 (sleeve centre line) | 41.5 below SP (shoulder point) |
| rightSleeveUpper | 8.4 × 11.2 | 0 (sleeve centre line) | 13.5 below SP (shoulder point) |
| rightSleeveMiddle | 8.4 × 11.2 | 0 (sleeve centre line) | 27.5 below SP (shoulder point) |
| rightSleeveLower | 8.4 × 11.2 | 0 (sleeve centre line) | 41.5 below SP (shoulder point) |

**8.4 Converting the configurator's normalised placement into factory cm (after zone approval)**

1. Inputs locked per size after physical approval: zone box W × H (cm), zone centre from the primary anchor (Y) and secondary anchor (X).
2. Customer data per element (already stored): artwork aspect a = width / height; inZone = { scale s ∈ [0.2, 1], x, y } (shares of the box, x → right and y → up, facing the zone).
3. Auto-fit size: if a ≥ W / H then w₀ = W, h₀ = W / a; else h₀ = H, w₀ = H × a.
4. Finished artwork size: w = w₀ × s, h = h₀ × s (cm).
5. Customer offset from zone centre: ΔX = x × W, ΔY = y × H (cm, facing the zone). The software already clamps x, y so the artwork stays inside the box.
6. Artwork centre on the garment: Y below anchor = zone Y − ΔY. Body zones: X from CF/CB = zone X ± ΔX (front: + toward wearer's left as faced; back: mirrored). Sleeve zones: ΔX runs around the sleeve from its outer centre line.
7. Rotation: not supported in fixed zones (always 0).
8. Versioning: orders store physicalSize and referencePosition computed from the 3D boxes; once physical zones are approved, each order should record which zone-spec version it was produced against, so old orders are never re-interpreted.
9. Open decision: zones are the same for every size today. Whether physical zone positions/boxes grade by size or stay fixed is a pattern-maker decision (no source documents graded placement).

## 9. Fixed master data vs customer order data

| Data | Owner | Where it lives / notes |
|---|---|---|
| Garment block / pattern set | `FIXED_MASTER` | Pattern maker; derived from Golden Bear Classic M reference after sample approval |
| Fit (one standard baggy fit) | `FIXED_MASTER` | Config still carries a `fit` field; product decision is one fit |
| POM spec per size + grade rules | `FIXED_MASTER` | This document |
| Tolerances | `FIXED_MASTER` | TBD |
| Embroidery zone physical boxes + anchor offsets (per size if graded) | `FIXED_MASTER` | §8 |
| Zone acceptance rules (design/text, max characters, max lines) | `FIXED_MASTER` | Configurator (42 chars, 4 lines) |
| Snap count, positions, spacing | `FIXED_MASTER` | F03–F07 |
| Rib specification (structure, height, ratio, stripes) | `FIXED_MASTER` | R01–R05 |
| Lining, wadding, pocketing, interfacing, stabiliser | `FIXED_MASTER` | BOM |
| Construction methods | `FIXED_MASTER` | §7 |
| Allowed colours, materials, thread palette, snap finishes, fonts, library designs | `FIXED_MASTER` | Catalog lists the customer picks from |
| Labels and packaging | `FIXED_MASTER` | BOM |
| Size | `CUSTOMER_ORDER` | config.size (XS–XXL) |
| Body colour | `CUSTOMER_ORDER` | config.colours.body |
| Body material | `CUSTOMER_ORDER` | config.materials.body (leather / cotton fabric) |
| Sleeve colour | `CUSTOMER_ORDER` | config.colours.sleeves |
| Sleeve material | `CUSTOMER_ORDER` | config.materials.sleeves |
| Trim (rib) colour | `CUSTOMER_ORDER` | config.colours.trim |
| Snap finish | `CUSTOMER_ORDER` | config.buttons |
| Selected zones | `CUSTOMER_ORDER` | embroidery[].placement |
| Embroidery artwork (upload / library design / front letters / colourway) | `CUSTOMER_ORDER` | embroidery[].image |
| Text | `CUSTOMER_ORDER` | embroidery[].text |
| Font | `CUSTOMER_ORDER` | embroidery[].textStyle.fontId |
| Embroidery colours | `CUSTOMER_ORDER` | embroidery[].thread / image.colourway |
| Artwork scale inside zone | `CUSTOMER_ORDER` | embroidery[].inZone.scale |
| Artwork offset inside zone | `CUSTOMER_ORDER` | embroidery[].inZone.x / y |
| Finished artwork size (cm) | `DERIVED_AT_ORDER` | Master zone box × customer artwork aspect × scale |
| Artwork position on garment (cm from anchors) | `DERIVED_AT_ORDER` | Master zone anchors + customer offset |
| Size label, care/content label content | `DERIVED_AT_ORDER` | Customer size + materials |
| Rib cut lengths, snap spacing for the ordered size | `DERIVED_AT_ORDER` | Master spec for that size |

`DERIVED_AT_ORDER` = calculated from master data and the customer's choices; never typed by hand.

## 10. Sample checklist

### JACKETEK M SAMPLE MEASUREMENT & FIT VALIDATION

Print this section. Measure on a flat table, garment snapped closed unless stated, tape in cm (record inches too for §10.1). Take each measurement twice; if the two differ by more than 0.5 cm, take a third and record all.

Sample: ______________________  Size: ____  Construction (set-in / raglan / dropped): ________  Shell: ________  Lining: ________

Measured by: ______________  Date: ____________

**10.1 Verify the Golden Bear reference (record every candidate method)**

| POM | Reference M | Method to record | Reading 1 | Reading 2 | Matches reference? (Y/N) |
|---|---|---|---|---|---|
| B01 Chest | 49 in / 124.46 cm | Flat × 2, 1" below armhole, snapped |   |   |   |
| B01 Chest | 49 in / 124.46 cm | Tape round the garment, 1" below armhole, snapped |   |   |   |
| S01 Sleeve from CB | 35½ in / 90.17 cm | CB collar seam → SP → overarm → cuff edge |   |   |   |
| S01 Sleeve from CB | 35½ in / 90.17 cm | Top of collar at CB → SP → cuff edge |   |   |   |
| B06 CB length | 26½ in / 67.31 cm | CB collar seam → bottom edge |   |   |   |
| B06 CB length | 26½ in / 67.31 cm | Top of collar at CB → bottom edge |   |   |   |
| B09 Across shoulder | 19½ in / 49.53 cm | Straight SP → SP across back |   |   |   |
| B09 Across shoulder | 19½ in / 49.53 cm | Following the back contour SP → SP |   |   |   |

**10.2 Measure (all currently blank in the spec)**

| ☐ | POM | Name | How | Condition | Reading 1 (cm) | Reading 2 (cm) |
|---|---|---|---|---|---|---|
| ☐ | B02 | Waist circumference | Straight across the body at a fixed distance below HPS (distance to be fixed by pattern maker), side seam to side seam × 2. | flat, snapped closed |   |   |
| ☐ | B03 | Body width at waistband seam (above rib) | Along the seam joining body to waistband rib, side to side, × 2. | flat, snapped closed |   |   |
| ☐ | B04 | Bottom opening, relaxed | Along the finished bottom edge of the waistband rib, relaxed, × 2. | flat, snapped closed, relaxed |   |   |
| ☐ | B05 | Bottom opening, extended | Same line as B04, stretched to full extension without straining stitches, × 2. | flat, snapped closed, stretched |   |   |
| ☐ | B07 | Back length from HPS | From HPS straight down, parallel to CB, to the finished bottom edge (back view). Measured to reconcile B06's start point. | flat, back facing up |   |   |
| ☐ | B08 | Front length from HPS | From HPS straight down, parallel to CF, to the finished bottom edge. | flat, snapped closed |   |   |
| ☐ | B10 | Shoulder length | Along the shoulder seam from HPS to shoulder point. | flat |   |   |
| ☐ | B11 | Shoulder drop | Vertical distance between the HPS level and the shoulder-point level. | flat |   |   |
| ☐ | B12 | Across front | Armhole seam to armhole seam across the front at a fixed distance below HPS (distance set by pattern maker). | flat, snapped closed |   |   |
| ☐ | B13 | Across back | Armhole seam to armhole seam across the back at a fixed distance below HPS. | flat, back facing up |   |   |
| ☐ | B14 | Armhole depth | Vertical from HPS level to the armhole point (underarm) level. | flat |   |   |
| ☐ | B15 | Armhole, straight | Straight line from shoulder point to armhole point, garment flat. | flat |   |   |
| ☐ | B16 | Armhole, curved (along seam) | Along the armhole seam, front + back, shoulder point round to shoulder point. | flat |   |   |
| ☐ | S02 | Sleeve length from shoulder point (overarm) | From shoulder point along the overarm to the finished cuff edge. | flat, sleeve laid straight |   |   |
| ☐ | S03 | Underarm sleeve length | From armhole point along the underarm seam to the finished cuff edge. | flat |   |   |
| ☐ | S04 | Bicep width, 1" below armhole | Flat width perpendicular to the sleeve centre line, 1" below the armhole point (half circumference). | flat |   |   |
| ☐ | S05 | Elbow width | Flat width perpendicular to the sleeve line at a fixed distance from shoulder point (distance set by pattern maker). | flat |   |   |
| ☐ | S06 | Sleeve width at cuff seam (above rib) | Flat width along the seam joining sleeve to cuff rib. | flat |   |   |
| ☐ | S07 | Cuff opening, relaxed | Flat width along the finished cuff edge, relaxed. | flat, relaxed |   |   |
| ☐ | S08 | Cuff opening, extended | Flat width along the finished cuff edge, stretched to full extension. | flat, stretched |   |   |
| ☐ | S09 | Cuff rib height | From the cuff seam to the finished cuff edge. | flat, relaxed |   |   |
| ☐ | R01 | Waistband rib height | From the waistband seam to the finished bottom edge, at CB. | flat, relaxed |   |   |
| ☐ | C01 | Collar height at CB | At CB, from the collar seam to the collar's outer edge, collar standing/unfolded. | flat, relaxed |   |   |
| ☐ | C02 | Collar height at front ends | At the collar's front end, from collar seam to outer edge. | flat, relaxed |   |   |
| ☐ | C03 | Collar neck-edge length (attached edge) | Along the collar seam from front end to front end. | flat, relaxed |   |   |
| ☐ | C04 | Collar outer-edge length, relaxed | Along the collar's outer edge from front end to front end, relaxed. | flat, relaxed |   |   |
| ☐ | C05 | Neck width, seam to seam | Straight line between left and right HPS at the collar seam. | flat |   |   |
| ☐ | C06 | Front neck drop | Vertical from the HPS line to the collar seam at CF. | flat, snapped closed |   |   |
| ☐ | C07 | Back neck drop | Vertical from the HPS line to the collar seam at CB. | flat, back facing up |   |   |
| ☐ | F01 | Front placket / facing width (finished) | Finished width of the snap placket/facing, perpendicular to the front edge. | flat, snapped closed |   |   |
| ☐ | F02 | Front overlap (CF to front edge) | From the CF line to the overlapping front edge. | flat, snapped closed |   |   |
| ☐ | P01 | Pocket opening length | Along the pocket opening, end to end. | flat, snapped closed |   |   |
| ☐ | P02 | Pocket welt width | Finished welt width, perpendicular to the opening. | flat |   |   |

**10.3 Record (for the pattern maker's decisions)**

| ☐ | Item | Record |
|---|---|---|
| ☐ | F03 Snap count on the reference sample |   |
| ☐ | F04 / F05 / F07 Snap positions on the reference sample |   |
| ☐ | Snap spacing (each gap) |   |
| ☐ | P03–P05 Pocket position and angle on the reference sample |   |
| ☐ | R05 Rib stripe layout (collar, cuff, waist) |   |
| ☐ | Rib structure (1×1 / 2×2), stretch feel |   |
| ☐ | Lining: quilted? bagged? jump hem? (L01–L03) |   |
| ☐ | Cuff protector / binding present? width |   |
| ☐ | Inside pocket present? (L04) |   |
| ☐ | Label positions |   |
| ☐ | Where each of the 10 JACKETEK zones would sit: mark with tape on the garment and photograph with a ruler |   |

**10.4 Fit validation** — complete the §5 table with the fit model wearing the sample.

**10.5 Photographs** — flat front, flat back, flat sleeve, each with a ruler; worn front, side, back, arms raised, arms forward.

## 11. Certainty overview

| Tag | What falls under it |
|---|---|
| **KNOWN** | Golden Bear Classic M: B01, B06, B09, S01 (published garment values; methods partly unconfirmed — §4). |
| **DERIVED** | Golden Bear XS–XXL values (base + grade); all cm conversions; R02–R04 rib cut lengths and F06 snap spacing once their inputs are approved. |
| **UNKNOWN** | Whether JACKETEK has: quilting (BOM05), zipper (BOM11), cuff protector (BOM22), hanger loop (BOM23), inside pocket (L04), rib stripes (BOM09/R05), patch method (BOM21); set-in vs dropped shoulder (K1). |
| **NEEDS SAMPLE** | B02, B03, B04, B05, B07, B08, B10, B11, B12, B13, B14, B15, B16, S02, S03, S04, S05, S06, S07, S08, S09, R01, C01, C02, C03, C04, C05, C06, C07, F01, F02, P01, P02; the 11 Golden Bear method ambiguities. |
| **NEEDS PATTERN MAKER** | S10, R05, F03, F04, F05, F07, P03, P04, P05, P06, P07, L01, L02, L03, L04; all construction rows; all 10 zone geometries; tolerances; extra ease (if any). |

## 12. Sample strategy

Is buying a Golden Bear Classic M still strictly necessary? Re-evaluated now that a second chart confirms its M proportions.

|  | **Option A** — Buy and measure Golden Bear Classic M | **Option B** — JACKETEK M prototype from the factory / pattern maker, built to the provisional target range using Golden Bear's measuring methods |
|---|---|---|
| Accuracy | Highest for the reference itself: settles all 11 Golden Bear method questions on a real garment. Says nothing about JACKETEK materials (leather / cotton fabric), the dropped-vs-set-in question (K1), the zones or the visually preferred silhouette. | Tests the real product: JACKETEK materials, construction, rib, zones and the fit on a body. The 3 main dimensions already have two independent charts within about 1.2 cm of each other, so the method ambiguities are small next to fit approval. The Golden Bear method questions stay open unless the factory documents its own methods. |
| Cost | Retail price of one jacket plus international shipping and import duty (check the current price; not researched here). No pattern cost. | One pattern plus one sample (factory quote needed; not researched here). Likely one or more revision rounds whichever option is chosen. |
| Speed | Depends on international shipping and customs. Measuring takes about a day once it arrives. | Removes the purchase-and-shipping step; depends on the factory's pattern and sampling lead time. |
| Risk | Low risk of wasted money, but it is an extra step: a JACKETEK prototype is still required afterwards. If Golden Bear's methods are confirmed, nothing about JACKETEK's own fit has been tested yet. | The pattern maker interprets an ambiguous method differently (e.g. body length from HPS instead of the CB collar seam). Controlled by giving them this document's method definitions and requiring a measured spec back. The sleeve has no sourced target and must be set on the fit model. |
| How much it helps lock the Master Spec | Locks the 4 reference values and their methods. Helps with about 33 sample measurements only as a benchmark garment (its armhole, rib, collar, etc. are Golden Bear's, not JACKETEK's). Locks no pattern-maker decision. | Directly produces most of what v1.0 needs: the 33 sample measurements, the 15 pattern-maker decisions, rib and snap specs and the 10 zone geometries, all on the actual JACKETEK garment. |

**Recommended path: Option B**

1. Choose B. The Golden Bear purchase is no longer strictly necessary: the visual chart already confirms Golden Bear Classic M's chest, shoulder and length within about 1.2 cm, and the remaining unknowns are JACKETEK-specific, which only a JACKETEK prototype can answer.
2. Before ordering, decide K1 (set-in vs dropped shoulder) and say whether the jacket in the visual chart has a dropped shoulder. The 50 cm shoulder makes sense only for the construction it was measured on.
3. Give the factory this document. Require: the provisional target range for chest, shoulder and body length; Golden Bear's method definitions (§4) for every POM; and a sleeve length set on the fit model, not taken from either chart.
4. Require the factory to return the measured spec of the prototype using the §10 checklist, with each POM's method written down, plus the flat photos with a ruler.
5. Keep A as a fallback: buy a Golden Bear Classic M only if the prototype misses the target range in a way that can't be explained, or if the factory can't measure to the documented methods.

## 13. Summary

| Count | Value |
|---|---|
| Total POMs | 56 |
| With verified numerical values (VERIFIED_SOURCE) | 4 |
| Requiring physical measurement (TO_MEASURE_ON_SAMPLE) | 33 |
| Requiring pattern-maker decision (TO_SET_BY_PATTERN_MAKER) | 15 |
| Derived once inputs are approved (DERIVED_FROM_APPROVED_SPEC) | 4 |
| Embroidery zones to lock | 10 |
| BOM lines (all TBD) | 28 |
| Construction lines | 16 |

**Next physical sample (updated, §12):** a JACKETEK M prototype from the factory, built to the provisional target range using Golden Bear's measuring methods, in each offered shell material (leather, cotton fabric), with the ten zones marked, measured back with §10 and fitted with §5. A Golden Bear Classic M (set-in sleeve, e.g. The Albany — not the raglan Ralston) is now a fallback, bought only if the prototype misses the range in a way that can't be explained.
