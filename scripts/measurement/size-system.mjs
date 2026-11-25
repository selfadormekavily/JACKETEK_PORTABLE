// JACKETEK DEVELOPMENT SIZE SYSTEM v0.1 — APPROVED FOR DEVELOPMENT USE (JACKETEK, 2026-10-11).
// NOT PRODUCTION APPROVED.
//
// Core fit dimensions have one development target at M and a grade; derived dimensions are
// calculated per size by stated formulas; pattern-dependent dimensions stay with the pattern maker;
// every value is validated on the physical M sample. Values are computed unrounded per size from
// Golden Bear's published rows and rounded to 0.1 cm only for output (no cumulative rounding).
//
// Source hierarchy (never averaged):
//   Golden Bear Classic Fit      = FIT_REFERENCE + GRADING_REFERENCE (verified, set-in, XS–4XL linear)
//   JACKETEK-supplied size chart = SECONDARY_VISUAL_REFERENCE + M SILHOUETTE REFERENCE (M only, unverified)
//   S.i. Graphics                = POM / TECHNICAL-DRAWING / PROPORTIONAL-VISUAL REFERENCE (no physical values,
//                                  no cm from drawing units)
//   Pattern maker + M sample     = final development validation authority
// Excluded: the legacy 60 / 70 / 62 chart, S.i. example values, configurator / 3D-model estimates.
import { GOLDEN_BEAR as GB, SUPPLIED as SUP } from "./sources.mjs";

export const VERSION = "v0.1";
export const DATE = "2026-10-11";
export const STATUS = "APPROVED FOR DEVELOPMENT USE — NOT PRODUCTION APPROVED";
export const APPROVAL = {
  developmentUse: { approved: true, by: "JACKETEK", date: "2026-10-11", scope: "Development tech packs, pattern making and the physical M sample." },
  production: { approved: false, requires: "Pattern maker + physical M sample measured, then explicit JACKETEK production approval in a revised Master Spec." },
};
/** The website's size range (src/features/configurator/model/catalog.ts SIZES). */
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
export const ANCHOR = "M";
const IN = 2.54;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const steps = (s) => SIZES.indexOf(s) - SIZES.indexOf(ANCHOR);

export const CLASS = {
  TARGET: "DEVELOPMENT_TARGET",
  DERIVED: "DERIVED",
  PATTERN: "PATTERN_MAKER_SET",
  SAMPLE: "SAMPLE_VALIDATION",
};

export const SOURCE_HIERARCHY = [
  { source: "Golden Bear Classic Fit", role: "FIT_REFERENCE + GRADING_REFERENCE", use: "Body volume, length and shoulder benchmark; the size-to-size grading of every graded dimension. Set-in shoulder: never transferred directly to the dropped shoulder." },
  { source: "JACKETEK-supplied size chart", role: "SECONDARY_VISUAL_REFERENCE + M SILHOUETTE REFERENCE", use: "M silhouette check (half chest 61, length 68, shoulder 50). Unverified, methods unknown; its grading is not recorded and is not used; its 51 cm sleeve is not used." },
  { source: "S.i. Graphics varsity tech pack", role: "POM / TECHNICAL-DRAWING / PROPORTIONAL-VISUAL REFERENCE", use: "POM structure, measuring locations, method diagrams, and the visual proportion of the dropped shoulder. No physical value; no cm from drawing units." },
  { source: "Pattern maker + physical M sample", role: "FINAL DEVELOPMENT VALIDATION AUTHORITY", use: "Confirms or corrects every value here before anything is production approved." },
];

/** Golden Bear in cm, unrounded, per size (from the published inch rows). */
const gbCm = (id, s, k = 1) => GB.rows[s][id] * IN * k;
const gbStep = (id, k = 1) => GB.gradeIn[id] * IN * k;
const gbRef = (id, k = 1, note = "") => ({ M: r2(gbCm(id, "M", k)), step: r2(gbStep(id, k)), bySize: Object.fromEntries(SIZES.map((s) => [s, r2(gbCm(id, s, k))])), note });
const sup = (key) => SUP.valuesM[key].cm;

