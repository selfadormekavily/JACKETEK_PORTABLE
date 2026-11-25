// SIZE-M DEVELOPMENT SAMPLE REQUEST (MSR) — the data of the factory-development package for the
// first physical size-M sample. NOT a Production Tech Pack, NOT a customer RFQ.
//
//   buildRequest(v2, zones) → the whole package as one JSON object (pure; no file access)
//
// Reads only Master Spec v0.2 (measurement plan, K1, K2 plan) and scripts/materials/components.mjs.
// Rules:
//   - Only two targets: B01 half chest and B06 centre-back length (PROVISIONAL, LOW confidence).
//   - No across-shoulder target (B09 = pattern maker), no sleeve target (S02 = pattern maker / sample).
//   - No tolerance (TBD), no material / construction value, no physical embroidery size.
//   - External references (Golden Bear, supplied chart, S.i. template, legacy chart, configurator
//     estimates) are not printed at all: they are not targets.
//   - Leather stays the sleeve design intent; synthetic / PU only as an alternative proposal.
//   - The factory returns proposals and measurements; approval is JACKETEK's, after the sample.
import { COMPONENTS, LEATHER_POLICY, OPEN_ALIGNMENT, CONTRADICTIONS } from "../materials/components.mjs";

export const REVISION = "MSR-01";
export const ISSUED = "2026-10-11";
export const TITLE = "JACKETEK SIZE M DEVELOPMENT SAMPLE REQUEST";
export const MARKS = ["DEVELOPMENT SAMPLE", "NOT FOR BULK PRODUCTION", "NOT PRODUCTION APPROVED"];
export const SCHEMA = "jacketek.m-sample-request";
export const RETURN_SCHEMA = "jacketek.m-sample-return";

/** What every unanswered item says (never an empty cell). */
export const R = {
  FACTORY: "FACTORY TO PROPOSE",
  PATTERN: "PATTERN MAKER TO SET",
  SAMPLE: "MEASURE ON SAMPLE",
  JACKETEK: "JACKETEK TO APPROVE AFTER SAMPLE",
  TBD: "TBD",
};

/** Variance statuses (scripts/sample-development/variance.mjs). Never a pass / fail. */
export const VARIANCE_STATUS = {
  WITHIN: "WITHIN_TARGET_RANGE",
  OUTSIDE: "OUTSIDE_TARGET_RANGE",
  REFERENCE: "REFERENCE_ONLY",
  NONE: "NO_TARGET",
  REVIEW: "REVIEW_REQUIRED",
};

export const PURPOSE = [
  "garment silhouette",
  "relaxed / baggy fit",
  "dropped shoulder construction",
  "body length",
  "chest width",
  "shoulder-point location",
  "sleeve geometry",
  "armhole",
  "rib proportions and recovery",
  "pocket construction",
  "lining construction",
  "snap placement",
  "cotton / leather material compatibility",
  "embroidery compatibility",
  "overall workmanship",
];

export const WORKFLOW = [
  "JACKETEK sends this M Development Sample Request (MSR) to the factory.",
  "Factory / pattern maker reviews the target silhouette and the open construction requirements.",
  "Factory proposes the missing material and construction specifications.",
  "Pattern maker establishes the missing pattern-dependent dimensions (incl. SC-1 to SC-3).",
  "Factory makes the physical size-M sample.",
  "Factory measures the finished sample by the JACKETEK POM methods in this document.",
  "Factory returns: measurement sheet, material specification sheet, construction proposal, photos, the sample.",
  "JACKETEK compares the actual measurements with the provisional targets.",
  "JACKETEK approves / rejects / requests corrections.",
  "Only after approval does JACKETEK create Production Tech Pack v1.0.",
];

// ---------------------------------------------------------------- measurement sheet
/**
 * B01 in the development system. Master Spec v0.1 names B01 "Chest circumference" (historical, kept);
 * the development measurement and its target are the half chest flat width.
 */
