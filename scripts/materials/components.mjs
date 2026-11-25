// K2 — MATERIALS AND GARMENT CONSTRUCTION: the evidence and the decision structure, as data.
// Read by scripts/materials/material-matrix.mjs (matrix, factory request, review images) and by
// scripts/measurement/source-matrix.mjs (Master Spec v0.2 `materialConstructionPlan`).
//
// Rules (JACKETEK, 2026-10-11): body = Cotton Fabric and sleeves = Leather are design intent; every
// specification (composition, weave, GSM, thickness, finish, leather type, rib knit, stretch,
// lining fibre, snap size / alloy / plating, thread, SPI, seam type, stitch density, backing) is
// left open — `null` — for the supplier or the pattern maker. Nothing here is approved. S.i.
// Graphics template text is template demo content (it appears in the Blank file too): REFERENCE
// ONLY, never imported. Placement (embroidery zones) is not touched here.

export const AUDITED = "2026-10-11";

// Field status vocabulary (in addition to the Master Spec's).
export const STATUS = {
  DESIGN_INTENT: "DESIGN_INTENT / CUSTOMER_PRODUCT_DIRECTION",
  CONSTRUCTION_INTENT: "CONSTRUCTION_INTENT",
  REQUIRED: "REQUIRED",
  VISUAL_INTENT: "VISUAL_INTENT",
  SUPPLIER: "TBD_SUPPLIER_PROPOSAL",
  PATTERN: "TBD_PATTERN_MAKER",
  SAMPLE: "SAMPLE_VALIDATION",
  SUPPLIER_SAMPLE: "TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION",
  REFERENCE: "REFERENCE_ONLY",
  UNKNOWN: "UNKNOWN",
  NOT_FITTED: "NOT_FITTED",
};
const S = STATUS;

// Where each piece of evidence lives.
export const SOURCES = {
  V01: "Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership)",
  V02: "Master Spec v0.2 (measurement plan only before K2; no material fields beyond v0.1)",
  CFG: "Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults)",
  SITE: "Website copy (src/locales/en/story.ts, studies.ts, hero.ts, catalog.ts)",
  RFQ: "RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json)",
  RFQFLAT: "RFQ drawings (server/rfq/flats.mjs fillsFor: welts coloured as the sleeves)",
  LEG: "Legacy production sheet (src/features/production/orderToProductionOrder.ts → production-drawing PDF, LEGACY)",
  LEGFLAT: "Legacy flat (production-drawing/flats/varsityFlat.mjs, LEGACY)",
  M3D: "3D model (src/three/jacket/*) — render materials only",
  SIFLAT: "S.i. canonical flat (garment-spec/working-varsity-flat/front.svg + flat.json) — drawing, not to scale",
  SITEXT: "S.i. template text (purchased Blank + Example PDF; demo style SW-TSH-04) — REFERENCE ONLY",
  GB: "Golden Bear Classic (FIT_REFERENCE / EXTERNAL_REFERENCE)",
};