// ---------------------------------------------------------------- dropped-shoulder rule (SC-1)
export const SHOULDER_EXTENSION = {
  id: "SC-1",
  name: "Dropped-shoulder extension per side",
  valuePerSideCm: 5.0,
  gradeCm: 0,
  class: CLASS.TARGET,
  status: "JACKETEK DEVELOPMENT RULE (approved for development use 2026-10-11) — validated by the pattern maker and the M sample; NOT production approved",
  rule: "JACKETEK across shoulder (size) = Golden Bear set-in across shoulder (size) + 2 × 5.0 cm. Constant extension for every size unless a pattern constraint requires otherwise.",
  replaces: "REJECTED / REPLACED — not an active rule: the earlier proposal of 3.0 cm per side (B09 / B01 ≈ 0.895) was rejected by JACKETEK on 2026-10-11 because it under-represents the dropped-shoulder proportion of the canonical S.i.-based JACKETEK flat.",
  why: [
    "Golden Bear supplies the set-in shoulder width and its grading; the dropped shoulder moves the shoulder point outwards by the extension on each side.",
    "JACKETEK's visual reading of the canonical S.i.-based flat: shoulder-point width ≈ 0.96 × half-chest width for the M silhouette → 0.96 × 62.0 = 59.5 cm, which matches 49.53 + 2 × 5.0 = 59.53 cm.",
    "The S.i. flat is a proportional / visual reference only: no drawing unit is converted to cm. (Recorded for transparency: a landmark measurement on the stylised drawing gives shoulder-point span ÷ chest width ≈ 1.20; the drawing is not to scale and neither ratio is a measurement.)",
    "The pattern maker and the M sample validate the rule; a pattern constraint may require a different extension, proposed explicitly.",
  ],
};
const EXT = SHOULDER_EXTENSION.valuePerSideCm;

// ---------------------------------------------------------------- dimensions (computed per size)
const B01_M = 62.0, B06_M = 68.0;
const half = 0.5;
const calc = {
  B01: (s) => B01_M + steps(s) * gbStep("B01", half),
  B06: (s) => B06_M + steps(s) * gbStep("B06"),
  B09: (s) => gbCm("B09", s) + 2 * EXT,
};
calc["B01-C"] = (s) => 2 * r1(calc.B01(s)); // twice the stated flat width, so the table always reads B01 × 2
calc["S02-E"] = (s) => gbCm("S01", s) - calc.B09(s) / 2;
calc.S01 = (s) => calc["S02-E"](s) + calc.B09(s) / 2; // = Golden Bear by construction (reference only)
calc.B03 = (s) => calc.B01(s);
const bySize = (id) => Object.fromEntries(SIZES.map((s) => [s, r1(calc[id](s))]));

export const CORE = [
  {
    id: "B01",
    name: "Half Chest — Flat Width (2.54 cm below the armhole point)",
    class: CLASS.TARGET,
    M: B01_M,
    grade: { goldenBear: r2(gbStep("B01", half)), jacketek: r2(gbStep("B01", half)) },
    formula: "M 62.0 + n × 3.81 (Golden Bear half-chest step), rounded to 0.1",
    method: "Garment flat, snaps closed, straight side seam to side seam 2.54 cm below the armhole point. Flat width only; the circumference (B01-C) is derived, never measured separately.",
    sources: { goldenBear: { M: r2(gbCm("B01", "M", half)), step: r2(gbStep("B01", half)), note: "49\" circumference ÷ 2" }, userChart: { M: sup("halfChest"), note: "half / flat chest; height below armhole not known" }, si: "CHEST POM location (front, below armhole); no value used" },
    choice: "Approved 62.0 cm: the practical value nearest Golden Bear's verified 62.23 cm, 1.0 cm above the supplied chart's 61.",
    confidence: "MEDIUM",
  },
  {
    id: "B06",
    name: "Centre-Back Length — collar seam → finished waistband edge",
    class: CLASS.TARGET,
    M: B06_M,
    grade: { goldenBear: r2(gbStep("B06")), jacketek: r2(gbStep("B06")) },
    formula: "M 68.0 + n × 1.27 (Golden Bear step), rounded to 0.1",
    method: "Garment flat, back up, rib relaxed. Centre back at the collar seam → finished bottom edge of the waistband rib, straight along CB.",
    sources: { goldenBear: { M: r2(gbCm("B06", "M")), step: r2(gbStep("B06")), note: "\"Center back\" 26½\"; start point not stated" }, userChart: { M: sup("bodyLength"), note: "start point not known" }, si: "BACK LENGTH POM location; no value used" },
    choice: "Approved 68.0 cm = the supplied M silhouette value, 0.7 cm longer than Golden Bear (start points of both unknown).",
    confidence: "LOW–MEDIUM",
  },
];

