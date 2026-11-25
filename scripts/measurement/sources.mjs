// MEASUREMENT SOURCES — the evidence behind the Measurement Source Matrix v0.1, as recorded.
// Data only: the three references (Golden Bear, the supplied chart, S.i. Graphics), the legacy
// chart (excluded), the JACKETEK method definition of every POM and the decision per POM.
// Nothing here is approved; nothing is read from a drawing.
//
// Every number is copied from a named source (Master Spec v0.1 rev 2, the Golden Bear page as
// re-checked on CHECKED, the S.i. spec sheet as delivered). cm = in × 2.54 exactly.

export const CHECKED = "2026-10-09";
export const IN = 2.54;
export const cm = (inches) => Math.round(inches * IN * 1000) / 1000;

// ------------------------------------------------------------- A. Golden Bear Classic Fit
export const GOLDEN_BEAR = {
  id: "GB",
  name: "Golden Bear Sportswear — Classic Fit size chart",
  url: "https://www.goldenbearsportswear.com/pages/size-chart",
  firstAccessed: "2026-10-08",
  reverified: CHECKED,
  reverifiedResult: "Unchanged: all XS–4XL Classic Fit rows match the values recorded in Master Spec v0.1 rev 2.",
  role: ["FIT BENCHMARK", "GRADE REFERENCE", "VERIFIED EXTERNAL REFERENCE"],
  notRole: "Not JACKETEK production approval.",
  units: "in (\"All measurements are in inches.\")",
  measurementType: "Product (garment) measurements — the page asks to compare them with a garment the customer owns; it does not state the word \"garment\" explicitly.",
  notes: [
    "\"Quilt lining adds bulk to the inside of the jacket, including the sleeves.\"",
    "\"Tall Sizes: Sleeve Length & Body Length +2\" inches\" (new in this record; tall sizes are not part of the JACKETEK range).",
    "No grade rule is stated. The per-size steps below are read from the published rows, which are exactly linear XS–4XL.",
    "The same Classic chart covers set-in, all-wool, all-leather and raglan (Ralston) models.",
  ],
  // header exactly as published → rows (inches)
  columns: { B01: "Chest (1\"below armhole)", S01: "Sleeve (from center back)", B06: "Center back", B09: "Across Shoulder" },
  rows: {
    XS: { B01: 43, S01: 34, B06: 25.5, B09: 18 },
    S: { B01: 46, S01: 34.75, B06: 26, B09: 18.75 },
    M: { B01: 49, S01: 35.5, B06: 26.5, B09: 19.5 },
    L: { B01: 52, S01: 36.25, B06: 27, B09: 20.25 },
    XL: { B01: 55, S01: 37, B06: 27.5, B09: 21 },
    XXL: { B01: 58, S01: 37.75, B06: 28, B09: 21.75 },
    "3XL": { B01: 61, S01: 38.5, B06: 28.5, B09: 22.5 },
    "4XL": { B01: 64, S01: 39.25, B06: 29, B09: 23.25 },
  },
  gradeIn: { B01: 3, S01: 0.75, B06: 0.5, B09: 0.75 },
  methodStated: {
    B01: "1\" below armhole (in the header). Circumference inferred (XS 43\" cannot be a flat half). Flat × 2 vs tape round the body not stated.",
    S01: "From center back (in the header). Start (collar seam / top of collar), path (via shoulder point or straight) and end (cuff edge) not stated.",
    B06: "\"Center back\" only. Start point (CB collar seam / top of collar / HPS) and end point not stated.",
    B09: "Not stated (straight vs contour, seam line vs seam edge). The chart also covers a raglan model with no shoulder seam.",
  },
};