// ---------------------------------------------------------------- 1. audit of every current field
// customer: customer-selected · inferred: read from a picture/model/default, not stated · supplier:
// supplier-defined · approved: always false · conflict: id in CONTRADICTIONS (or null).
export const AUDIT = [
  { field: "Body material", value: "Leather or Cotton Fabric (customer choice; default Cotton Fabric, id \"felt\")", source: "CFG", customer: true, inferred: false, supplier: false, conflict: "X-01" },
  { field: "Sleeve material", value: "Leather or Cotton Fabric (customer choice; default Leather)", source: "CFG", customer: true, inferred: false, supplier: false, conflict: "X-01" },
  { field: "Body / sleeve material (BOM01 / BOM02)", value: "\"Customer choice: leather or cotton fabric\"; composition / weight / supplier null", source: "V01", customer: true, inferred: false, supplier: false, conflict: "X-01" },
  { field: "Body / sleeve material on RFQ-05", value: "Cotton Fabric / Leather — CUSTOMER_SELECTED from the stored order", source: "RFQ", customer: true, inferred: false, supplier: false, conflict: null },
  { field: "Material name vs internal id", value: "Shown \"Cotton Fabric\"; id \"felt\"; code comments \"wool felt\"; story keys \"wool\"", source: "CFG", customer: false, inferred: false, supplier: false, conflict: "X-02" },
  { field: "Leather description", value: "\"Structured leather with a soft, natural sheen\"; \"Supple leather that softens with wear\"", source: "SITE", customer: false, inferred: false, supplier: false, conflict: "X-03" },
  { field: "Cotton fabric description", value: "\"Dense, soft cotton fabric with a matte finish\" (no composition, weave or weight)", source: "SITE", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Colour palette", value: "16 colours, one shade per material (felt / leather hex); rib uses the fabric palette", source: "CFG", customer: true, inferred: false, supplier: false, conflict: null },
  { field: "Rib (collar, cuffs, waistband)", value: "\"Rib knit\" — SYSTEM_DERIVED; colour = customer trim colour", source: "RFQ", customer: false, inferred: true, supplier: false, conflict: null },
  { field: "Rib stripes", value: "Shown in the sleeve colour (3D preview); not a customer option; count / width open", source: "RFQ", customer: false, inferred: true, supplier: false, conflict: "X-06" },
  { field: "Rib stripe yarn (BOM09)", value: "\"TBD — the configurator has no stripe option today\"", source: "V01", customer: false, inferred: false, supplier: false, conflict: "X-06" },
  { field: "Rib heights on legacy sheet", value: "Cuff / waistband 6.1, collar 4.1 cm from \"5 rib strips\" of the 3D mesh", source: "LEG", customer: false, inferred: true, supplier: false, conflict: "X-06" },
  { field: "Body lining (BOM03)", value: "TBD (Golden Bear reference: quilted satin acetate)", source: "V01", customer: false, inferred: false, supplier: false, conflict: "X-07" },
  { field: "Sleeve lining (BOM04)", value: "TBD", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Wadding / quilting (BOM05)", value: "\"whether JACKETEK is quilted is undecided\"", source: "V01", customer: false, inferred: false, supplier: false, conflict: "X-07" },
  { field: "Lining on legacy sheet", value: "\"—\" / TBC", source: "LEG", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Lining in the 3D model", value: "Dark render material for the inside — not a lining specification", source: "M3D", customer: false, inferred: true, supplier: false, conflict: null },
  { field: "Front closure", value: "Snap front — SYSTEM_DERIVED (snap placket)", source: "RFQ", customer: false, inferred: true, supplier: false, conflict: null },
  { field: "Snap finish", value: "Black / Silver / Gold / Gunmetal — customer choice (RFQ-05: Gold)", source: "CFG", customer: true, inferred: false, supplier: false, conflict: null },
  { field: "Snaps (BOM10)", value: "TBD (type, size, metal)", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Snap count", value: "Legacy sheet 7 (5 placket + 2 waistband tab); S.i. flat 6 marks (5 placket + 1 waistband); RFQ TBD_PATTERN_MAKER", source: "LEG", customer: false, inferred: true, supplier: false, conflict: "X-05" },
  { field: "Waistband closure tab", value: "Legacy sheet \"Front tabs\" ×2, material TBC; S.i. flat layer \"waistband-tab\"", source: "LEGFLAT", customer: false, inferred: true, supplier: false, conflict: "X-05" },
  { field: "Zipper (BOM11)", value: "Not fitted (ZIPPER_ENABLED = false); configurator help text still mentions \"an optional hidden zipper\"", source: "CFG", customer: false, inferred: false, supplier: false, conflict: "X-10" },
  { field: "Pocket type", value: "Two front welt pockets, one per front panel, single angled welt with topstitch outline", source: "SIFLAT", customer: false, inferred: true, supplier: false, conflict: null },
  { field: "Pocket welt material (BOM13)", value: "\"TBD (leather or shell fabric)\"; RFQ: TBD_SUPPLIER_PROPOSAL", source: "V01", customer: false, inferred: false, supplier: false, conflict: "X-04" },
  { field: "Pocket welt material — legacy / drawings", value: "Cut from the sleeve material (3D model); RFQ and legacy drawings colour welts as the sleeves", source: "LEG", customer: false, inferred: true, supplier: false, conflict: "X-04" },
  { field: "Pocketing (BOM12)", value: "TBD", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Inside pocket", value: "v0.1 L04: \"whether one is fitted is undecided\"; S.i. template shows an internal welt pocket", source: "V01", customer: false, inferred: false, supplier: false, conflict: "X-09" },
  { field: "Sewing thread (BOM14 / BOM15)", value: "TBD (type, ticket); colour-matching rule TBD", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Seam construction (CON01–CON16)", value: "All TO_SET_BY_PATTERN_MAKER, value null; CON04 still reads \"set-in vs dropped (OPEN)\"", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Seam finish claim", value: "\"clean-finished seams\" (website copy)", source: "SITE", customer: false, inferred: false, supplier: false, conflict: "X-13" },
  { field: "Interfacing (BOM18 / BOM19) / snap reinforcement (BOM20)", value: "TBD", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Embroidery technique", value: "Configurator preview: satin only; RFQ productionTechnique TBD_SUPPLIER_PROPOSAL (direct, chenille, patch)", source: "RFQ", customer: false, inferred: false, supplier: false, conflict: "X-08" },
  { field: "Embroidery methods shown on the website", value: "\"Raised chenille\" study; letter styles \"Cotton patch — black / grey\"; library \"Class patches\"", source: "SITE", customer: true, inferred: false, supplier: false, conflict: "X-08" },
  { field: "Embroidery thread (BOM16)", value: "Colours from the 19-thread palette (customer); brand / type / weight TBD", source: "V01", customer: true, inferred: false, supplier: false, conflict: null },
  { field: "Embroidery backing (BOM17) / patch base (BOM21)", value: "TBD (per shell material); patch base only if a patch method is adopted", source: "V01", customer: false, inferred: false, supplier: false, conflict: null },
  { field: "Cuff protector (BOM22)", value: "UNKNOWN — seen on Golden Bear; not decided", source: "V01", customer: false, inferred: false, supplier: false, conflict: "X-11" },
  { field: "S.i. template material callouts", value: "100% Wool; 2X1 Cotton Rib 350GSM; Cotton thread; metal snap buttons; internal quilting; self-fabric bias tape; chenille patch; care label 100% cotton", source: "SITEXT", customer: false, inferred: false, supplier: false, conflict: "X-12" },
  { field: "Golden Bear reference construction", value: "Melton wool / leather, quilted satin-acetate lining, set-in sleeve, leather cuff protector", source: "GB", customer: false, inferred: false, supplier: false, conflict: "X-12" },
];

// ---------------------------------------------------------------- contradictions found by the audit
const CONTRADICTION_LIST = [
  { id: "X-01", topic: "Customer material choice vs design intent", between: ["CFG", "V01", "K2 design intent"], detail: "The configurator lets the customer choose Leather or Cotton Fabric for the body and for the sleeves separately; v0.1 BOM01 / BOM02 and dataOwnership record a customer choice. JACKETEK design intent is body = Cotton Fabric, sleeves = Leather — the configurator's default and RFQ-05's values.", action: "Recorded, website not changed. Product decision open: whether other combinations stay orderable. The factory proposal covers only Cotton Fabric body + Leather sleeves." },
  { id: "X-02", topic: "Material name", between: ["CFG", "SITE", "GB", "SITEXT"], detail: "Shown as \"Cotton Fabric\", stored as id \"felt\"; code comments say \"wool felt\" and the story copy keys say \"wool\". Golden Bear's reference body is melton wool; the S.i. template example is 100% Wool.", action: "\"Cotton Fabric\" (the customer-facing name) is the design intent. No wool or felt composition is implied. Internal id not changed." },
  { id: "X-03", topic: "Leather wording", between: ["SITE", "K2.2"], detail: "Website copy promises \"supple leather that softens with wear\" and \"a soft, natural sheen\" — qualities of genuine leather. K2.2 leaves genuine vs synthetic open for the supplier.", action: "Leather stays the design intent; synthetic / PU is an alternative proposal only. If JACKETEK ever approves an alternative, the website copy must be reviewed first. Copy not changed now." },
  { id: "X-04", topic: "Pocket welt material", between: ["LEG", "RFQFLAT", "V01", "RFQ"], detail: "Legacy sheet and the 3D model cut the welts from the sleeve material; RFQ and legacy drawings colour the welts as the sleeves; v0.1 BOM13 says \"leather or shell fabric\" and the RFQ lists it TBD_SUPPLIER_PROPOSAL. The S.i. template calls them \"contrasting\" (template text).", action: "OPEN. Welt material: FACTORY TO PROPOSE / JACKETEK TO APPROVE. Leather matching the sleeves (as drawn) is a visual reference / option only, not a decision. Build TBD_PATTERN_MAKER." },
  { id: "X-05", topic: "Snap count / waistband tab", between: ["LEG", "SIFLAT", "RFQ"], detail: "Legacy sheet: 7 snaps (5 placket + 2 on the waistband tab) and 2 \"front tabs\". S.i. flat: 6 snap marks (5 placket + 1 on the waistband) and a waistband-tab layer. RFQ: count TBD_PATTERN_MAKER (F03–F07).", action: "Count, spacing and the tab stay TBD_PATTERN_MAKER. Neither drawing is a specification." },
  { id: "X-06", topic: "Rib stripes", between: ["V01", "RFQ", "LEG", "SITE"], detail: "v0.1 BOM09: \"the configurator has no stripe option today\"; the 3D preview, RFQ and legacy sheet show stripes in the sleeve colour (SYSTEM_DERIVED); the website shows a \"striped rib cuff\". The legacy rib heights come from 5 strips of the 3D mesh, not a stripe specification.", action: "Striped colourway supported as construction intent; stripe count, widths, positions and yarn stay open." },
  { id: "X-07", topic: "Lining: quilted or plain", between: ["V01", "GB", "SITEXT", "M3D"], detail: "Golden Bear uses quilted satin acetate; the S.i. template shows \"internal quilting\" (template demo); v0.1 BOM05 says quilting is undecided; the 3D model has only a dark inside render material.", action: "No project evidence decides quilted vs plain: TBD_SUPPLIER_PROPOSAL with JACKETEK decision after the sample." },
  { id: "X-08", topic: "Embroidery method", between: ["CFG", "SITE", "RFQ"], detail: "The configurator previews satin stitch only; the website shows raised chenille, \"Cotton patch\" letter styles and \"Class patches\"; the RFQ asks the supplier to propose the technique.", action: "Method per artwork type TBD_SUPPLIER_PROPOSAL. The website's chenille / patch imagery is product direction, not a specification." },
  { id: "X-09", topic: "Inside pocket", between: ["V01", "SITEXT"], detail: "v0.1 L04 says whether an inside pocket is fitted is undecided; the S.i. template shows an internal welt pocket (template demo).", action: "UNKNOWN — JACKETEK decision; if fitted, build TBD_PATTERN_MAKER." },
  { id: "X-10", topic: "Hidden zipper", between: ["CFG", "SITE"], detail: "ZIPPER_ENABLED = false and the RFQ prints \"Not fitted\", but the configurator's closure help text still mentions \"an optional hidden zipper\".", action: "NOT_FITTED for K2. Website text not changed." },
  { id: "X-11", topic: "Cuff protector", between: ["GB", "V01"], detail: "Golden Bear has a leather cuff protector; v0.1 BOM22 marks it UNKNOWN for JACKETEK. Not shown on the S.i. flat or the 3D model.", action: "UNKNOWN — not fitted unless JACKETEK decides otherwise." },
  { id: "X-12", topic: "Reference construction ≠ JACKETEK", between: ["GB", "SITEXT"], detail: "Golden Bear (melton wool / leather, quilted lining, set-in) and the S.i. template example (100% wool, 2×1 cotton rib 350 GSM, cotton thread) describe other garments. The S.i. callouts appear in the Blank file too: template demo content.", action: "REFERENCE ONLY. No value imported." },
  { id: "X-13", topic: "\"Clean-finished seams\"", between: ["SITE", "V01"], detail: "Website copy claims clean-finished seams; every v0.1 construction operation is TO_SET_BY_PATTERN_MAKER with no value.", action: "Seam finish TBD_PATTERN_MAKER; the claim must be met by the approved construction or the copy reviewed." },
];

// ---------------------------------------------------------------- sleeve material policy
// JACKETEK, 2026-10-11: "Leather" is the sleeve design intent and is not broadened to PU / synthetic.
export const LEATHER_POLICY = {
  designIntent: "Leather",
  alternatives: "ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT",
  rule: "A supplier may propose synthetic / PU (or other) alternatives only as clearly labelled alternative proposals. They never silently replace Leather. For each alternative record the cost, MOQ, performance and appearance differences against the leather proposal. Changing the design intent needs explicit JACKETEK approval.",
  recordForAlternatives: ["cost difference", "MOQ difference", "performance difference", "appearance difference"],
  changeRequires: "Explicit JACKETEK approval",
};

// Contradictions that stay open until product and construction are aligned (JACKETEK, 2026-10-11).
export const OPEN_ALIGNMENT = ["X-01", "X-03", "X-04", "X-05", "X-13"];
export const CONTRADICTIONS = CONTRADICTION_LIST.map((x) => ({ ...x, status: OPEN_ALIGNMENT.includes(x.id) ? "OPEN — PRODUCT / CONSTRUCTION ALIGNMENT ITEM" : "RECORDED" }));

// ---------------------------------------------------------------- K2 decision
export const K2 = {
  id: "K2",
  topic: "Materials and garment construction",
  status: "PARTIALLY_RESOLVED",
  recorded: AUDITED,
  decidedBy: "JACKETEK (product direction)",
  v01Text: "Kept verbatim in v0.1 `conflicts` (\"The configurator offers leather or Cotton Fabric for body and sleeves…\").",
  resolved: [
    "Body shell = Cotton Fabric (design intent)",
    "Sleeves = Leather (design intent)",
    "Varsity rib components required: collar, cuffs, waistband (knitted rib, striped colourway supported, matching system)",
    "Metal snap front closure required",
    "Lining required",
  ],
  unresolved: [
    "Actual material specifications (all components)",
    "Compositions",
    "Weights / GSM",
    "Thicknesses (leather, rib)",
    "Hardware dimensions, alloy, plating, supplier codes",
    "Sewing construction (seams, allowances, SPI, topstitching, reinforcement)",
    "Pocket build details not shown by the drawing (opening edge, bag, bartacks, inside pocket)",
    "Quilted vs plain lining",
    "Embroidery construction per artwork type",
  ],
  notApproved: "Nothing in K2 is approved for production. Every specification comes from a supplier proposal and/or the pattern maker and is approved by JACKETEK only after the physical M sample.",
  sampleScope: "The factory proposal covers Cotton Fabric body + Leather sleeves only (see X-01).",
};

// ---------------------------------------------------------------- components
const tbd = (status, note = null) => ({ value: null, status, ...(note ? { note } : {}) });
const AUTH_SUP = "Supplier proposal → JACKETEK approval after M sample";
const AUTH_PM = "Pattern maker → JACKETEK approval after M sample";
const AUTH_BOTH = "Pattern maker + supplier proposal → JACKETEK approval after M sample";

export const COMPONENTS = [
  {
    id: "K2.1", name: "Body shell material", bom: ["BOM01"], con: ["CON01", "CON02", "CON15"],
    designIntent: "Cotton Fabric", intentStatus: S.DESIGN_INTENT,
    currentSource: ["CFG (default body material, shown \"Cotton Fabric\")", "SITE (\"Cotton fabric body\")", "RFQ-05 (CUSTOMER_SELECTED)"],
    material: { value: "Cotton Fabric", status: S.DESIGN_INTENT },
    construction: tbd(S.PATTERN, "Panel construction and seams set by the pattern maker"),
    spec: { cottonPercentage: tbd(S.SUPPLIER), composition: tbd(S.SUPPLIER), weave: tbd(S.SUPPLIER), gsm: tbd(S.SUPPLIER), fabricWeight: tbd(S.SUPPLIER), finish: tbd(S.SUPPLIER), shrinkage: tbd(S.SUPPLIER), coating: tbd(S.SUPPLIER), colourMatching: tbd(S.SUPPLIER) },
    status: "DESIGN_INTENT — SPEC TBD_SUPPLIER_PROPOSAL",
    finalAuthority: "JACKETEK (intent: decided) · " + AUTH_SUP,
    supplierInput: ["composition", "construction / weave", "GSM", "finish", "shrinkage", "coating (if any)", "colour-matching method to the 16-colour palette"],
    patternMakerInput: ["shrinkage allowance in the pattern", "panel seams and pressing (CON15)"],
    sampleValidation: ["hand feel, drape and bulk vs fit (v0.1 K2)", "colour match", "embroidery on the body zones (4)", "shrinkage after care test"],
    unresolved: ["every specification field"],
    contradictions: ["X-01", "X-02"],
  },
  {
    id: "K2.2", name: "Sleeve material", bom: ["BOM02"], con: ["CON03", "CON04", "CON05", "CON15"],
    designIntent: "Leather", intentStatus: S.DESIGN_INTENT,
    currentSource: ["CFG (default sleeve material \"Leather\")", "SITE (\"Leather sleeves\")", "RFQ-05 (CUSTOMER_SELECTED)"],
    material: { value: "Leather", status: S.DESIGN_INTENT },
    construction: { value: "Sleeve attachment compatible with the dropped shoulder (K1)", status: S.PATTERN },
    spec: { leatherTypeOrAlternative: tbd(S.SUPPLIER, "Supplier proposes the leather (type, animal, tannage). Synthetic / PU only as ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT"), thickness: tbd(S.SUPPLIER), handFeel: tbd(S.SUPPLIER), finish: tbd(S.SUPPLIER), grain: tbd(S.SUPPLIER), backing: tbd(S.SUPPLIER), colourConsistency: tbd(S.SUPPLIER), moq: tbd(S.SUPPLIER), priceImpact: tbd(S.SUPPLIER) },
    status: "DESIGN_INTENT (Leather) — LEATHER SPEC TBD_SUPPLIER_PROPOSAL; alternatives are proposals only",
    materialPolicy: LEATHER_POLICY,
    finalAuthority: "JACKETEK (intent: decided) · " + AUTH_SUP,
    supplierInput: ["LEATHER proposal — material type, thickness, hand feel, finish, colour consistency, MOQ, price", "Any synthetic / PU option as ALTERNATIVE SUPPLIER PROPOSAL (not design intent) with cost / MOQ / performance / appearance differences", "backing", "colour matching to the palette's leather shades"],
    patternMakerInput: ["leather seams (CON05: seam type, needle, edge finish, no pins)", "sleeve attachment to the dropped shoulder (CON04)"],
    sampleValidation: ["hand feel and sheen", "colour match", "embroidery on the 6 sleeve zones", "rib-cuff join", "seam strength"],
    unresolved: ["leather type", "every specification field"],
    contradictions: ["X-01", "X-03"],
  },
  {
    id: "K2.3", name: "Lining", bom: ["BOM03", "BOM04", "BOM05"], con: ["CON12"],
    designIntent: "Lining required (body and sleeves)", intentStatus: S.REQUIRED,
    currentSource: ["V01 BOM03 / BOM04 / BOM05 (TBD)", "Legacy sheet (TBC)"],
    material: tbd(S.SUPPLIER), construction: tbd(S.SUPPLIER, "Quilted vs plain not decided by any project evidence (X-07); bagging and attachment: pattern maker (CON12)"),
    spec: { fibreContent: tbd(S.SUPPLIER), weight: tbd(S.SUPPLIER), colour: tbd(S.SUPPLIER), breathability: tbd(S.SUPPLIER), handFeel: tbd(S.SUPPLIER), embroideryPatchCompatibility: tbd(S.SUPPLIER), quiltedOrPlain: tbd(S.SUPPLIER, "Supplier to propose; JACKETEK decides after the sample"), wadding: tbd(S.SUPPLIER, "Only if quilted") },
    status: "REQUIRED — MATERIAL TBD_SUPPLIER_PROPOSAL",
    finalAuthority: AUTH_BOTH,
    supplierInput: ["fibre content", "weight", "colour", "breathability", "hand feel", "compatibility with embroidery / patches", "quilted or plain (with wadding if quilted)"],
    patternMakerInput: ["lining construction (bagged vs other, jump hems, attachment to rib — CON12)", "lining relative lengths L01–L03"],
    sampleValidation: ["fit inside the shell (L01–L03)", "embroidery backs covered", "comfort"],
    unresolved: ["material", "quilted vs plain", "colour rule"],
    contradictions: ["X-07"],
  },
  ...[["K2.4", "Collar rib", "BOM06", "CON06", "collar"], ["K2.5", "Cuff rib", "BOM07", "CON07", "cuffs"], ["K2.6", "Waistband rib", "BOM08", "CON08", "waistband"]].map(([id, name, bom, con, part]) => ({
    id, name, bom: [bom, "BOM09"], con: [con],
    designIntent: "Knitted varsity rib; striped colourway supported; collar / cuff / waistband matching system", intentStatus: S.CONSTRUCTION_INTENT,
    currentSource: [`RFQ (\"Rib knit\", SYSTEM_DERIVED; colour = customer trim colour)`, "S.i. flat (striped rib " + part + ")", "3D preview (stripes in the sleeve colour)"],
    material: { value: "Knitted rib", status: S.CONSTRUCTION_INTENT },
    construction: { value: name + " attached to the shell", status: S.PATTERN },
    spec: { fibreComposition: tbd(S.SUPPLIER_SAMPLE), knitStructure: tbd(S.SUPPLIER_SAMPLE), weight: tbd(S.SUPPLIER_SAMPLE), stretchPct: tbd(S.SUPPLIER_SAMPLE), recoveryPct: tbd(S.SUPPLIER_SAMPLE), finishedThickness: tbd(S.SUPPLIER_SAMPLE), stripeWidth: tbd(S.SUPPLIER_SAMPLE), stripeCountAndPosition: tbd(S.SUPPLIER_SAMPLE), gauge: tbd(S.SUPPLIER_SAMPLE) },
    status: "CONSTRUCTION_INTENT — SPEC TBD_SUPPLIER_PROPOSAL / SAMPLE VALIDATION",
    finalAuthority: AUTH_BOTH,
    supplierInput: ["composition", "knit structure", "weight", "stretch / recovery", "stripe construction (knitted-in), widths", "gauge", "colour matching to the trim and stripe colours"],
    patternMakerInput: [`${name.toLowerCase()} attachment (${con}: method, stretch control, allowance)`, "rib heights and cut ratio (R01–R05)"],
    sampleValidation: ["stretch and recovery", "stripe alignment across collar / cuffs / waistband", "colour match"],
    unresolved: ["every specification field", "stripe layout"],
    contradictions: ["X-06"],
  })),
  {
    id: "K2.7", name: "Front closure / snaps", bom: ["BOM10", "BOM11", "BOM20"], con: ["CON09", "CON10"],
    designIntent: "Metal snap buttons, snap placket front", intentStatus: S.CONSTRUCTION_INTENT,
    currentSource: ["RFQ (\"Snap front\", SYSTEM_DERIVED)", "CFG (snap finish: black / silver / gold / gunmetal — customer)", "S.i. flat (snap placket + waistband tab)"],
    material: { value: "Metal snap buttons", status: S.CONSTRUCTION_INTENT },
    construction: { value: "Snap placket; waistband tab shown on the flat", status: S.PATTERN, note: "Count, spacing, tab: pattern maker (X-05)" },
    spec: { diameter: tbd(S.SUPPLIER), alloy: tbd(S.SUPPLIER), plating: tbd(S.SUPPLIER, "Must deliver the four customer finishes"), supplierCode: tbd(S.SUPPLIER), pullStrength: tbd(S.SUPPLIER), reinforcement: tbd(S.SUPPLIER), count: tbd(S.PATTERN), spacing: tbd(S.PATTERN), waistbandTab: tbd(S.PATTERN) },
    status: "CONSTRUCTION_INTENT — HARDWARE TBD_SUPPLIER_PROPOSAL",
    finalAuthority: AUTH_BOTH,
    supplierInput: ["diameter", "material / alloy", "plating for the four finishes", "supplier / code if available", "pull strength", "reinforcement behind snaps (BOM20)"],
    patternMakerInput: ["snap count, positions, spacing (F03–F07)", "placket / facing construction and interfacing (CON09, BOM18)", "waistband tab"],
    sampleValidation: ["colour", "finish", "spacing", "attachment quality (on cotton fabric)", "opening / closing force"],
    unresolved: ["every hardware field", "count", "tab"],
    contradictions: ["X-05", "X-10"],
  },
  {
    id: "K2.8", name: "Pocket construction", bom: ["BOM12"], con: ["CON11"],
    designIntent: "Two front welt pockets, one per front panel, single angled welt with topstitched outline; upper end toward centre front (as drawn)", intentStatus: S.VISUAL_INTENT,
    currentSource: ["S.i. flat (layer-pockets, layer-pocket-stitch; landmarks.pockets)", "Legacy flat (\"slanted welts\")", "3D model"],
    material: { value: "Pocket bag (pocketing) required by a welt pocket", status: S.SUPPLIER },
    construction: tbd(S.PATTERN, "Hand-entry edge, welt build, bag size and attachment, bartacks not shown"),
    spec: { pocketType: { value: "Angled single-welt pocket ×2", status: S.VISUAL_INTENT }, openingEdge: tbd(S.PATTERN, "Not shown on any drawing"), bagMaterial: tbd(S.SUPPLIER), bagSize: tbd(S.PATTERN), bartacks: tbd(S.PATTERN), insidePocket: tbd(S.UNKNOWN, "Fitted or not: JACKETEK decision (X-09)") },
    status: "VISUAL_INTENT — BUILD TBD_PATTERN_MAKER",
    finalAuthority: AUTH_PM,
    supplierInput: ["pocketing material"],
    patternMakerInput: ["opening edge / direction", "welt construction", "bag size and attachment", "bartacks (CON11)"],
    sampleValidation: ["hand entry", "welt angle and position (P01–P05)", "bag depth and width (P06, P07)"],
    unresolved: ["opening edge", "bag", "bartacks", "inside pocket"],
    contradictions: ["X-09"],
  },
  {
    id: "K2.9", name: "Pocket welt material", bom: ["BOM13", "BOM19"], con: ["CON11"],
    designIntent: "Welt material OPEN — FACTORY TO PROPOSE / JACKETEK TO APPROVE (X-04). The 3D model and drawings show the welts in the sleeve material and colour; leather matching the sleeves is a visual reference / option only.", intentStatus: S.VISUAL_INTENT,
    currentSource: ["Legacy sheet (sleeve material)", "RFQ / legacy drawings (welts coloured as sleeves)", "V01 BOM13 (\"leather or shell fabric\")"],
    material: tbd(S.SUPPLIER, "FACTORY TO PROPOSE / JACKETEK TO APPROVE; leather matching the sleeves is a visual reference / option only"),
    construction: tbd(S.PATTERN),
    spec: { material: tbd(S.SUPPLIER), interfacing: tbd(S.SUPPLIER), thickness: tbd(S.SUPPLIER) },
    status: "OPEN (X-04) — TBD_SUPPLIER_PROPOSAL; JACKETEK approves",
    finalAuthority: "JACKETEK (approves the welt material) · " + AUTH_SUP,
    supplierInput: ["welt material proposal (options; leather matching the sleeves is one visual option, not decided)", "welt interfacing (BOM19)"],
    patternMakerInput: ["opening length and welt width (P01, P02)", "welt build"],
    sampleValidation: ["match to sleeves", "edge finish"],
    unresolved: ["welt material (X-04)", "material spec"],
    contradictions: ["X-04"],
  },
  {
    id: "K2.10", name: "Thread / sewing construction", bom: ["BOM14", "BOM15"], con: ["CON01", "CON02", "CON03", "CON04", "CON05", "CON06", "CON07", "CON08", "CON12", "CON15"],
    designIntent: "Seams placeholders; sleeve attachment compatible with the dropped shoulder (K1)", intentStatus: S.PATTERN,
    currentSource: ["V01 construction CON01–CON16 (all TO_SET_BY_PATTERN_MAKER, no values)", "S.i. template stitching page (REFERENCE ONLY)"],
    material: tbd(S.SUPPLIER, "Thread for fabric seams (BOM14) and leather seams (BOM15)"),
    construction: tbd(S.PATTERN),
    spec: { bodySeamConstruction: tbd(S.PATTERN), sleeveAttachment: { value: "Compatible with dropped shoulder (K1)", status: S.PATTERN }, ribAttachment: tbd(S.PATTERN), topstitching: tbd(S.PATTERN), seamAllowance: tbd(S.PATTERN), seamFinish: tbd(S.PATTERN, "Website claims clean-finished seams (X-13)"), neckFinish: tbd(S.PATTERN), spi: tbd(S.SUPPLIER), threadType: tbd(S.SUPPLIER), reinforcement: tbd(S.SUPPLIER) },
    status: "TBD_PATTERN_MAKER / TBD_SUPPLIER_PROPOSAL",
    finalAuthority: AUTH_BOTH,
    supplierInput: ["thread type (fabric and leather seams)", "SPI", "seam types", "reinforcement"],
    patternMakerInput: ["body seam construction", "sleeve attachment (dropped shoulder)", "rib attachment", "topstitching", "seam allowance", "seam and neck finish"],
    sampleValidation: ["seam strength", "leather-to-cotton joins", "finish inside"],
    unresolved: ["every field"],
    reference: "S.i. stitching page and callouts (single-needle topstitch, box stitch, self-fabric bias tape) — REFERENCE ONLY, template demo",
    contradictions: ["X-13"],
  },
  {
    id: "K2.11", name: "Interlining / reinforcement", bom: ["BOM18", "BOM19", "BOM20"], con: ["CON09", "CON10"],
    designIntent: "If required (placket, welts, behind snaps)", intentStatus: S.SUPPLIER,
    currentSource: ["V01 BOM18–BOM20 (TBD)"],
    material: tbd(S.SUPPLIER), construction: tbd(S.PATTERN),
    spec: { placketInterfacing: tbd(S.SUPPLIER), weltInterfacing: tbd(S.SUPPLIER), snapReinforcement: tbd(S.SUPPLIER), fusibleOrSewn: tbd(S.SUPPLIER) },
    status: "TBD_SUPPLIER_PROPOSAL (if required)",
    finalAuthority: AUTH_BOTH,
    supplierInput: ["interfacing type and weight per position", "snap reinforcement"],
    patternMakerInput: ["where interlining is needed"],
    sampleValidation: ["placket stability", "snap pull-through"],
    unresolved: ["whether required", "every field"],
    contradictions: [],
  },
  {
    id: "K2.12", name: "Embroidery backing / stabiliser", bom: ["BOM16", "BOM17", "BOM21"], con: ["CON13"],
    designIntent: "As required by the embroidery method; separate for the cotton body and the leather sleeves", intentStatus: S.SUPPLIER,
    currentSource: ["V01 BOM16 / BOM17 / BOM21 (TBD)", "RFQ productionTechnique TBD_SUPPLIER_PROPOSAL"],
    material: tbd(S.SUPPLIER), construction: tbd(S.PATTERN, "Embroider panels before assembly vs after (CON13)"),
    spec: { backingBody: tbd(S.SUPPLIER), backingLeather: tbd(S.SUPPLIER), removal: tbd(S.SUPPLIER), liningProtection: tbd(S.SUPPLIER) },
    status: "TBD_SUPPLIER_PROPOSAL",
    finalAuthority: AUTH_SUP,
    supplierInput: ["backing / stabiliser per substrate", "removal method", "lining protection"],
    patternMakerInput: ["embroidery before / after assembly (CON13)"],
    sampleValidation: ["puckering on cotton", "perforation on leather", "back of embroidery against the lining"],
    unresolved: ["every field"],
    contradictions: ["X-08"],
  },
];

// ---------------------------------------------------------------- embroidery construction (not placement)
// Artwork types: src/features/techpack/types.ts ARTWORK_TYPES. Placement stays in embroideryZones.
export const EMBROIDERY_FIELDS = ["embroideryMethod", "backingStabiliser", "threadType", "stitchDensity", "edgeFinish", "patchAttachment", "leatherSleeveCompatibility", "liningProtection"];
export const EMBROIDERY_TYPES = [
  { type: "TEXT", name: "Text (customer text, font)", evidence: "Configurator previews satin stitch" },
  { type: "FRONT_LETTERS", name: "Front Letters", evidence: "Letter styles include \"Cotton patch — black / grey\" (a patch look); website shows a raised chenille letter" },
  { type: "NUMBER_YEAR", name: "Numbers / year", evidence: "Library category BC" },
  { type: "READY_MADE", name: "Ready-made (back designs, class patches)", evidence: "Library categories AQ / AB (\"Class patches\")" },
  { type: "CREST", name: "Crest", evidence: "Library" },
  { type: "UPLOAD", name: "Customer upload", evidence: "Uploaded artwork; digitising by supplier" },
  { type: "OTHER_LIBRARY_DESIGN", name: "Other library design", evidence: "Library" },
].map((t) => ({ ...t, fields: Object.fromEntries(EMBROIDERY_FIELDS.map((f) => [f, tbd(S.SUPPLIER)])) }));
export const EMBROIDERY_SUBSTRATES = [
  { substrate: "Cotton Fabric body", zones: ["leftChest", "rightChest", "mainBack", "backQuote"] },
  { substrate: "Leather sleeves", zones: ["leftSleeveUpper", "leftSleeveMiddle", "leftSleeveLower", "rightSleeveUpper", "rightSleeveMiddle", "rightSleeveLower"] },
];

// ---------------------------------------------------------------- factory proposal request
export const FACTORY_REQUEST = [
  { group: "BODY FABRIC", component: "K2.1", items: ["composition", "construction / weave", "GSM", "finish", "shrinkage", "colour matching method"] },
  { group: "SLEEVE MATERIAL", component: "K2.2", items: ["leather — material type (design intent: Leather)", "alternatives (synthetic / PU) only as ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT, each with cost / MOQ / performance / appearance differences", "thickness", "finish", "backing", "hand feel", "colour matching / consistency", "minimum order quantity", "price impact"] },
  { group: "RIB", component: "K2.4–K2.6", items: ["composition", "knit structure / gauge", "weight", "stretch / recovery", "stripe construction"] },
  { group: "LINING", component: "K2.3", items: ["composition", "weight", "construction (quilted or plain; wadding if quilted)", "colour", "breathability", "hand feel", "compatibility with embroidery / patches"] },
  { group: "SNAPS", component: "K2.7", items: ["diameter", "material", "finish (black / silver / gold / gunmetal)", "supplier / code if available", "pull strength", "reinforcement"] },
  { group: "POCKETS", component: "K2.8–K2.9", items: ["pocketing material", "welt material — FACTORY TO PROPOSE / JACKETEK TO APPROVE (leather matching the sleeves is a visual reference / option only; X-04 open)", "welt interfacing"] },
  { group: "THREAD / SEWING", component: "K2.10–K2.11", items: ["thread type (fabric seams, leather seams)", "SPI", "seam type", "reinforcement", "interlining where required"] },
  { group: "EMBROIDERY", component: "K2.12", items: ["method per artwork type (direct, chenille, patch)", "thread", "backing", "stabiliser", "attachment / finishing method", "suitability on leather sleeves", "lining protection"] },
];