export const DERIVED = [
  {
    id: "B09",
    name: "Across Shoulder — dropped shoulder, seam point to seam point (straight, back up)",
    class: CLASS.DERIVED,
    label: "DERIVED DEVELOPMENT VALUE",
    grade: { goldenBear: r2(gbStep("B09")), jacketek: r2(gbStep("B09")) },
    formula: "Golden Bear across shoulder (size) + 2 × SC-1 = Golden Bear (size) + 10.0",
    worked: `${r2(gbCm("B09", "M"))} + 10.0 = ${r2(calc.B09("M"))} → ${r1(calc.B09("M")).toFixed(1)} cm`,
    sources: { goldenBear: { M: r2(gbCm("B09", "M")), step: r2(gbStep("B09")), note: "19½\" set-in — fit and grading reference, not transferred directly" }, userChart: { M: sup("acrossShoulder"), note: "construction and method unknown — visual reference only" }, si: "ACROSS SHOULDER POM (dropped shoulder as drawn); proportional / visual justification of the drop only" },
    roles: ["Golden Bear supplies the grading behaviour (¾\" = 1.905 cm per size)", "+10.0 cm total extension = JACKETEK's dropped-shoulder development rule (SC-1 = 5.0 cm per side)", "The S.i. flat gives the visual / proportional justification", "The M sample and the pattern maker validate the rule"],
    dependsOn: ["SC-1"],
    confidence: "LOW–MEDIUM",
  },
  {
    id: "S02-E",
    name: "Sleeve — shoulder point → finished cuff edge (SECONDARY)",
    class: CLASS.DERIVED,
    label: "DERIVED DEVELOPMENT VALUE",
    grade: { goldenBear: r2(gbStep("S01")), jacketek: r2(gbStep("S01") - gbStep("B09") / 2) },
    formula: "Golden Bear sleeve from centre back (size) − ½ × JACKETEK B09 (size)",
    worked: `${r2(gbCm("S01", "M"))} − ${r2(calc.B09("M"))} ÷ 2 = ${r2(calc["S02-E"]("M"))} → ${r1(calc["S02-E"]("M")).toFixed(1)} cm`,
    assumptions: [
      "The centre-back sleeve reaches the same wrist on the set-in reference and the dropped JACKETEK jacket; only the split between shoulder and sleeve changes.",
      "Centre back → shoulder point ≈ ½ × across shoulder (CB-sleeve convention). The real path (neck curve, shoulder slope) is slightly longer, so the sleeve may come out up to ~1–2 cm long — checked on the sample.",
      "Golden Bear's sleeve end point is not stated; assumed the finished cuff edge, hence S02-E (edge), not S02 (seam).",
    ],
    sources: { goldenBear: { M: r2(gbCm("S01", "M")), step: r2(gbStep("S01")), note: "35½\" from centre back, set-in — REFERENCE ONLY" }, userChart: { M: null, note: "51 cm sleeve not used: method unverified" }, si: "Sleeve POM location; no value used" },
    dependsOn: ["SC-1", "B09"],
    confidence: "LOW",
  },
  {
    id: "S02",
    name: "Sleeve — shoulder point → cuff seam (PRIMARY JACKETEK sleeve)",
    class: CLASS.DERIVED,
    label: "FORMULA ONLY until S09 is set",
    grade: { goldenBear: null, jacketek: r2(gbStep("S01") - gbStep("B09") / 2) },
    formula: "S02 = S02-E − S09 (S09 = cuff rib height, PATTERN_MAKER_SET)",
    worked: "S02-E − S09 (no number until S09 is set)",
    formulaOnly: true,
    missing: "S09 cuff rib height — PATTERN_MAKER_SET (depends on the rib the factory proposes).",
    sources: { goldenBear: { M: null, step: null, note: "no cuff-seam value published" }, userChart: { M: null, note: "not used" }, si: "Sleeve / cuff POM locations; S.i. rib height is an example value — not used" },
    dependsOn: ["S02-E", "S09"],
    confidence: "Open until S09 is set",
  },
  {
    id: "B01-C",
    name: "Chest circumference — derived only, never measured separately",
    class: CLASS.DERIVED,
    label: "DERIVED (B01 × 2)",
    grade: { goldenBear: r2(gbStep("B01")), jacketek: r2(2 * gbStep("B01", half)) },
    formula: "B01 × 2",
    worked: `62.0 × 2 = ${r1(calc["B01-C"]("M")).toFixed(1)} cm`,
    sources: { goldenBear: { M: r2(gbCm("B01", "M")), step: r2(gbStep("B01")), note: "49\" circumference" }, userChart: { M: null, note: "—" }, si: "—" },
    dependsOn: ["B01"],
    confidence: "As B01",
  },
  {
    id: "S01",
    name: "Sleeve from centre back → finished cuff edge — REFERENCE / COMPARISON ONLY (S01-E; S01 → cuff seam = S01-E − S09)",
    class: CLASS.DERIVED,
    label: "REFERENCE ONLY — NOT A JACKETEK TARGET",
    grade: { goldenBear: r2(gbStep("S01")), jacketek: r2(gbStep("S01")) },
    formula: "S02-E + ½ × B09 (= Golden Bear's centre-back sleeve by construction)",
    worked: `${r1(calc["S02-E"]("M")).toFixed(1)} + ${r2(calc.B09("M") / 2)} ≈ ${r1(calc.S01("M")).toFixed(1)} cm`,
    sources: { goldenBear: { M: r2(gbCm("S01", "M")), step: r2(gbStep("S01")), note: "35½\" from centre back" }, userChart: { M: null, note: "—" }, si: "—" },
    dependsOn: ["S02-E", "B09"],
    confidence: "Reference only — centre back → cuff is never confused with shoulder point → cuff",
  },
  {
    id: "B03",
    name: "Body Width at Waistband Seam — Flat",
    class: CLASS.DERIVED,
    label: "DERIVED DEVELOPMENT VALUE",
    grade: { goldenBear: null, jacketek: r2(gbStep("B01", half)) },
    formula: "B03 = B01 (initial straight-body shell before rib contraction)",
    worked: "62.0 cm",
    sampleChecks: ["visual blouse over the waistband rib", "hem balance", "shell-to-rib relationship", "relaxed / baggy silhouette"],
    patternMakerRule: "If a slight taper is technically preferable, the pattern maker must propose it explicitly — never change the value silently.",
    sources: { goldenBear: { M: null, step: null, note: "not published" }, userChart: { M: null, note: "not published" }, si: "WAIST / BODY POM location; visual only" },
    dependsOn: ["B01"],
    confidence: "LOW",
  },
].map((d) => ({ ...d, M: d.formulaOnly ? null : r1(calc[d.id]("M")) }));