export const B01_TERMS = {
  primary: "Half Chest — Flat Width",
  derived: { name: "Chest circumference (derived)", formula: "Flat Width × 2", measured: false, by: "JACKETEK", note: "Derived from the flat width; not a separately measured POM." },
  historicalName: "Chest circumference, 1\" (2.54 cm) below armhole (Master Spec v0.1 name, kept unchanged)",
};
/** Exact wording for the POMs whose method must be unambiguous (JACKETEK, MSR-01). */
const METHOD = {
  B01: "HALF CHEST — FLAT WIDTH. Garment laid flat, front up, snaps closed, smoothed without stretching. LEVEL: 2.54 cm (1\") below the armhole point, measured down the side seam. Measure STRAIGHT across, side seam to side seam. Report the FLAT WIDTH only. Not along a curve, not around the body. Derived circumference = Flat Width × 2 — calculated by JACKETEK, NOT a separately measured POM.",
  "B01-A": "Half Chest — Flat Width as B01, but at the level OF the armhole point (pit to pit), straight. Alternative level, recorded for comparison only (flat width, not a circumference).",
  B06: "Garment laid flat, BACK facing up, rib relaxed. START: centre back at the COLLAR SEAM (where the collar rib joins the body) — not the top of the collar. END: finished bottom edge of the waistband rib at centre back. STRAIGHT, vertical along the centre-back line.",
  "B06-T": "As B06 but START at the TOP (outer edge) of the collar at centre back. Alternative start point, recorded for comparison only.",
  B09: "Garment laid flat, BACK facing up, smoothed. FROM the LEFT shoulder point TO the RIGHT shoulder point. Dropped shoulder: the shoulder point is where the sleeve-attachment (armhole) seam crosses the shoulder line. Measure STRAIGHT, seam point to seam point, at the seam line.",
  "B09-C": "As B09 but ALONG the back contour / shoulder line from seam point to seam point. Recorded for comparison only.",
  S02: "PRIMARY SLEEVE METHOD. Sleeve laid straight and flat, overarm fold up. FROM the shoulder point (dropped: armhole seam on the shoulder line) ALONG the overarm fold TO the CUFF SEAM (where the rib cuff is attached). Rib excluded.",
  "S02-E": "SECONDARY. Same start and path as S02, but TO the FINISHED CUFF EDGE (rib included, relaxed). Check: S02-E ≈ S02 + S09. Never reported as S02.",
  S01: "COMPARISON ONLY. FROM centre back at the collar seam, ALONG the shoulder line to the shoulder point, then DOWN the overarm fold TO the CUFF SEAM. Never reported as S02.",
  "S01-E": "COMPARISON ONLY. As S01 but TO the FINISHED CUFF EDGE (rib included, relaxed).",
};

/** Extra rows (alternative methods) placed after their POM. */
const EXTRA_ROWS = {
  B01: [{ id: "B01-A", name: "Half Chest — Flat Width AT the armhole point (pit to pit)", role: "ALTERNATIVE" }],
  B06: [{ id: "B06-T", name: "Centre-back length from the TOP of the collar", role: "ALTERNATIVE" }],
  B09: [{ id: "B09-C", name: "Across shoulder along the back contour", role: "ALTERNATIVE" }],
};
/** The three sleeve methods, in this order, never interchanged. */
const SLEEVE_ROWS = [
  { id: "S02", pomId: "S02", name: "Sleeve — shoulder point → cuff seam (PRIMARY)", role: "PATTERN_TARGET_TBD" },
  { id: "S02-E", pomId: "S02", name: "Sleeve — shoulder point → finished cuff edge (SECONDARY)", role: "MEASURE" },
  { id: "S01", pomId: "S01", name: "Sleeve — centre back → cuff seam (COMPARISON ONLY)", role: "COMPARISON" },
  { id: "S01-E", pomId: "S01", name: "Sleeve — centre back → finished cuff edge (COMPARISON ONLY)", role: "COMPARISON" },
];

const ROLE_TEXT = {
  TARGET: "PROVISIONAL TARGET",
  MEASURE: "NO TARGET — MEASURE ON SAMPLE",
  PATTERN: "NO TARGET — PATTERN MAKER TO SET",
  PATTERN_TARGET_TBD: "TBD — PATTERN MAKER",
  ALTERNATIVE: "REFERENCE ONLY — alternative method",
  COMPARISON: "REFERENCE ONLY — comparison, no target",
  CALCULATED: "NO TARGET — calculated from the pattern",
  PATTERN_ONLY: "NO TARGET — pattern measure",
};

function roleOf(p) {
  const cls = p.measurementPlan?.sampleClass;
  if (p.id === "B01" || p.id === "B06") return "TARGET";
  if (p.id === "B09") return "PATTERN_TARGET_TBD";
  if (p.id === "S10") return "PATTERN_ONLY";
  if (cls === "CALCULATED AFTER SAMPLE") return "CALCULATED";
  if (cls === "PATTERN MAKER TO SET") return "PATTERN";
  return "MEASURE";
}

/** The provisional target of B01 / B06 from v0.2 — the only two targets. */
function targetOf(p) {
  const t = p.measurementPlan?.proposedTargetM;
  if (!t || (p.id !== "B01" && p.id !== "B06")) return null;
  return {
    min: t.rangeMin,
    max: t.rangeMax,
    unit: t.unit,
    quantity: p.id === "B01" ? B01_TERMS.primary : "Centre-back length, collar seam → finished rib edge",
    status: "PROVISIONAL_TARGET",
    confidence: t.confidence,
    label: "PROVISIONAL TARGET · LOW CONFIDENCE · NOT PRODUCTION APPROVED",
  };
}