// ------------------------------------------------------------- B. The supplied chart
export const SUPPLIED = {
  id: "SUP",
  name: "JACKETEK visual fit reference — size chart supplied by JACKETEK",
  classification: "SECONDARY_VISUAL_REFERENCE",
  role: ["SECONDARY_VISUAL_REFERENCE", "TARGET SILHOUETTE REFERENCE"],
  // Approved wording (2026-10-09): these values are NOT independently verified source data.
  provenance: ["SECONDARY_VISUAL_REFERENCE", "SOURCE IMAGE CURRENTLY UNAVAILABLE", "RECORDED FROM PRIOR MASTER-SPEC WORK", "REQUIRES RE-VERIFICATION IF ORIGINAL CHART IS RE-UPLOADED"],
  verified: false,
  confidencePolicy: "Adds no confidence to any target: a range may use a value as one end, but confidence rests on Golden Bear alone.",
  record: "Master Spec v0.1 rev 2 §3A (`secondaryVisualReference`), 2026-10-08",
  original: {
    found: false,
    searched: [
      "C:\\JACKETEK_PORTABLE (all folders except node_modules / .git), incl. archive/old-reference",
      "Git history (all branches)",
      "This project's Claude Code session transcripts",
    ],
    note: "The original chart image / page is not in the project, the archive, Git history or the session transcripts. Only the M values and method notes recorded in Master Spec v0.1 rev 2 are available. Its measurement arrows therefore cannot be inspected; brand, URL and stated methods are unknown.",
    notToConfuse: "production-drawing/images/sizechart_guide.png is the A / B / C diagram of the LEGACY official_size_chart.json (60 / 70 / 62 cm) — a different chart with no shoulder measurement.",
  },
  sizeUsed: "M",
  gradingAvailable: false,
  gradingNote: "Master Spec v0.1 recorded only that the chart's XS–4XL progression \"appears irregular\" and deliberately did not record it. The values are not in the project, so its grading cannot be compared.",
  valuesM: {
    halfChest: { cm: 61, name: "Half chest (flat)", method: "Half / flat chest; height below the armhole not known", pom: "B01", mapping: "B01 is a circumference: 61 × 2 = 122 cm" },
    acrossShoulder: { cm: 50, name: "Across shoulder", method: "Not stated", pom: "B09" },
    bodyLength: { cm: 68, name: "Body length", method: "Start point (CB collar seam / top of collar / HPS) not known; end assumed bottom edge", pom: "B06" },
    sleeve: { cm: 51, name: "Sleeve (from shoulder seam)", method: "From the shoulder seam; end point not known", pom: "S02?", mapping: "Not mapped: see conflict MC-01" },
  },
};

// ------------------------------------------------------------- C. S.i. Graphics (purchased)
export const SI = {
  id: "SIG",
  name: "S.i. Graphics — Varsity Jacket Techpack Template (purchased; never edited)",
  folder: "garment-spec/si-graphics-varsity-techpack/",
  role: ["TECHNICAL DRAWING REFERENCE", "POM LAYOUT REFERENCE", "CONSTRUCTION / PRESENTATION REFERENCE"],
  inspected: CHECKED,
  pages: {
    specSheet: "Blank + Example, Single/…_Page 9 copy 2 (SPEC SHEET)",
    grading: "Blank + Example, Single/…_Page 9 copy 3 (GRADING)",
  },
  findings: [
    "The SPEC SHEET prints one TARGET column for sample size Medium, in inches, with tolerances. The same values are printed in BOTH the Blank and the Example file.",
    "The header block is demo content: brand \"THE DRAGON\", style no. \"SW-TSH-04\" (a T-shirt code), \"XX Company\", date \"MM-DD-YYYY\". The values describe no real garment.",
    "Internal inconsistencies confirm placeholder data: waist 30.7\" against a 49\" chest, a 21\" flat sleeve opening on a rib cuff.",
    "Three values (chest 49\", sleeve from CB 35½\", back length 26½\") equal Golden Bear Classic M — they may have been copied from Golden Bear's public chart; they confirm nothing independently.",
    "The GRADING page is empty (\"BASE PATTERN: (PROVIDE)\", no values in any size).",
    "No how-to-measure diagram and no POM arrows on the flats. The flat drawings are vector artwork in drawing units, not to scale.",
  ],
  // S.i. spec-sheet row → JACKETEK POM (by method name), Medium TARGET as printed, tolerance as printed
  specSheet: [
    { n: 1, name: "FRONT LENGTH from HPS)", pom: "B08", in: 28, text: "28\"", tol: 0.25 },
    { n: 2, name: "BACK LENGTH (from CB)", pom: "B06", in: 26.5, text: "26 1/2\"", tol: 0.25 },
    { n: 3, name: "ACROSS SHOULDER", pom: "B09", in: 20.5, text: "20 1/2\"", tol: 0.25 },
    { n: 4, name: "SLEEVE LENGTH (from center back)", pom: "S01", in: 35.5, text: "35 1/2\"", tol: 0.375 },
    { n: 5, name: "CHEST CIRCUMFERENCE (1\" below armhole)", pom: "B01", in: 49, text: "49\"", tol: 0.375 },
    { n: 6, name: "ARMHOLE (straight)", pom: "B15", in: 9.75, text: "9 3/4\"", tol: 0.25 },
    { n: 7, name: "WAIST CIRCUMFERENCE", pom: "B02", in: 30.7, text: "30.7\"", tol: 0.125 },
    { n: 8, name: "WAIST/ CUFF RIB WIDTH", pom: "R01", also: "S09", in: 2.3, text: "2.3\"", tol: 0.25 },
    { n: 9, name: "SLEEVE OPENING (flat)", pom: null, ambiguous: "S06 / S07 — not mapped (MC-06)", in: 21, text: "21\"", tol: 0.25, note: "Grading page calls it \"CUFF OPENING (flat)\". 21\" flat cannot be a rib cuff edge (S07); it may mean the sleeve at the cuff seam (S06) or a circumference. Ambiguous." },
    { n: 10, name: "FRONT NECKLINE DROP", pom: "C06", in: 7.5, text: "7.5\"", tol: 0.125 },
    { n: 11, name: "COLLAR HEIGHT", pom: "C01", in: 2.3, text: "2.3\"", tol: 0.125, note: "Position (CB or front end) not stated." },
    { n: 12, name: "WELT POCKET LENGTH", pom: "P01", in: 7, text: "7\"", tol: 0.125 },
    { n: 13, name: "WELT POCKET WIDTH", pom: "P02", in: 1.2, text: "1.2\"", tol: 0.125 },
  ],
};