/** Values that stay with the pattern maker (and are validated on the sample). */
export const PATTERN_MAKER = [
  { ids: ["SC-2", "B11"], what: "Shoulder slope / drop at the dropped shoulder point — no source publishes it." },
  { ids: ["SC-3", "B14", "S10", "B15", "B16"], what: "Armhole depth, armhole and sleeve cap — PATTERN_MAKER_SET + SAMPLE_VALIDATION. Not derived from Golden Bear or S.i.: no source gives a defensible JACKETEK dropped-shoulder value." },
  { ids: ["B10"], what: "Shoulder length HPS → shoulder point = ½ × (B09 − C05); needs the neck width C05." },
  { ids: ["S09", "R01", "C01", "C02", "R05"], what: "Rib heights and stripe layout — depend on the rib the factory proposes (S.i. rib heights are example values). S09 also fixes S02." },
  { ids: ["B04", "B05", "S06", "S07", "S08", "R02", "R03", "R04"], what: "Rib openings and rib cut lengths — follow B03 / sleeve width × the rib ratio the pattern maker sets." },
  { ids: ["B02", "B12", "B13", "S04", "S05"], what: "Waist, across front / back, bicep, elbow — measuring levels and values from the pattern." },
  { ids: ["C03", "C04", "C05", "C06", "C07"], what: "Collar and neckline." },
  { ids: ["F01", "F02", "F03", "F04", "F05", "F06", "F07"], what: "Placket, overlap and snap layout." },
  { ids: ["P01", "P02", "P03", "P04", "P05", "P06", "P07"], what: "Pocket opening, position, angle and bag." },
  { ids: ["L01", "L02", "L03", "L04"], what: "Lining allowances and inside pocket." },
];