const methodFrom = (p) => {
  const m = p.measurementPlan?.jacketekMethod ?? {};
  const bits = [`FROM ${m.a ?? p.start}`, `TO ${m.b ?? p.end}`, `${m.path ?? "straight"}`, p.condition];
  if (m.rib && m.rib !== "—") bits.push(`rib ${m.rib}${m.ribState && m.ribState !== "—" ? ` (${m.ribState})` : ""}`);
  return bits.filter(Boolean).join(" · ");
};

const pmNote = (p) => {
  const m = p.measurementPlan?.jacketekMethod ?? {};
  if (m.clarity === "DISTANCE_TBD") return "Measuring level: PATTERN MAKER TO SET before the sample.";
  if (p.id === "L04") return "Only if an inside pocket is fitted (JACKETEK decision open).";
  if (p.id === "F03") return "A count, not a length.";
  return null;
};

function row(base, { id, pomId, name, role, method }) {
  const target = role === "TARGET" ? targetOf(base) : null;
  const notMeasured = role === "CALCULATED" || role === "PATTERN_ONLY";
  return {
    id,
    pomId,
    area: base.area,
    name,
    howToMeasure: method,
    note: pmNote(base),
    role,
    target,
    targetText: target ? `${target.min.toFixed(1)}–${target.max.toFixed(1)} ${target.unit}` : ROLE_TEXT[role],
    tolerance: { value: null, text: R.TBD, note: "No tolerance is approved. JACKETEK sets tolerances at sample approval." },
    patternProposed: { value: null, unit: id === "F03" ? "count" : id === "P05" ? "deg" : "cm", fill: R.PATTERN, by: "factory / pattern maker" },
    sampleActual: { value: null, unit: id === "F03" ? "count" : id === "P05" ? "deg" : "cm", fill: notMeasured ? `${R.PATTERN} (pattern / cut piece)` : R.SAMPLE, by: "factory" },
    variance: { value: null, fill: "JACKETEK — after sample", by: "JACKETEK" },
    status: { value: null, fill: R.JACKETEK, by: "JACKETEK" },
    comments: null,
    ...(id === "B01" ? { derived: B01_TERMS.derived } : {}),
  };
}

export function measurementRows(v2) {
  const out = [];
  for (const p of v2.poms) {
    if (p.id === "S01") continue; // placed with the sleeve rows
    if (p.id === "S02") {
      for (const s of SLEEVE_ROWS) out.push(row(v2.poms.find((q) => q.id === s.pomId), { ...s, method: METHOD[s.id] }));
      continue;
    }
    const role = roleOf(p);
    const name = p.id === "B01" ? B01_TERMS.primary : p.name;
    out.push(row(p, { id: p.id, pomId: p.id, name, role, method: METHOD[p.id] ?? methodFrom(p) }));
    for (const x of EXTRA_ROWS[p.id] ?? []) out.push(row(p, { ...x, pomId: p.id, method: METHOD[x.id] }));
  }
  return out;
}

// ---------------------------------------------------------------- dropped shoulder
export function droppedShoulder(v2) {
  const k1 = v2.shoulderConstruction;
  return {
    construction: "DROPPED SHOULDER",
    k1: { status: k1.status, decision: k1.decision, decided: k1.decided },
    shoulderPoint: k1.shoulderPoint,
    parameters: k1.patternMakerParameters.map((p) => ({ id: p.id, name: p.name, definition: p.definition, value: null, fill: R.PATTERN, when: "Recorded on the pattern before or with the sample; marked on the sample." })),
    rules: [
      "SC-1 to SC-3 are set by the pattern maker for the JACKETEK relaxed / baggy fit.",
      "Do NOT derive them from Golden Bear or any set-in reference.",
      "Mark the shoulder point on the sample (tailor's chalk / thread tack) and photograph it.",
      "Across shoulder (B09) and the sleeve (S02) follow from these choices: no target is given.",
    ],
  };
}

// ---------------------------------------------------------------- material / construction proposals
const f = (key, label, extra = {}) => ({ key, label, value: null, fill: R.FACTORY, ...extra });
const comp = (id) => COMPONENTS.find((c) => c.id === id);