// ------------------------------------------------------------- Legacy chart (EXCLUDED)
export const LEGACY = {
  file: "production-drawing/data/official_size_chart.json",
  dated: "2026-10-02",
  status: "LEGACY — EXCLUDED as a measurement source",
  labels: ["LEGACY", "NOT AUTHORITATIVE", "NOT USED BY RFQ", "NOT JACKETEK MASTER SPEC"],
  rule: "Kept for historical compatibility only (not deleted). The legacy production-drawing PDF built from it must NOT be sent to a factory.",
  valuesM: { chestWidthFlat: 60, jacketLength: 70, sleeveLength: 62 },
  grade: { chestWidthFlat: 3, jacketLength: 2, sleeveLength: 1 },
  definitions: {
    chestWidthFlat: "Straight across, underarm to underarm, laid flat",
    jacketLength: "From the designated top shoulder/neck reference point to the bottom of the jacket (front, HPS — per data/measurements.json \"Overall front length\")",
    sleeveLength: "From the shoulder/sleeve attachment reference point to the end of the cuff",
  },
};

// ------------------------------------------------------------- JACKETEK method per POM
// [A, B, path, extent, rib, ribState, sleeveRef, clarity, resolution]
// clarity: CLEAR · DISTANCE_TBD (a level the pattern maker must fix first) · SOURCE_AMBIGUOUS
// (JACKETEK's own definition is clear; the reference source's is not) · CONFLICT (sources measure
// differently) · NOT_ON_GARMENT (pattern / cut piece / count).
const M = (a, b, path, extent, rib, ribState, sleeveRef, clarity, resolution = "") => ({ a, b, path, extent, rib, ribState, sleeveRef, clarity, resolution });
const flatW = "flat width × 2 (= circumference)";
export const METHODS = {
  B01: M("Side seam, 2.54 cm (1\") below the LEFT armhole point, measured down the side seam", "Same point on the RIGHT side", "straight", flatW, "excluded (above waistband)", "—", "—", "SOURCE_AMBIGUOUS", "JACKETEK: garment flat, snapped closed, straight side seam to side seam at 2.54 cm below the armhole point; record the flat width AND × 2. Also record pit-to-pit AT the armhole point (to compare with the supplied chart, whose height is unknown)."),
  B02: M("Side seam at waist level", "Opposite side seam at waist level", "straight", flatW, "excluded", "—", "—", "DISTANCE_TBD", "Waist level = a fixed distance below HPS that the pattern maker must state before the sample. S.i.'s 30.7\" is an example value, not a level."),
  B03: M("Waistband seam at the side", "Waistband seam at the opposite side", "straight along the seam line", flatW, "excluded (seam above the rib)", "—", "—", "CLEAR"),
  B04: M("Finished bottom edge at the side fold", "Opposite side fold", "straight along the edge", flatW, "included (rib edge)", "relaxed", "—", "CLEAR"),
  B05: M("Finished bottom edge at the side fold", "Opposite side fold", "straight along the edge", flatW, "included (rib edge)", "stretched to full extension without straining stitches", "—", "CLEAR"),
  B06: M("CB neck: the collar seam at centre back", "Finished bottom edge of the waistband rib at CB", "straight, vertical along CB", "single length", "included", "relaxed", "—", "SOURCE_AMBIGUOUS", "JACKETEK: CB collar seam → finished rib edge. Golden Bear and the supplied chart do not state the start point; a start at the top of the collar adds a collar height (≈ C01). On the sample measure BOTH (collar seam and top of collar) and B07 (from HPS)."),
  B07: M("HPS (shoulder seam meets collar seam)", "Finished bottom edge", "straight, parallel to CB", "single length", "included", "relaxed", "—", "CLEAR"),
  B08: M("HPS", "Finished bottom edge", "straight, parallel to CF", "single length", "included", "relaxed", "—", "CLEAR", "Same definition as S.i. row 1 \"FRONT LENGTH from HPS\" (its 28\" is an example value)."),
  B09: M("LEFT shoulder point — dropped shoulder: where the sleeve-attachment (armhole) seam line crosses the shoulder line (shoulder seam extended to the top fold), below and outside the wearer's natural shoulder", "RIGHT shoulder point, same definition", "straight point to point across the back, garment flat, back facing up", "single width", "—", "—", "—", "PATTERN_DEPENDENT", "K1 = DROPPED_SHOULDER. The shoulder point is wherever the pattern maker places the armhole seam, so B09 is a construction result, not a fit reference. Measured straight at the seam LINE (not the seam edge); on the sample also record the contour along the back. Golden Bear's 19½\" is a set-in measure and does not transfer."),
  B10: M("HPS", "Shoulder point (dropped: armhole seam on the shoulder line)", "straight along the shoulder seam / shoulder line", "single length", "—", "—", "—", "PATTERN_DEPENDENT", "K1 = DROPPED_SHOULDER: includes the drop extension, so it is set by where the pattern maker places the shoulder point; confirmed on the sample."),
  B11: M("HPS level", "Shoulder-point level (dropped shoulder point)", "vertical", "single distance", "—", "—", "—", "CLEAR", "Shoulder slope to the DROPPED shoulder point — larger than on a set-in block. Not the same as the drop extension (see the shoulder-construction parameters)."),
  B12: M("Left front armhole seam", "Right front armhole seam", "straight", "single width", "—", "—", "—", "DISTANCE_TBD", "Level below HPS to be fixed by the pattern maker."),
  B13: M("Left back armhole seam", "Right back armhole seam", "straight", "single width", "—", "—", "—", "DISTANCE_TBD", "Level below HPS to be fixed by the pattern maker."),
  B14: M("HPS level", "Armhole-point (underarm) level", "vertical", "single distance", "—", "—", "—", "CLEAR", "Dropped shoulders normally lower the armhole point; the depth is the pattern maker's."),
  B15: M("Shoulder point (dropped)", "Armhole point", "straight", "one side", "—", "—", "—", "CLEAR", "Starts at the DROPPED shoulder point. Same name as S.i. row 6 \"ARMHOLE (straight)\" (9¾\" is an example value)."),
  B16: M("Shoulder point (dropped)", "Shoulder point (full circuit, front + back)", "along the curve of the armhole seam", "full armhole", "—", "—", "—", "CLEAR", "Along the dropped armhole seam."),
  S01: M("CB neck at the collar seam", "Cuff seam (rib excluded) = S01; finished cuff edge = S01-E (both comparison only)", "along the shoulder line to the dropped shoulder point, then down the overarm", "single length", "excluded at the cuff seam (edge value also recorded)", "relaxed", "centre back", "SOURCE_AMBIGUOUS", "Retained as a COMPARISON reference with Golden Bear (which states only \"from center back\"; end point assumed cuff edge). A CB sleeve changes less with the shoulder construction than a shoulder-point sleeve, but Golden Bear's value is still set-in and not directly transferable. Never interchanged with S02 (MC-01). Sample: record S01 = CB → cuff seam AND S01-E = CB → finished cuff edge, separately; both are comparison / reference measurements, not JACKETEK sleeve targets."),
  S02: M("Shoulder point (dropped: armhole seam on the shoulder line)", "Cuff seam (rib excluded) = S02, JACKETEK primary; finished cuff edge = S02-E, secondary", "along the overarm, sleeve laid straight", "single length", "excluded at the cuff seam (edge value also recorded)", "relaxed", "shoulder point", "CONFLICT", "JACKETEK primary sleeve method: shoulder point → cuff seam (the unit the sleeve embroidery zones use: S02 − S09). v0.1 wrote S02 to the finished cuff edge: the sample records both, and edge = seam + S09. On the dropped shoulder the shoulder point is lower on the arm, so S02 is shorter than on a set-in sleeve for the same arm. The supplied chart's 51 cm is not entered (MC-01)."),
  S03: M("Armhole point", "Finished cuff edge", "along the underarm seam", "single length", "included", "relaxed", "underarm", "CLEAR", "Depends on the armhole depth the dropped-shoulder pattern sets."),
  S04: M("Underarm seam, 2.54 cm below the armhole point", "Sleeve fold opposite", "straight, perpendicular to the sleeve centre line", "flat width (half circumference)", "—", "—", "—", "CLEAR", "A dropped-shoulder sleeve is usually wider at the top; value from the pattern, measured on the sample."),
  S05: M("Underarm seam at elbow level", "Sleeve fold opposite", "straight, perpendicular to the sleeve line", "flat width (half circumference)", "—", "—", "—", "DISTANCE_TBD", "Elbow level = distance from the shoulder point to be fixed by the pattern maker."),
  S06: M("Cuff seam, underarm side", "Cuff seam, fold side", "straight along the cuff seam", "flat width (half circumference)", "excluded (seam above the rib)", "—", "—", "CLEAR"),
  S07: M("Finished cuff edge", "Finished cuff edge, opposite fold", "straight along the edge", "flat width (half circumference)", "included (rib edge)", "relaxed", "—", "CLEAR", "S.i. row 9 \"SLEEVE OPENING (flat)\" 21\" is an example value and cannot be a rib cuff edge — not mapped."),
  S08: M("Finished cuff edge", "Finished cuff edge, opposite fold", "straight along the edge", "flat width (half circumference)", "included (rib edge)", "stretched to full extension", "—", "CLEAR"),
  S09: M("Cuff seam", "Finished cuff edge", "straight", "single height", "rib only", "relaxed", "—", "CLEAR"),
  S10: M("Bicep line (pattern)", "Top of the sleeve cap (pattern)", "straight on the net pattern", "pattern measure (excl. seam allowance)", "—", "—", "—", "NOT_ON_GARMENT", "Pattern only. K1 = DROPPED_SHOULDER: a low, flat cap — the pattern maker sets it."),
  R01: M("Waistband seam at CB", "Finished bottom edge at CB", "straight", "single height", "rib only", "relaxed", "—", "CLEAR"),
  R02: M("—", "—", "cut piece", "cut length", "rib piece", "unstretched", "—", "NOT_ON_GARMENT", "Computed: B03 × the rib ratio the pattern maker sets; the pattern maker states whether seam allowance is included."),
  R03: M("—", "—", "cut piece", "cut length", "rib piece", "unstretched", "—", "NOT_ON_GARMENT", "Computed: S06 × the rib ratio; seam allowance as the pattern maker states."),
  R04: M("—", "—", "cut piece", "cut length", "rib piece", "unstretched", "—", "NOT_ON_GARMENT", "Computed: C03 × the rib ratio; seam allowance as the pattern maker states."),
  R05: M("Finished edge", "Each stripe edge", "straight, perpendicular to the edge", "per rib piece", "rib only", "relaxed", "—", "CLEAR"),
  C01: M("Collar seam at CB", "Collar outer edge at CB", "straight, collar standing / unfolded", "single height", "collar rib", "relaxed", "—", "CLEAR", "S.i. row 11 \"COLLAR HEIGHT\" does not say where; JACKETEK measures at CB (C01) and the front ends (C02)."),
  C02: M("Collar seam at the front end", "Collar outer edge at the front end", "straight", "single height", "collar rib", "relaxed", "—", "CLEAR"),
  C03: M("Left collar front end", "Right collar front end", "along the collar seam (curve)", "full length", "collar rib", "relaxed", "—", "CLEAR"),
  C04: M("Left outer corner", "Right outer corner", "along the outer edge (curve)", "full length", "collar rib", "relaxed", "—", "CLEAR"),
  C05: M("Left HPS at the collar seam", "Right HPS at the collar seam", "straight", "single width", "—", "—", "—", "CLEAR"),
  C06: M("HPS line", "Collar seam at CF", "vertical", "single distance", "—", "—", "—", "CLEAR", "Same name as S.i. row 10 \"FRONT NECKLINE DROP\" (7.5\" is an example value)."),
  C07: M("HPS line", "Collar seam at CB", "vertical", "single distance", "—", "—", "—", "CLEAR"),
  F01: M("Front edge", "Placket inner stitch line", "straight, perpendicular to the front edge", "single width", "—", "—", "—", "CLEAR"),
  F02: M("CF line", "Overlapping front edge", "straight, perpendicular", "single width", "—", "—", "—", "CLEAR"),
  F03: M("—", "—", "count", "count", "—", "—", "—", "NOT_ON_GARMENT", "A count, not a length."),
  F04: M("Collar seam at the front edge", "Top snap centre", "straight along the front edge", "single distance", "—", "—", "—", "CLEAR"),
  F05: M("Finished bottom edge", "Bottom snap centre", "straight along the front edge", "single distance", "included if the snap sits on the rib", "relaxed", "—", "CLEAR"),
  F06: M("Snap centre", "Next snap centre", "straight", "single distance", "—", "—", "—", "NOT_ON_GARMENT", "Computed from F03–F05 (equal spacing unless the pattern maker states otherwise); verified on the sample."),
  F07: M("Front edge", "Snap centre", "straight, perpendicular", "single distance", "—", "—", "—", "CLEAR"),
  P01: M("Upper end of the opening", "Lower end of the opening", "straight along the opening", "single length", "—", "—", "—", "CLEAR", "S.i. row 12 \"WELT POCKET LENGTH\" (7\" is an example value)."),
  P02: M("Welt seam", "Welt edge", "straight, perpendicular to the opening", "single width", "—", "—", "—", "CLEAR", "S.i. row 13 \"WELT POCKET WIDTH\" (1.2\" is an example value)."),
  P03: M("HPS", "Upper end of the opening", "vertical", "single distance", "—", "—", "—", "CLEAR"),
  P04: M("CF line", "Upper end of the opening", "horizontal", "single distance", "—", "—", "—", "CLEAR"),
  P05: M("Vertical reference", "Opening line", "angle", "degrees", "—", "—", "—", "CLEAR"),
  P06: M("Lower end of the opening (inside)", "Bottom of the pocket bag", "straight", "single length", "—", "—", "—", "CLEAR"),
  P07: M("Pocket bag edge", "Opposite bag edge", "straight, widest point", "single width", "—", "—", "—", "CLEAR"),
  L01: M("Lining CB neck", "Lining hem seam", "straight along CB", "difference lining − shell", "—", "—", "—", "CLEAR"),
  L02: M("Lining armhole", "Lining cuff seam", "along the overarm", "difference lining − shell", "—", "—", "—", "CLEAR"),
  L03: M("Lining side seam", "Opposite lining side seam", "straight", "difference lining − shell", "—", "—", "—", "CLEAR"),
  L04: M("Opening end", "Opening end", "straight", "single length", "—", "—", "—", "CLEAR", "Only if an inside pocket is fitted (undecided)."),
};