export const SAMPLE_VALIDATION = {
  rule: "Every value in this chart — development targets, derived values, SC-1 and the pattern maker's values — is measured on the physical M sample before anything is production approved.",
  sampleOnly: [
    { id: "B07", note: "Back length from HPS = B06 + C07 (known once C07 is set / measured)" },
    { id: "B08", note: "Front length from HPS — measured" },
    { id: "S03", note: "Underarm sleeve length — follows the armhole (SC-3)" },
    { id: "EC calibration", note: "Embroidery zone units: body = B07 − R01, sleeve = S02" },
  ],
};

/** One row per dimension with the rounded value for every size (null = formula only). */
export function sizeTable() {
  const rows = [...CORE, ...DERIVED].map((d) => ({
    id: d.id,
    name: d.name,
    class: d.class,
    label: d.label ?? d.class,
    gradePerSizeCm: d.grade.jacketek,
    goldenBearGradeCm: d.grade.goldenBear,
    bySize: d.formulaOnly ? Object.fromEntries(SIZES.map((s) => [s, null])) : bySize(d.id),
    formula: d.formula,
  }));
  rows.push({ id: "SC-1", name: "Dropped-shoulder extension per side", class: CLASS.TARGET, label: "JACKETEK DEVELOPMENT RULE", gradePerSizeCm: 0, goldenBearGradeCm: null, bySize: Object.fromEntries(SIZES.map((s) => [s, EXT])), formula: "constant 5.0 cm per side" });
  return rows;
}

export function goldenBearTable() {
  return [
    { id: "B01", name: "Half chest (circumference ÷ 2)", ...gbRef("B01", half) },
    { id: "B06", name: "Center back", ...gbRef("B06") },
    { id: "B09", name: "Across shoulder (set-in)", ...gbRef("B09") },
    { id: "S01", name: "Sleeve from center back (set-in)", ...gbRef("S01") },
  ];
}

export const NOT_IN_RANGE = "Golden Bear also publishes 3XL and 4XL; the JACKETEK website offers XS–XXL, so those are not in this chart (the same formulas extend it if the range grows).";

/** The whole development size chart as data (garment-spec/jacketek-development-size-chart-v0.1.json, Master Spec v0.2). */
export function chartJson() {
  return {
    title: "JACKETEK Development Size Chart",
    version: VERSION,
    date: DATE,
    status: STATUS,
    approval: APPROVAL,
    productionApproved: false,
    units: "cm, 0.1 cm; garment measured flat",
    sizes: SIZES,
    anchorSize: ANCHOR,
    shoulderConstruction: "DROPPED_SHOULDER (K1)",
    rounding: "Every value is computed unrounded per size from Golden Bear's published rows and rounded to 0.1 cm only for output.",
    classes: {
      [CLASS.TARGET]: "JACKETEK development target or development rule (approved for development use).",
      [CLASS.DERIVED]: "Calculated per size from targets, Golden Bear or a stated rule by the formula shown.",
      [CLASS.PATTERN]: "Set by the pattern maker; no defensible number from the sources.",
      [CLASS.SAMPLE]: "Known / confirmed only on the physical M sample. Every value in this chart is validated there.",
    },
    sourceHierarchy: SOURCE_HIERARCHY,
    excluded: ["Legacy production-drawing chart (60 / 70 / 62)", "S.i. example values", "Configurator / 3D-model estimates", "Supplied-chart 51 cm sleeve (method unverified)", "Supplied-chart grading (not recorded)"],
    shoulderExtension: SHOULDER_EXTENSION,
    core: CORE,
    derived: DERIVED,
    patternMaker: PATTERN_MAKER,
    sampleValidation: SAMPLE_VALIDATION,
    table: sizeTable(),
    goldenBearReference: goldenBearTable(),
    notInRange: NOT_IN_RANGE,
  };
}