export function materialProposals() {
  const sleeve = comp("K2.2");
  return {
    rule: "Give the actual specification for the sample, the reason, and any option with its price impact. Number your options. Send swatches / photos where practical. Nothing here is approved by JACKETEK before the sample is checked.",
    sections: [
      { id: "MP-1", title: "Body — Cotton Fabric", k2: "K2.1", designIntent: comp("K2.1").material.value, swatch: true, fields: [
        f("fibreComposition", "Fibre composition"), f("weave", "Weave / construction"), f("gsm", "GSM"), f("finish", "Finish"),
        f("shrinkage", "Shrinkage (length / width, wash method)"), f("colourMatching", "Colour-matching method"), f("supplierCode", "Supplier / material code"),
      ] },
      { id: "MP-2", title: "Sleeves — Leather", k2: "K2.2", designIntent: sleeve.material.value, swatch: true, policy: LEATHER_POLICY, fields: [
        f("leatherType", "Leather type (animal, tannage)"), f("identification", "Genuine leather — material identification / evidence"), f("thickness", "Thickness"),
        f("grain", "Grain"), f("finish", "Finish"), f("handFeel", "Hand feel"), f("backing", "Backing"), f("colourConsistency", "Colour consistency (hide to hide, lot to lot)"),
        f("moq", "MOQ"), f("priceImpact", "Price impact"), f("supplierCode", "Supplier / material code"),
      ] },
      { id: "MP-3", title: "Rib — collar, cuffs, waistband", k2: "K2.4–K2.6", designIntent: "Knitted varsity rib; collar / cuffs / waistband matching; striped colourway supported", swatch: true,
        parts: ["collar", "cuffs", "waistband"], fields: [
          f("composition", "Composition"), f("knitStructure", "Knit structure"), f("gauge", "Gauge"), f("weight", "Weight"), f("thickness", "Thickness"),
          f("stretchPct", "Stretch %"), f("recoveryPct", "Recovery %"), f("stripeConstruction", "Stripe construction (knitted-in / other)"), f("stripeWidths", "Stripe widths and positions"),
          f("colourMatch", "Colour-match method (to body / sleeves)"),
        ] },
      { id: "MP-4", title: "Lining", k2: "K2.3", designIntent: "Lining required (body and sleeves). Plain or quilted NOT chosen yet.", swatch: true, fields: [
        f("material", "Material"), f("fibreContent", "Fibre content"), f("weight", "Weight"), f("colour", "Colour"),
        f("plainOrQuilted", "Plain vs quilted — propose; JACKETEK decides after the sample", { fill: `${R.FACTORY} · ${R.JACKETEK}` }),
        f("wadding", "Wadding (only if quilted)"), f("breathability", "Breathability"), f("handFeel", "Hand feel"), f("embroideryCompatibility", "Embroidery compatibility (stitches through the shell; protection)"),
      ] },
      { id: "MP-5", title: "Snaps / hardware", k2: "K2.7", designIntent: "Metal snap front closure", swatch: true, fields: [
        f("diameter", "Snap diameter"), f("alloy", "Material / alloy"), f("plating", "Plating / finish"), f("colour", "Colour"),
        f("supplierRef", "Supplier / reference number if available"), f("attachment", "Attachment method"),
        f("force", "Opening / closing force, or equivalent quality assessment"), f("reinforcement", "Reinforcement method"),
        f("count", "Snap count", { fill: R.PATTERN }), f("spacing", "Snap spacing / positions", { fill: R.PATTERN }),
      ] },
    ],
    alternativeProposals: {
      label: LEATHER_POLICY.alternatives,
      rule: LEATHER_POLICY.rule,
      replacesDesignIntent: false,
      fieldsPerAlternative: ["material", "identification", "costDifference", "moqDifference", "performanceDifference", "appearanceDifference"],
    },
  };
}

export function constructionProposals() {
  return {
    pockets: {
      visualIntent: ["Two front angled welt pockets", "One per front panel", "Topstitched outline"],
      fields: [
        f("handEntryEdge", "Hand-entry edge", { fill: `${R.FACTORY} / ${R.PATTERN}` }),
        f("openingDimensions", "Opening dimensions (P01 length, P02 welt width)", { fill: R.PATTERN }),
        f("weltConstruction", "Welt construction"),
        f("weltMaterial", "Welt material — open (X-04). Leather matching the sleeves, as drawn, is a visual reference / option only", { fill: `${R.FACTORY} / ${R.JACKETEK}` }),
        f("bagMaterial", "Pocket bag material"),
        f("bagDepth", "Pocket bag depth (P06)", { fill: R.PATTERN }),
        f("bartacks", "Bartacks / reinforcement"),
        f("interfacing", "Interfacing"),
        f("insidePocket", "Should an inside pocket be offered? (proposal only; JACKETEK decides)"),
      ],
    },
    sewing: {
      rule: "Dropped shoulder (K1) must remain compatible with every proposal.",
      fields: [
        f("seamConstruction", "Seam construction"), f("seamAllowances", "Seam allowances", { fill: R.PATTERN }), f("topstitching", "Topstitching"),
        f("stitchType", "Stitch type"), f("spi", "SPI (stitches per inch)"), f("threadType", "Thread type (cotton seams / leather seams)"),
        f("sleeveAttachment", "Sleeve attachment construction (dropped shoulder)"), f("ribAttachment", "Rib attachment (collar, cuffs, waistband)"),
        f("neckFinish", "Neck finish"), f("frontPlacket", "Front placket / facing"), f("liningAssembly", "Lining assembly"),
        f("reinforcementAreas", "Reinforcement areas"), f("leatherToCotton", "Leather-to-cotton seam treatment"), f("interlining", "Interlining where required"),
      ],
    },
  };
}