// ------------------------------------------------------------- Measurement-method conflicts
export const CONFLICTS = [
  { id: "MC-01", poms: ["S01", "S02"], title: "Sleeve: centre back vs shoulder seam", detail: "Golden Bear measures from centre back (S01, 90.17 cm M). The supplied chart measures from the shoulder seam (51 cm M, end point unknown). Different start points: the two numbers are never compared, combined or averaged. Arithmetic only: GB S01 − ½ GB B09 = 65.41 cm, ≈ 14 cm more than 51 cm — far more than a cuff rib, so the supplied chart's end point (cuff seam? elbow? underarm length?) or start point (a dropped shoulder seam) differs.", result: "MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED — no JACKETEK sleeve target." },
  { id: "MC-02", status: "DECISION MADE — K1 = DROPPED_SHOULDER (2026-10-10); measurement consequences remain open", poms: ["B09", "B10", "B11", "B14", "B15", "B16", "S01", "S02", "S03", "S04", "S10"], title: "Shoulder construction (K1) moves the shoulder point", detail: "JACKETEK uses a DROPPED SHOULDER. Golden Bear Classic is a set-in block; whether the supplied chart's jacket is dropped is unknown. On a dropped shoulder the shoulder point moves down the arm: across shoulder grows and sleeve-from-shoulder-point shrinks for the same body. Golden Bear's B09 and any set-in shoulder-point sleeve value are therefore not transferable.", result: "K1 resolved. B09 / B10 → TBD_PATTERN_MAKER (shoulder point placed by the pattern maker); S01 / S02 measured on the sample from the dropped shoulder point; no new cm values." },
  { id: "MC-03", poms: ["B01"], title: "Chest height", detail: "Golden Bear: circumference 1\" below the armhole. Supplied chart: half / flat chest, height not known (pit-to-pit at the armhole is common and reads slightly smaller). Same quantity (flat chest), possibly a different level.", result: "Used together as a provisional RANGE only (Rule 1, with this caveat). Sample records both levels." },
  { id: "MC-04", poms: ["B06"], title: "Body length start point", detail: "Golden Bear \"Center back\" and the supplied \"body length\" both leave the start point open (CB collar seam / top of collar / HPS). The legacy chart measures front length from HPS (≈ B08), not CB.", result: "Provisional range kept; LOW confidence. Sample records CB-from-collar-seam, CB-from-top-of-collar and B07." },
  { id: "MC-05", poms: ["B09"], title: "Across shoulder: straight vs contour", detail: "Neither Golden Bear nor the supplied chart states it.", result: "JACKETEK defines straight at the armhole seam line; sample also records the contour." },
  { id: "MC-06", poms: ["S07", "S06"], title: "S.i. \"SLEEVE OPENING (flat)\" / \"CUFF OPENING (flat)\"", detail: "The spec sheet and the grading page name the same row differently; 21\" cannot be a rib cuff edge.", result: "Example value; not mapped to S07 or S06." },
  { id: "MC-07", poms: ["C01", "C02"], title: "S.i. \"COLLAR HEIGHT\" position", detail: "Not stated whether at CB or at the front ends.", result: "Example value; JACKETEK measures both (C01, C02)." },
  { id: "MC-08", poms: ["B08", "B06"], title: "Legacy chart \"jacket length\" is a front length", detail: "official_size_chart.json \"JACKET LENGTH\" (70 cm M) is measured from the top shoulder/neck point on the front (HPS → hem = B08), not a centre-back length. It must not be compared with B06.", result: "Legacy chart excluded." },
];