// ---------------------------------------------------------------- embroidery
export const EMBROIDERY_EVALUATE = [
  "embroidery on Cotton Fabric",
  "embroidery / patch attachment on Leather",
  "backing / stabilizer",
  "lining protection",
  "stitch density",
  "edge finish",
  "puckering risk",
  "leather perforation / damage risk",
];

export const EMBROIDERY_TESTS = [
  { id: "ET-A", zone: "leftChest", location: "Chest (left chest zone)", substrate: "Cotton Fabric body", test: "Front Letters sample: one block letter as a felt / chenille-style patch letter, attached by the method the factory proposes", artwork: "JACKETEK test geometry: plain block letter shape drawn from straight lines (no font, no licensed artwork)" },
  { id: "ET-B", zone: "mainBack", location: "Main back", substrate: "Cotton Fabric body", test: "One medium / large embroidery or patch: concentric circle + square test motif with a fill area, satin border and fine detail lines", artwork: "JACKETEK test geometry (circles, squares, lines)" },
  { id: "ET-C", zone: "leftSleeveMiddle", location: "Sleeve (left sleeve, middle zone)", substrate: "Leather sleeve", test: "One number / patch on leather: two block digits as a patch or direct embroidery, as the factory proposes", artwork: "JACKETEK test geometry: block digits \"1\" and \"2\" drawn from rectangles (no font)" },
  { id: "ET-D", zone: "backQuote", location: "Lower back text zone", substrate: "Cotton Fabric body", test: "One line of text embroidery: \"JACKETEK M SAMPLE\"", artwork: "Plain text; any block sans-serif the factory owns (no licensed artwork). Preview shown in Tajawal (SIL Open Font License)." },
].map((t) => ({
  ...t,
  goal: "Manufacturing validation, not customer styling.",
  size: { value: null, fill: R.FACTORY, note: "Representative size that fits the usable area on the sample; record the finished width × height." },
  method: { value: null, fill: R.FACTORY },
  threadAndColours: { value: null, fill: R.FACTORY },
  backingStabilizer: { value: null, fill: R.FACTORY },
  stitchDensity: { value: null, fill: R.FACTORY },
  edgeFinish: { value: null, fill: R.FACTORY },
  result: { value: null, fill: R.SAMPLE, note: "Puckering, perforation / damage, lining protection, appearance — with photos." },
  approval: { by: "JACKETEK", fill: R.JACKETEK },
}));

/** The normalised zone schedule: REFERENCE FOR PLACEMENT — NOT PHYSICAL SIZE. */
export function zoneSchedule(zones, v2) {
  const names = Object.fromEntries(v2.embroideryZones.zones.map((z) => [z.zoneId, z]));
  return {
    label: "REFERENCE FOR PLACEMENT — NOT PHYSICAL SIZE",
    rule: "Shares of garment landmarks, not measurements. No zone is converted to cm in this document; the conversion is done by JACKETEK after the M sample is measured.",
    zones: zones.map((z) => ({
      zoneId: z.id,
      name: names[z.id]?.name ?? z.name,
      panel: names[z.id]?.panel ?? null,
      substrate: z.side === "leftSleeve" || z.side === "rightSleeve" ? "Leather sleeve" : "Cotton Fabric body",
      side: z.side,
      normalised: z.normalised,
      physicalCm: null,
      physicalFill: "JACKETEK — after M sample calibration",
    })),
  };
}

export const CALIBRATION_MEASUREMENTS = [
  { id: "EC-01", group: "HPS", landmark: "HPS (left and right)", measure: "Mark both HPS points (shoulder seam meets collar seam); photograph with a ruler.", poms: [] },
  { id: "EC-02", group: "Front body", landmark: "Front HPS → waistband seam", measure: "Vertical, parallel to CF, from HPS to the top of the waistband rib (waistband seam), each side.", poms: ["B08", "R01"] },
  { id: "EC-03", group: "Back body", landmark: "Back HPS → waistband seam", measure: "Vertical, parallel to CB, from HPS to the waistband seam. Also equals B07 − R01.", poms: ["B07", "R01"] },
  { id: "EC-04", group: "Back body", landmark: "CB collar seam → waistband seam", measure: "Straight along CB.", poms: ["B06", "R01"] },
  { id: "EC-05", group: "Waistband top", landmark: "Waistband seam: body width flat", measure: "Straight along the waistband seam, side to side (flat). Same as B03 flat width.", poms: ["B03"] },
  { id: "EC-06", group: "Waistband top", landmark: "Waistband seam height at CF, side seam and CB", measure: "Distance of the waistband seam above the finished edge at CF, side and CB (shows if the seam is level).", poms: ["R01"] },
  { id: "EC-07", group: "Front body", landmark: "CF line and placket", measure: "Placket inner stitch line to CF (F01, F02); the chest zones must stay clear of the placket and snaps.", poms: ["F01", "F02", "F07"] },
  { id: "EC-08", group: "Front body", landmark: "Chest panel boundaries", measure: "At the chest-zone level: CF → armhole seam (each side); collar seam → top of pocket opening; pocket position (P03, P04).", poms: ["P03", "P04"] },
  { id: "EC-09", group: "Back body", landmark: "Back panel boundaries", measure: "Shoulder seams / armhole seams to CB at 3 levels (top, middle, above the waistband); any back seam or yoke.", poms: ["B13"] },
  { id: "EC-10", group: "Shoulder point", landmark: "Shoulder point (left and right)", measure: "Mark both shoulder points (armhole seam on the shoulder line); photograph; B09 and B10.", poms: ["B09", "B10"] },
  { id: "EC-11", group: "Cuff seam", landmark: "Shoulder point → cuff seam (sleeve unit)", measure: "S02 primary (along the overarm). The sleeve zones are shares of this length.", poms: ["S02", "S09"] },
  { id: "EC-12", group: "Sleeve", landmark: "Sleeve flat-width profile", measure: "Sleeve flat width, perpendicular to the sleeve line, every 5 cm from the shoulder point to the cuff seam.", poms: ["S04", "S05", "S06"] },
  { id: "EC-13", group: "Sleeve", landmark: "Sleeve seams and leather panels", measure: "Position of every sleeve seam (underarm seam, back-sleeve seam if any) and leather panel joins on the outer face, from the overarm fold.", poms: [] },
  { id: "EC-14", group: "Usable embroidery area", landmark: "Usable area per zone", measure: "For each zone, mark with removable tape the largest area clear of seams, placket, snaps, pockets, collar and rib (plus the factory's safety margin); measure its width × height and its position from the landmarks above; photograph with a ruler.", poms: [] },
].map((c) => ({ ...c, value: null, fill: R.SAMPLE }));

export const PHOTOS = [
  ["PH-01", "FRONT — laid flat", true],
  ["PH-02", "BACK — laid flat", true],
  ["PH-03", "LEFT SIDE / SLEEVE", true],
  ["PH-04", "RIGHT SIDE / SLEEVE", true],
  ["PH-05", "COLLAR close-up", true],
  ["PH-06", "CUFF close-up", true],
  ["PH-07", "WAISTBAND close-up", true],
  ["PH-08", "POCKET close-up", true],
  ["PH-09", "SNAP / FRONT CLOSURE close-up", true],
  ["PH-10", "INSIDE / LINING", false],
  ["PH-11", "LEATHER-TO-COTTON SEAM", true],
  ["PH-12", "EMBROIDERY TESTS (ET-A to ET-D, front and inside)", true],
  ["PH-13", "Tape on B01, B06, B09, S02 and S02-E (one photo each)", true],
  ["PH-14", "Shoulder point marked (both sides)", true],
  ["PH-15", "Usable embroidery areas taped (EC-14)", true],
].map(([id, view, ruler]) => ({ id, view, ruler, rulerText: ruler ? "Ruler / scale in view" : "Ruler where practical", fileName: null, fill: "FACTORY — with the sample" }));

export const RETURN_CHECKLIST = [
  "The physical size-M sample",
  "Measurement sheet: Pattern Proposed and Sample Actual for every row",
  "SC-1 to SC-3 (dropped shoulder) and the pattern revision",
  "Material specification sheet: body, leather, rib ×3, lining, snaps (MP-1 to MP-5)",
  "Any alternative proposal, labelled as an alternative (not design intent)",
  "Construction proposal: pockets and sewing / assembly",
  "Embroidery test results ET-A to ET-D, with the test pieces",
  "Embroidery zone calibration measurements EC-01 to EC-14",
  "Photos PH-01 to PH-15",
  "Swatches: body, leather, rib (collar / cuff / waistband), lining, snaps, pocketing, interlining",
  "Deviations from this request, and the factory's comments / recommended corrections",
];

// ---------------------------------------------------------------- drawing licence (OD-03)
/**
 * Factory sharing of the S.i.-based derived drawings. Recorded as the fact JACKETEK reported
 * (2026-10-11); the permission email itself is held by JACKETEK and is not stored or quoted here.
 */