// ------------------------------------------------------------- Decision per POM
// Only the POMs that differ from the default rules are listed.
export const PROPOSED_TARGETS_M = {
  B01: {
    quantity: "Half chest, flat (B01 ÷ 2)",
    rangeMin: 61.0, rangeMax: 62.2, unit: "cm",
    circumference: { rangeMin: 122.0, rangeMax: 124.5, unit: "cm", note: "B01 itself is a circumference: 61.0 × 2 = 122.0; Golden Bear 124.46 → 124.5." },
    sources: ["SUP 61 cm half chest (unverified secondary reference)", "GB 49 in = 124.46 cm circumference → 62.23 half"],
    derivation: "Range ends = the two references (Rule 1): supplied 61.0 (unverified secondary reference); Golden Bear 124.46 ÷ 2 = 62.23 → 62.2 (0.1 cm). Not averaged.",
    confidence: "LOW",
    confidenceReason: "Rests on Golden Bear alone (published value; circumference method inferred, not stated). The 61.0 end is an unverified secondary reference (source image unavailable) and adds no confidence; its height below the armhole is unknown (MC-03).",
    sampleValidation: "Measure B01 at 1\" below armhole (flat × 2) AND pit-to-pit at the armhole; fit on the M model (bagginess).",
  },
  B06: {
    quantity: "Centre-back length",
    rangeMin: 67.3, rangeMax: 68.0, unit: "cm",
    sources: ["GB 26.5 in = 67.31 cm", "SUP 68 cm body length (unverified secondary reference)"],
    derivation: "Range ends = the two references (Rule 1): Golden Bear 67.31 → 67.3; supplied 68.0 (unverified secondary reference). Not averaged.",
    confidence: "LOW",
    confidenceReason: "Rests on Golden Bear alone, whose start point is not stated; the 68.0 end is an unverified secondary reference (source image unavailable) and adds no confidence. Neither source states the start point; a top-of-collar start adds a full collar height (C01, not yet measured), which can exceed the 0.7 cm range itself (MC-04).",
    sampleValidation: "Measure CB from the collar seam, CB from the top of the collar, and B07 from HPS; adopt the method, then confirm the range.",
  },
};

// Superseded targets — kept as references with the reason (K1 = DROPPED_SHOULDER, 2026-10-10).
export const SET_IN_REFERENCE_M = {
  B09: {
    quantity: "Across shoulder (set-in / unknown-construction references)",
    rangeMin: 49.5, rangeMax: 50.0, unit: "cm",
    status: "REFERENCE ONLY — superseded as a JACKETEK target by K1 = DROPPED_SHOULDER",
    sources: ["GB 19.5 in = 49.53 cm (set-in)", "SUP 50 cm (construction unknown; unverified secondary reference)"],
    reason: "Both references were measured on a set-in (Golden Bear) or unknown construction. On JACKETEK's dropped shoulder the shoulder point is placed by the pattern maker, so across shoulder is a construction result: no cm target until the pattern maker proposes the shoulder point and the M sample is measured.",
    previous: "PROVISIONAL_TARGET 49.5–50.0 cm (approved 2026-10-09, before K1 was decided)",
  },
};

// K1 — shoulder construction decision (JACKETEK, 2026-10-10)
export const SHOULDER_DECISION = {
  id: "K1",
  status: "RESOLVED",
  decision: "DROPPED_SHOULDER",
  decided: "2026-10-10",
  decidedBy: "JACKETEK",
  reasons: [
    "The JACKETEK target fit is relaxed / baggy.",
    "The live product direction is visually closer to a dropped shoulder (the website describes \"Standard Baggy Fit — roomy and relaxed, with a dropped shoulder\").",
    "The S.i.-based canonical technical flat already uses a dropped shoulder.",
    "Golden Bear remains a fit / grading benchmark only; its set-in shoulder construction is not authoritative for JACKETEK.",
  ],
  notApproved: "No shoulder or sleeve measurement is approved by this decision.",
  shoulderPoint: "On the JACKETEK garment the shoulder point (SP) is where the sleeve-attachment (armhole) seam line crosses the shoulder line — the shoulder seam extended to the top fold with the garment laid flat. It sits below and outside the wearer's natural shoulder; its exact position is set by the pattern maker.",
  goldenBear: "Golden Bear's set-in values stay FIT_REFERENCE / EXTERNAL_REFERENCE (not deleted). Its shoulder (B09) and sleeve (S01) values are NOT directly transferable to the dropped-shoulder construction without pattern / sample validation.",
  siFlat: "Compatible: the canonical flat (garment-spec/working-varsity-flat, from the purchased S.i. page, unedited source) is drawn with a dropped shoulder — its shoulder points SP_L / SP_R sit on the body–sleeve seam well below and outside HPS (front: SP y ≈ 289 vs HPS y ≈ 213, drawing units, not to scale). The RFQ's B09 / S02 POM lines and the sleeve-zone unit (shoulder point → cuff seam = S02 − S09) already start at that dropped seam. No drawing change needed.",
  patternMakerParameters: [
    { id: "SC-1", name: "Shoulder-point position (drop extension)", definition: "Where the armhole seam meets the shoulder line, stated on the pattern as the extension beyond the natural-shoulder point of the base block (cm, pattern).", status: "TBD_PATTERN_MAKER" },
    { id: "SC-2", name: "Shoulder drop / slope at the dropped shoulder point", definition: "B11 — vertical HPS level → dropped shoulder-point level.", status: "TBD_PATTERN_MAKER (confirmed as B11 on the sample)" },
    { id: "SC-3", name: "Armhole depth and sleeve-cap height for the dropped shoulder", definition: "B14 and S10.", status: "TBD_PATTERN_MAKER" },
  ],
};