export const DRAWING_LICENCE = {
  id: "OD-03",
  status: "RESOLVED",
  resolved: "2026-10-11",
  record: "USER-CONFIRMED WRITTEN PERMISSION FROM S.i. GRAPHICS FOR FACTORY SHARING OF DERIVED TECHNICAL DRAWINGS",
  decision: "Factory sharing of the rendered / derived S.i.-based technical drawings is permitted based on written permission obtained by JACKETEK from S.i. Graphics.",
  evidence: "Held by JACKETEK; not stored in the project.",
  pdfNote: "S.i.-based derived technical drawings: FACTORY SHARING PERMITTED BY WRITTEN LICENCE CONFIRMATION HELD BY JACKETEK. EDITABLE SOURCE TEMPLATE FILES ARE NOT INCLUDED.",
  restrictions: [
    "Do not share editable S.i. source files.",
    "Do not include the purchased AI / SVG / EPS source files.",
    "Do not redistribute the template itself.",
    "Only the derived / rendered drawings used inside JACKETEK's development package may be shared.",
  ],
};

// ---------------------------------------------------------------- open decisions
/** `when`: before the sample · with / after the factory proposals · with / after the sample. Nothing here is decided or approved. */
export const OPEN_DECISIONS = [
  { id: "OD-01", item: "Sample colourway: body, sleeves, rib stripes, snap finish, lining colour, thread colours", owner: "JACKETEK", status: "TBD", when: "Before the sample", blocksSample: true },
  { id: "OD-02", item: "Factory selection and sample quantity", owner: "JACKETEK", status: "TBD", when: "Before the sample", blocksSample: true },
  { id: "OD-04", item: "Fit-model / fit-evaluation setup (relaxed fit, sleeve length on the body)", owner: "JACKETEK + pattern maker", status: "TBD", when: "Before the sample", blocksSample: true },
  { id: "OD-05", item: "SC-1 / SC-2 / SC-3 — shoulder-point position, shoulder slope, armhole depth / sleeve cap", owner: "Pattern maker", status: "PATTERN MAKER TO SET", when: "Set by the pattern maker before / with the sample", blocksSample: true },
  { id: "OD-06", item: "JACKETEK acceptance of the factory's material proposals (MP-1 to MP-5) before final sample approval", owner: "JACKETEK", status: "TBD — after the factory proposals are received", when: "After the factory proposals", blocksSample: true },
  { id: "OD-07", item: "Welt material (X-04) and the pocket details", owner: "Factory proposes; JACKETEK decides", blocksSample: false },
  { id: "OD-08", item: "Snap count / waistband tab (X-05)", owner: "Pattern maker", blocksSample: false },
  { id: "OD-09", item: "Lining plain or quilted", owner: "JACKETEK, after the factory proposal", blocksSample: false },
  { id: "OD-10", item: "Inside pocket offered or not (X-09)", owner: "JACKETEK", blocksSample: false },
  { id: "OD-11", item: "Tolerances per POM", owner: "JACKETEK, at sample approval", blocksSample: false },
  { id: "OD-12", item: "Embroidery methods, backing and thread per test", owner: "Factory proposes", blocksSample: false },
  { id: "OD-13", item: "Physical embroidery zone sizes (K3)", owner: "JACKETEK, after calibration from the sample", blocksSample: false },
  { id: "OD-14", item: "Product / construction alignment items X-01, X-03, X-05, X-13 (website wording and options)", owner: "JACKETEK", blocksSample: false },
].map((d) => ({ status: R.TBD, when: "With / after the sample", ...d }));

export const SIGN_OFF = {
  revisions: [{ revision: REVISION, date: ISSUED, status: "ISSUED FOR SAMPLE DEVELOPMENT — not for bulk production, not production approved", note: "First development sample request, size M." }],
  factoryReceipt: ["Factory name", "Received by", "Date", "Questions / deviations noted"],
  jacketekAfterSample: ["Reviewed by (JACKETEK)", "Date", "Decision per POM / material / construction: approve · reject · correct", "Next revision (MSR-02 or Master Spec update)"],
  note: "The factory acknowledges receipt only. Approval is JACKETEK's, after the physical sample, and is recorded separately.",
};