// Per-POM impact of K1 (no values — consequences only)
export const SHOULDER_IMPACT = {
  B09: { change: "Shoulder point moves down / out to the dropped armhole seam: across shoulder is wider than a set-in measure of the same body and is set by the pattern.", referenceComparable: "NO — Golden Bear set-in 49.53 cm; supplied 50 cm construction unknown", planStatus: "TBD_PATTERN_MAKER", wasProvisional: true, measureOnSample: "yes — straight and contour" },
  B10: { change: "Shoulder length includes the drop extension.", referenceComparable: "N/A — no reference", planStatus: "TBD_PATTERN_MAKER", measureOnSample: "yes" },
  B11: { change: "Slope to a lower shoulder point is larger than on a set-in block.", referenceComparable: "N/A", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes (pattern maker confirms the intended value, SC-2)" },
  B14: { change: "Dropped shoulders normally lower the armhole point.", referenceComparable: "N/A", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes" },
  B15: { change: "Starts at the dropped shoulder point.", referenceComparable: "N/A (S.i. 9¾\" is an example)", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes" },
  B16: { change: "Follows the dropped armhole seam.", referenceComparable: "N/A", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes" },
  S01: { change: "Path CB → dropped shoulder point → cuff. Less construction-dependent than S02, but Golden Bear's 90.17 cm is a set-in value.", referenceComparable: "BENCHMARK ONLY — not directly transferable", planStatus: "VERIFIED_SOURCE (reference only)", measureOnSample: "yes — to cuff seam AND finished edge, for comparison" },
  S02: { change: "Starts at the dropped shoulder point: shorter than a set-in sleeve for the same arm.", referenceComparable: "NO — supplied 51 cm: method conflict MC-01", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes — to cuff seam (primary) AND finished edge" },
  S03: { change: "Depends on the lower armhole point.", referenceComparable: "N/A", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes" },
  S04: { change: "Dropped-shoulder sleeves are usually wider at the top.", referenceComparable: "N/A", planStatus: "TO_MEASURE_ON_SAMPLE", measureOnSample: "yes" },
  S10: { change: "Low, flat sleeve cap.", referenceComparable: "N/A", planStatus: "TBD_PATTERN_MAKER", measureOnSample: "no (pattern)" },
  B01: { change: "Not a shoulder POM, but the reference level \"1\" below the armhole\" moves down with a lower armhole point.", referenceComparable: "YES with caveat (MC-03)", planStatus: "PROVISIONAL_TARGET", measureOnSample: "yes" },
};