// ---------------------------------------------------------------- the whole request
export function buildRequest(v2, zones, { masterFile, masterSha256 } = {}) {
  const sheet = measurementRows(v2);
  const k2 = v2.partiallyResolvedConflicts.find((c) => c.id === "K2");
  return {
    schema: SCHEMA,
    revision: REVISION,
    issued: ISSUED,
    title: TITLE,
    marks: MARKS,
    documentType: "Development sample request — NOT a Production Tech Pack, NOT a customer RFQ",
    size: "M",
    sources: { masterSpec: masterFile ?? null, masterSpecSha256: masterSha256 ?? null, masterRevision: v2.revision ?? null, documents: ["garment-spec/measurement-methods-v0.1.md", "garment-spec/m-sample-validation-plan.md", "garment-spec/material-construction-matrix-v0.1.md", "garment-spec/factory-material-proposal-request.md"] },
    purpose: PURPOSE,
    workflow: WORKFLOW,
    designIntent: {
      shoulder: "DROPPED SHOULDER (K1 resolved)",
      body: comp("K2.1").material.value,
      sleeves: comp("K2.2").material.value,
      sleevePolicy: LEATHER_POLICY,
      rib: "Varsity knitted rib collar, cuffs and waistband — required",
      closure: "Metal snap front closure — required",
      lining: "Lining required (plain / quilted not chosen)",
      pockets: "Two front angled welt pockets, one per front panel, topstitched outline",
      fit: "Relaxed / baggy",
      k2: k2?.status ?? null,
    },
    targets: sheet.filter((r) => r.target).map((r) => ({ id: r.id, name: r.name, ...r.target })),
    noTarget: [
      { id: "B09", name: "Across shoulder", text: "TBD — PATTERN MAKER" },
      { id: "S02", name: "Sleeve (shoulder point → cuff seam)", text: "TBD — PATTERN MAKER / MEASURE ON SAMPLE" },
    ],
    measurementSheet: sheet,
    droppedShoulder: droppedShoulder(v2),
    materials: materialProposals(),
    construction: constructionProposals(),
    embroidery: {
      evaluate: EMBROIDERY_EVALUATE,
      tests: EMBROIDERY_TESTS,
      zoneSchedule: zoneSchedule(zones, v2),
      calibration: { title: "EMBROIDERY ZONE CALIBRATION — TO COMPLETE FROM M SAMPLE", measurements: CALIBRATION_MEASUREMENTS, conversion: "Not performed. JACKETEK converts the normalised zones to cm after these measurements are returned." },
    },
    photos: PHOTOS,
    returnChecklist: RETURN_CHECKLIST,
    openDecisions: OPEN_DECISIONS,
    resolvedDecisions: [DRAWING_LICENCE],
    drawingLicence: DRAWING_LICENCE,
    alignmentItems: CONTRADICTIONS.filter((x) => OPEN_ALIGNMENT.includes(x.id)).map(({ id, topic, status }) => ({ id, topic, status })),
    varianceStatuses: Object.values(VARIANCE_STATUS),
    signOff: SIGN_OFF,
    productionApproved: false,
  };
}

/** The empty factory return form (no approval fields: approval is JACKETEK's, separately). */
export function buildReturnForm(req) {
  const empty = (o) => Object.fromEntries(o.map((k) => [k, null]));
  return {
    schema: RETURN_SCHEMA,
    request: req.revision,
    note: "Filled by the factory and returned with the sample. Contains no approval field: JACKETEK approves separately after the sample.",
    factory: { factoryName: null, contact: null, sampleDate: null, sampleId: null, patternRevision: null, measuredBy: null, measurementDate: null },
    materialCodes: empty(["bodyFabric", "leather", "ribCollar", "ribCuffs", "ribWaistband", "lining", "snaps", "thread", "pocketing", "interlining", "embroideryBacking"]),
    droppedShoulder: req.droppedShoulder.parameters.map((p) => ({ id: p.id, name: p.name, value: null, unit: "cm", comment: null })),
    measurements: req.measurementSheet.map((r) => ({ id: r.id, pomId: r.pomId, name: r.name, unit: r.sampleActual.unit, ...(r.id === "B01" ? { report: "Flat width only. The circumference (Flat Width × 2) is derived by JACKETEK — do not report it as a separate measurement." } : {}), patternProposed: null, sampleActual: null, photo: null, comment: null })),
    supplierSpecifications: req.materials.sections.map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.parts ? { parts: Object.fromEntries(s.parts.map((p) => [p, empty(s.fields.map((x) => x.key))])) } : { values: empty(s.fields.map((x) => x.key)) }),
      swatchSent: null,
      comment: null,
    })),
    alternativeProposals: [],
    alternativeProposalTemplate: { label: req.materials.alternativeProposals.label, replacesDesignIntent: false, ...empty(req.materials.alternativeProposals.fieldsPerAlternative) },
    constructionProposals: {
      pockets: empty(req.construction.pockets.fields.map((x) => x.key)),
      sewing: empty(req.construction.sewing.fields.map((x) => x.key)),
    },
    embroideryTests: req.embroidery.tests.map((t) => ({ id: t.id, zone: t.zone, method: null, finishedWidthCm: null, finishedHeightCm: null, threadAndColours: null, backingStabilizer: null, stitchDensity: null, edgeFinish: null, puckering: null, leatherDamage: null, liningProtection: null, photos: [], comment: null })),
    calibration: req.embroidery.calibration.measurements.map((c) => ({ id: c.id, landmark: c.landmark, values: null, photo: null, comment: null })),
    photos: req.photos.map((p) => ({ id: p.id, view: p.view, fileName: null })),
    deviations: [],
    comments: null,
    factoryRecommendedCorrections: [],
  };
}
