# JACKETEK Material / Construction Matrix v0.1 (K2)

**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated 2026-10-11 by `scripts/materials/material-matrix.mjs` from `scripts/materials/components.mjs` and Master Spec v0.1 (unchanged). Regenerate; do not edit by hand.

## K2 — status: **PARTIALLY RESOLVED**

Recorded 2026-10-11 · JACKETEK (product direction). v0.1 text: Kept verbatim in v0.1 `conflicts` ("The configurator offers leather or Cotton Fabric for body and sleeves…").

| Resolved (design / construction intent) | Unresolved |
|---|---|
| Body shell = Cotton Fabric (design intent) | Actual material specifications (all components) |
| Sleeves = Leather (design intent) | Compositions |
| Varsity rib components required: collar, cuffs, waistband (knitted rib, striped colourway supported, matching system) | Weights / GSM |
| Metal snap front closure required | Thicknesses (leather, rib) |
| Lining required | Hardware dimensions, alloy, plating, supplier codes |
|  | Sewing construction (seams, allowances, SPI, topstitching, reinforcement) |
|  | Pocket build details not shown by the drawing (opening edge, bag, bartacks, inside pocket) |
|  | Quilted vs plain lining |
|  | Embroidery construction per artwork type |

**Nothing in K2 is approved for production. Every specification comes from a supplier proposal and/or the pattern maker and is approved by JACKETEK only after the physical M sample.** The factory proposal covers Cotton Fabric body + Leather sleeves only (see X-01).

## Rule

No specification value invented. Body = Cotton Fabric and sleeves = Leather are design intent; every composition, weight, thickness, finish, dimension and stitch value is TBD_SUPPLIER_PROPOSAL or TBD_PATTERN_MAKER. S.i. template text is REFERENCE ONLY. Embroidery placement (zones) is not part of this matrix.

## Sleeve material policy

Design intent: **Leather**. Synthetic / PU or other options: **ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT**. A supplier may propose synthetic / PU (or other) alternatives only as clearly labelled alternative proposals. They never silently replace Leather. For each alternative record the cost, MOQ, performance and appearance differences against the leather proposal. Changing the design intent needs explicit JACKETEK approval.

## Open product / construction alignment items

X-01, X-03, X-04, X-05, X-13 stay open until product and construction are aligned (see Contradictions). Website not changed.

## Matrix

| ID | Component | Design intent | Current source | Material | Construction | Status | Final authority | Supplier input | Pattern-maker input | Sample validation | Unresolved |
|---|---|---|---|---|---|---|---|---|---|---|---|
| K2.1 | Body shell material | Cotton Fabric (DESIGN_INTENT / CUSTOMER_PRODUCT_DIRECTION) | CFG (default body material, shown "Cotton Fabric"); SITE ("Cotton fabric body"); RFQ-05 (CUSTOMER_SELECTED) | Cotton Fabric (DESIGN_INTENT / CUSTOMER_PRODUCT_DIRECTION) | — (TBD_PATTERN_MAKER) | DESIGN_INTENT — SPEC TBD_SUPPLIER_PROPOSAL | JACKETEK (intent: decided) · Supplier proposal → JACKETEK approval after M sample | composition; construction / weave; GSM; finish; shrinkage; coating (if any); colour-matching method to the 16-colour palette | shrinkage allowance in the pattern; panel seams and pressing (CON15) | hand feel, drape and bulk vs fit (v0.1 K2); colour match; embroidery on the body zones (4); shrinkage after care test | every specification field |
| K2.2 | Sleeve material | Leather (DESIGN_INTENT / CUSTOMER_PRODUCT_DIRECTION) | CFG (default sleeve material "Leather"); SITE ("Leather sleeves"); RFQ-05 (CUSTOMER_SELECTED) | Leather (DESIGN_INTENT / CUSTOMER_PRODUCT_DIRECTION) | Sleeve attachment compatible with the dropped shoulder (K1) (TBD_PATTERN_MAKER) | DESIGN_INTENT (Leather) — LEATHER SPEC TBD_SUPPLIER_PROPOSAL; alternatives are proposals only | JACKETEK (intent: decided) · Supplier proposal → JACKETEK approval after M sample | LEATHER proposal — material type, thickness, hand feel, finish, colour consistency, MOQ, price; Any synthetic / PU option as ALTERNATIVE SUPPLIER PROPOSAL (not design intent) with cost / MOQ / performance / appearance differences; backing; colour matching to the palette's leather shades | leather seams (CON05: seam type, needle, edge finish, no pins); sleeve attachment to the dropped shoulder (CON04) | hand feel and sheen; colour match; embroidery on the 6 sleeve zones; rib-cuff join; seam strength | leather type; every specification field |
| K2.3 | Lining | Lining required (body and sleeves) (REQUIRED) | V01 BOM03 / BOM04 / BOM05 (TBD); Legacy sheet (TBC) | — (TBD_SUPPLIER_PROPOSAL) | — (TBD_SUPPLIER_PROPOSAL) | REQUIRED — MATERIAL TBD_SUPPLIER_PROPOSAL | Pattern maker + supplier proposal → JACKETEK approval after M sample | fibre content; weight; colour; breathability; hand feel; compatibility with embroidery / patches; quilted or plain (with wadding if quilted) | lining construction (bagged vs other, jump hems, attachment to rib — CON12); lining relative lengths L01–L03 | fit inside the shell (L01–L03); embroidery backs covered; comfort | material; quilted vs plain; colour rule |
| K2.4 | Collar rib | Knitted varsity rib; striped colourway supported; collar / cuff / waistband matching system (CONSTRUCTION_INTENT) | RFQ ("Rib knit", SYSTEM_DERIVED; colour = customer trim colour); S.i. flat (striped rib collar); 3D preview (stripes in the sleeve colour) | Knitted rib (CONSTRUCTION_INTENT) | Collar rib attached to the shell (TBD_PATTERN_MAKER) | CONSTRUCTION_INTENT — SPEC TBD_SUPPLIER_PROPOSAL / SAMPLE VALIDATION | Pattern maker + supplier proposal → JACKETEK approval after M sample | composition; knit structure; weight; stretch / recovery; stripe construction (knitted-in), widths; gauge; colour matching to the trim and stripe colours | collar rib attachment (CON06: method, stretch control, allowance); rib heights and cut ratio (R01–R05) | stretch and recovery; stripe alignment across collar / cuffs / waistband; colour match | every specification field; stripe layout |
| K2.5 | Cuff rib | Knitted varsity rib; striped colourway supported; collar / cuff / waistband matching system (CONSTRUCTION_INTENT) | RFQ ("Rib knit", SYSTEM_DERIVED; colour = customer trim colour); S.i. flat (striped rib cuffs); 3D preview (stripes in the sleeve colour) | Knitted rib (CONSTRUCTION_INTENT) | Cuff rib attached to the shell (TBD_PATTERN_MAKER) | CONSTRUCTION_INTENT — SPEC TBD_SUPPLIER_PROPOSAL / SAMPLE VALIDATION | Pattern maker + supplier proposal → JACKETEK approval after M sample | composition; knit structure; weight; stretch / recovery; stripe construction (knitted-in), widths; gauge; colour matching to the trim and stripe colours | cuff rib attachment (CON07: method, stretch control, allowance); rib heights and cut ratio (R01–R05) | stretch and recovery; stripe alignment across collar / cuffs / waistband; colour match | every specification field; stripe layout |
| K2.6 | Waistband rib | Knitted varsity rib; striped colourway supported; collar / cuff / waistband matching system (CONSTRUCTION_INTENT) | RFQ ("Rib knit", SYSTEM_DERIVED; colour = customer trim colour); S.i. flat (striped rib waistband); 3D preview (stripes in the sleeve colour) | Knitted rib (CONSTRUCTION_INTENT) | Waistband rib attached to the shell (TBD_PATTERN_MAKER) | CONSTRUCTION_INTENT — SPEC TBD_SUPPLIER_PROPOSAL / SAMPLE VALIDATION | Pattern maker + supplier proposal → JACKETEK approval after M sample | composition; knit structure; weight; stretch / recovery; stripe construction (knitted-in), widths; gauge; colour matching to the trim and stripe colours | waistband rib attachment (CON08: method, stretch control, allowance); rib heights and cut ratio (R01–R05) | stretch and recovery; stripe alignment across collar / cuffs / waistband; colour match | every specification field; stripe layout |
| K2.7 | Front closure / snaps | Metal snap buttons, snap placket front (CONSTRUCTION_INTENT) | RFQ ("Snap front", SYSTEM_DERIVED); CFG (snap finish: black / silver / gold / gunmetal — customer); S.i. flat (snap placket + waistband tab) | Metal snap buttons (CONSTRUCTION_INTENT) | Snap placket; waistband tab shown on the flat (TBD_PATTERN_MAKER) | CONSTRUCTION_INTENT — HARDWARE TBD_SUPPLIER_PROPOSAL | Pattern maker + supplier proposal → JACKETEK approval after M sample | diameter; material / alloy; plating for the four finishes; supplier / code if available; pull strength; reinforcement behind snaps (BOM20) | snap count, positions, spacing (F03–F07); placket / facing construction and interfacing (CON09, BOM18); waistband tab | colour; finish; spacing; attachment quality (on cotton fabric); opening / closing force | every hardware field; count; tab |
| K2.8 | Pocket construction | Two front welt pockets, one per front panel, single angled welt with topstitched outline; upper end toward centre front (as drawn) (VISUAL_INTENT) | S.i. flat (layer-pockets, layer-pocket-stitch; landmarks.pockets); Legacy flat ("slanted welts"); 3D model | Pocket bag (pocketing) required by a welt pocket (TBD_SUPPLIER_PROPOSAL) | — (TBD_PATTERN_MAKER) | VISUAL_INTENT — BUILD TBD_PATTERN_MAKER | Pattern maker → JACKETEK approval after M sample | pocketing material | opening edge / direction; welt construction; bag size and attachment; bartacks (CON11) | hand entry; welt angle and position (P01–P05); bag depth and width (P06, P07) | opening edge; bag; bartacks; inside pocket |
| K2.9 | Pocket welt material | Welt material OPEN — FACTORY TO PROPOSE / JACKETEK TO APPROVE (X-04). The 3D model and drawings show the welts in the sleeve material and colour; leather matching the sleeves is a visual reference / option only. (VISUAL_INTENT) | Legacy sheet (sleeve material); RFQ / legacy drawings (welts coloured as sleeves); V01 BOM13 ("leather or shell fabric") | — (TBD_SUPPLIER_PROPOSAL) | — (TBD_PATTERN_MAKER) | OPEN (X-04) — TBD_SUPPLIER_PROPOSAL; JACKETEK approves | JACKETEK (approves the welt material) · Supplier proposal → JACKETEK approval after M sample | welt material proposal (options; leather matching the sleeves is one visual option, not decided); welt interfacing (BOM19) | opening length and welt width (P01, P02); welt build | match to sleeves; edge finish | welt material (X-04); material spec |
| K2.10 | Thread / sewing construction | Seams placeholders; sleeve attachment compatible with the dropped shoulder (K1) (TBD_PATTERN_MAKER) | V01 construction CON01–CON16 (all TO_SET_BY_PATTERN_MAKER, no values); S.i. template stitching page (REFERENCE ONLY) | — (TBD_SUPPLIER_PROPOSAL) | — (TBD_PATTERN_MAKER) | TBD_PATTERN_MAKER / TBD_SUPPLIER_PROPOSAL | Pattern maker + supplier proposal → JACKETEK approval after M sample | thread type (fabric and leather seams); SPI; seam types; reinforcement | body seam construction; sleeve attachment (dropped shoulder); rib attachment; topstitching; seam allowance; seam and neck finish | seam strength; leather-to-cotton joins; finish inside | every field |
| K2.11 | Interlining / reinforcement | If required (placket, welts, behind snaps) (TBD_SUPPLIER_PROPOSAL) | V01 BOM18–BOM20 (TBD) | — (TBD_SUPPLIER_PROPOSAL) | — (TBD_PATTERN_MAKER) | TBD_SUPPLIER_PROPOSAL (if required) | Pattern maker + supplier proposal → JACKETEK approval after M sample | interfacing type and weight per position; snap reinforcement | where interlining is needed | placket stability; snap pull-through | whether required; every field |
| K2.12 | Embroidery backing / stabiliser | As required by the embroidery method; separate for the cotton body and the leather sleeves (TBD_SUPPLIER_PROPOSAL) | V01 BOM16 / BOM17 / BOM21 (TBD); RFQ productionTechnique TBD_SUPPLIER_PROPOSAL | — (TBD_SUPPLIER_PROPOSAL) | — (TBD_PATTERN_MAKER) | TBD_SUPPLIER_PROPOSAL | Supplier proposal → JACKETEK approval after M sample | backing / stabiliser per substrate; removal method; lining protection | embroidery before / after assembly (CON13) | puckering on cotton; perforation on leather; back of embroidery against the lining | every field |

## Specification fields per component

Every field without a value is open. No value comes from S.i., Golden Bear or a drawing.

### K2.1 Body shell material

BOM: BOM01 · construction ops: CON01, CON02, CON15 · contradictions: X-01, X-02

| Field | Value | Status | Note |
|---|---|---|---|
| cottonPercentage | — | TBD_SUPPLIER_PROPOSAL |  |
| composition | — | TBD_SUPPLIER_PROPOSAL |  |
| weave | — | TBD_SUPPLIER_PROPOSAL |  |
| gsm | — | TBD_SUPPLIER_PROPOSAL |  |
| fabricWeight | — | TBD_SUPPLIER_PROPOSAL |  |
| finish | — | TBD_SUPPLIER_PROPOSAL |  |
| shrinkage | — | TBD_SUPPLIER_PROPOSAL |  |
| coating | — | TBD_SUPPLIER_PROPOSAL |  |
| colourMatching | — | TBD_SUPPLIER_PROPOSAL |  |

### K2.2 Sleeve material

BOM: BOM02 · construction ops: CON03, CON04, CON05, CON15 · contradictions: X-01, X-03

| Field | Value | Status | Note |
|---|---|---|---|
| leatherTypeOrAlternative | — | TBD_SUPPLIER_PROPOSAL | Supplier proposes the leather (type, animal, tannage). Synthetic / PU only as ALTERNATIVE SUPPLIER PROPOSAL — NOT CURRENT JACKETEK DESIGN INTENT |
| thickness | — | TBD_SUPPLIER_PROPOSAL |  |
| handFeel | — | TBD_SUPPLIER_PROPOSAL |  |
| finish | — | TBD_SUPPLIER_PROPOSAL |  |
| grain | — | TBD_SUPPLIER_PROPOSAL |  |
| backing | — | TBD_SUPPLIER_PROPOSAL |  |
| colourConsistency | — | TBD_SUPPLIER_PROPOSAL |  |
| moq | — | TBD_SUPPLIER_PROPOSAL |  |
| priceImpact | — | TBD_SUPPLIER_PROPOSAL |  |

### K2.3 Lining

BOM: BOM03, BOM04, BOM05 · construction ops: CON12 · contradictions: X-07

| Field | Value | Status | Note |
|---|---|---|---|
| fibreContent | — | TBD_SUPPLIER_PROPOSAL |  |
| weight | — | TBD_SUPPLIER_PROPOSAL |  |
| colour | — | TBD_SUPPLIER_PROPOSAL |  |
| breathability | — | TBD_SUPPLIER_PROPOSAL |  |
| handFeel | — | TBD_SUPPLIER_PROPOSAL |  |
| embroideryPatchCompatibility | — | TBD_SUPPLIER_PROPOSAL |  |
| quiltedOrPlain | — | TBD_SUPPLIER_PROPOSAL | Supplier to propose; JACKETEK decides after the sample |
| wadding | — | TBD_SUPPLIER_PROPOSAL | Only if quilted |

### K2.4 Collar rib

BOM: BOM06, BOM09 · construction ops: CON06 · contradictions: X-06

| Field | Value | Status | Note |
|---|---|---|---|
| fibreComposition | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| knitStructure | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| weight | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stretchPct | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| recoveryPct | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| finishedThickness | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stripeWidth | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stripeCountAndPosition | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| gauge | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |

### K2.5 Cuff rib

BOM: BOM07, BOM09 · construction ops: CON07 · contradictions: X-06

| Field | Value | Status | Note |
|---|---|---|---|
| fibreComposition | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| knitStructure | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| weight | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stretchPct | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| recoveryPct | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| finishedThickness | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stripeWidth | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stripeCountAndPosition | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| gauge | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |

### K2.6 Waistband rib

BOM: BOM08, BOM09 · construction ops: CON08 · contradictions: X-06

| Field | Value | Status | Note |
|---|---|---|---|
| fibreComposition | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| knitStructure | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| weight | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stretchPct | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| recoveryPct | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| finishedThickness | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stripeWidth | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| stripeCountAndPosition | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |
| gauge | — | TBD_SUPPLIER_PROPOSAL / SAMPLE_VALIDATION |  |

### K2.7 Front closure / snaps

BOM: BOM10, BOM11, BOM20 · construction ops: CON09, CON10 · contradictions: X-05, X-10

| Field | Value | Status | Note |
|---|---|---|---|
| diameter | — | TBD_SUPPLIER_PROPOSAL |  |
| alloy | — | TBD_SUPPLIER_PROPOSAL |  |
| plating | — | TBD_SUPPLIER_PROPOSAL | Must deliver the four customer finishes |
| supplierCode | — | TBD_SUPPLIER_PROPOSAL |  |
| pullStrength | — | TBD_SUPPLIER_PROPOSAL |  |
| reinforcement | — | TBD_SUPPLIER_PROPOSAL |  |
| count | — | TBD_PATTERN_MAKER |  |
| spacing | — | TBD_PATTERN_MAKER |  |
| waistbandTab | — | TBD_PATTERN_MAKER |  |

### K2.8 Pocket construction

BOM: BOM12 · construction ops: CON11 · contradictions: X-09

| Field | Value | Status | Note |
|---|---|---|---|
| pocketType | Angled single-welt pocket ×2 | VISUAL_INTENT |  |
| openingEdge | — | TBD_PATTERN_MAKER | Not shown on any drawing |
| bagMaterial | — | TBD_SUPPLIER_PROPOSAL |  |
| bagSize | — | TBD_PATTERN_MAKER |  |
| bartacks | — | TBD_PATTERN_MAKER |  |
| insidePocket | — | UNKNOWN | Fitted or not: JACKETEK decision (X-09) |

### K2.9 Pocket welt material

BOM: BOM13, BOM19 · construction ops: CON11 · contradictions: X-04

| Field | Value | Status | Note |
|---|---|---|---|
| material | — | TBD_SUPPLIER_PROPOSAL |  |
| interfacing | — | TBD_SUPPLIER_PROPOSAL |  |
| thickness | — | TBD_SUPPLIER_PROPOSAL |  |

### K2.10 Thread / sewing construction

BOM: BOM14, BOM15 · construction ops: CON01, CON02, CON03, CON04, CON05, CON06, CON07, CON08, CON12, CON15 · contradictions: X-13

Reference: S.i. stitching page and callouts (single-needle topstitch, box stitch, self-fabric bias tape) — REFERENCE ONLY, template demo

| Field | Value | Status | Note |
|---|---|---|---|
| bodySeamConstruction | — | TBD_PATTERN_MAKER |  |
| sleeveAttachment | Compatible with dropped shoulder (K1) | TBD_PATTERN_MAKER |  |
| ribAttachment | — | TBD_PATTERN_MAKER |  |
| topstitching | — | TBD_PATTERN_MAKER |  |
| seamAllowance | — | TBD_PATTERN_MAKER |  |
| seamFinish | — | TBD_PATTERN_MAKER | Website claims clean-finished seams (X-13) |
| neckFinish | — | TBD_PATTERN_MAKER |  |
| spi | — | TBD_SUPPLIER_PROPOSAL |  |
| threadType | — | TBD_SUPPLIER_PROPOSAL |  |
| reinforcement | — | TBD_SUPPLIER_PROPOSAL |  |

### K2.11 Interlining / reinforcement

BOM: BOM18, BOM19, BOM20 · construction ops: CON09, CON10

| Field | Value | Status | Note |
|---|---|---|---|
| placketInterfacing | — | TBD_SUPPLIER_PROPOSAL |  |
| weltInterfacing | — | TBD_SUPPLIER_PROPOSAL |  |
| snapReinforcement | — | TBD_SUPPLIER_PROPOSAL |  |
| fusibleOrSewn | — | TBD_SUPPLIER_PROPOSAL |  |

### K2.12 Embroidery backing / stabiliser

BOM: BOM16, BOM17, BOM21 · construction ops: CON13 · contradictions: X-08

| Field | Value | Status | Note |
|---|---|---|---|
| backingBody | — | TBD_SUPPLIER_PROPOSAL |  |
| backingLeather | — | TBD_SUPPLIER_PROPOSAL |  |
| removal | — | TBD_SUPPLIER_PROPOSAL |  |
| liningProtection | — | TBD_SUPPLIER_PROPOSAL |  |

## Embroidery construction (separate from placement)

Placement — zones, normalised scale and offset — is unchanged (Master Spec v0.1 `embroideryZones`). This section covers only how the artwork is physically made. Every field is TBD_SUPPLIER_PROPOSAL.

| Substrate | Zones |
|---|---|
| Cotton Fabric body | leftChest, rightChest, mainBack, backQuote |
| Leather sleeves | leftSleeveUpper, leftSleeveMiddle, leftSleeveLower, rightSleeveUpper, rightSleeveMiddle, rightSleeveLower |

| Artwork type | Evidence (not a specification) | embroideryMethod | backingStabiliser | threadType | stitchDensity | edgeFinish | patchAttachment | leatherSleeveCompatibility | liningProtection |
|---|---|---|---|---|---|---|---|---|---|
| TEXT — Text (customer text, font) | Configurator previews satin stitch | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| FRONT_LETTERS — Front Letters | Letter styles include "Cotton patch — black / grey" (a patch look); website shows a raised chenille letter | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| NUMBER_YEAR — Numbers / year | Library category BC | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| READY_MADE — Ready-made (back designs, class patches) | Library categories AQ / AB ("Class patches") | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| CREST — Crest | Library | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| UPLOAD — Customer upload | Uploaded artwork; digitising by supplier | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| OTHER_LIBRARY_DESIGN — Other library design | Library | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Audit — every current material / construction field

approved = no for every row.

| Field / component | Current value | Source | Customer-selected | Inferred | Supplier-defined | Approved | Contradiction |
|---|---|---|---|---|---|---|---|
| Body material | Leather or Cotton Fabric (customer choice; default Cotton Fabric, id "felt") | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) | yes | no | no | no | X-01 |
| Sleeve material | Leather or Cotton Fabric (customer choice; default Leather) | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) | yes | no | no | no | X-01 |
| Body / sleeve material (BOM01 / BOM02) | "Customer choice: leather or cotton fabric"; composition / weight / supplier null | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | yes | no | no | no | X-01 |
| Body / sleeve material on RFQ-05 | Cotton Fabric / Leather — CUSTOMER_SELECTED from the stored order | RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json) | yes | no | no | no | — |
| Material name vs internal id | Shown "Cotton Fabric"; id "felt"; code comments "wool felt"; story keys "wool" | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) | no | no | no | no | X-02 |
| Leather description | "Structured leather with a soft, natural sheen"; "Supple leather that softens with wear" | Website copy (src/locales/en/story.ts, studies.ts, hero.ts, catalog.ts) | no | no | no | no | X-03 |
| Cotton fabric description | "Dense, soft cotton fabric with a matte finish" (no composition, weave or weight) | Website copy (src/locales/en/story.ts, studies.ts, hero.ts, catalog.ts) | no | no | no | no | — |
| Colour palette | 16 colours, one shade per material (felt / leather hex); rib uses the fabric palette | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) | yes | no | no | no | — |
| Rib (collar, cuffs, waistband) | "Rib knit" — SYSTEM_DERIVED; colour = customer trim colour | RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json) | no | yes | no | no | — |
| Rib stripes | Shown in the sleeve colour (3D preview); not a customer option; count / width open | RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json) | no | yes | no | no | X-06 |
| Rib stripe yarn (BOM09) | "TBD — the configurator has no stripe option today" | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | X-06 |
| Rib heights on legacy sheet | Cuff / waistband 6.1, collar 4.1 cm from "5 rib strips" of the 3D mesh | Legacy production sheet (src/features/production/orderToProductionOrder.ts → production-drawing PDF, LEGACY) | no | yes | no | no | X-06 |
| Body lining (BOM03) | TBD (Golden Bear reference: quilted satin acetate) | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | X-07 |
| Sleeve lining (BOM04) | TBD | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Wadding / quilting (BOM05) | "whether JACKETEK is quilted is undecided" | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | X-07 |
| Lining on legacy sheet | "—" / TBC | Legacy production sheet (src/features/production/orderToProductionOrder.ts → production-drawing PDF, LEGACY) | no | no | no | no | — |
| Lining in the 3D model | Dark render material for the inside — not a lining specification | 3D model (src/three/jacket/*) — render materials only | no | yes | no | no | — |
| Front closure | Snap front — SYSTEM_DERIVED (snap placket) | RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json) | no | yes | no | no | — |
| Snap finish | Black / Silver / Gold / Gunmetal — customer choice (RFQ-05: Gold) | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) | yes | no | no | no | — |
| Snaps (BOM10) | TBD (type, size, metal) | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Snap count | Legacy sheet 7 (5 placket + 2 waistband tab); S.i. flat 6 marks (5 placket + 1 waistband); RFQ TBD_PATTERN_MAKER | Legacy production sheet (src/features/production/orderToProductionOrder.ts → production-drawing PDF, LEGACY) | no | yes | no | no | X-05 |
| Waistband closure tab | Legacy sheet "Front tabs" ×2, material TBC; S.i. flat layer "waistband-tab" | Legacy flat (production-drawing/flats/varsityFlat.mjs, LEGACY) | no | yes | no | no | X-05 |
| Zipper (BOM11) | Not fitted (ZIPPER_ENABLED = false); configurator help text still mentions "an optional hidden zipper" | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) | no | no | no | no | X-10 |
| Pocket type | Two front welt pockets, one per front panel, single angled welt with topstitch outline | S.i. canonical flat (garment-spec/working-varsity-flat/front.svg + flat.json) — drawing, not to scale | no | yes | no | no | — |
| Pocket welt material (BOM13) | "TBD (leather or shell fabric)"; RFQ: TBD_SUPPLIER_PROPOSAL | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | X-04 |
| Pocket welt material — legacy / drawings | Cut from the sleeve material (3D model); RFQ and legacy drawings colour welts as the sleeves | Legacy production sheet (src/features/production/orderToProductionOrder.ts → production-drawing PDF, LEGACY) | no | yes | no | no | X-04 |
| Pocketing (BOM12) | TBD | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Inside pocket | v0.1 L04: "whether one is fitted is undecided"; S.i. template shows an internal welt pocket | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | X-09 |
| Sewing thread (BOM14 / BOM15) | TBD (type, ticket); colour-matching rule TBD | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Seam construction (CON01–CON16) | All TO_SET_BY_PATTERN_MAKER, value null; CON04 still reads "set-in vs dropped (OPEN)" | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Seam finish claim | "clean-finished seams" (website copy) | Website copy (src/locales/en/story.ts, studies.ts, hero.ts, catalog.ts) | no | no | no | no | X-13 |
| Interfacing (BOM18 / BOM19) / snap reinforcement (BOM20) | TBD | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Embroidery technique | Configurator preview: satin only; RFQ productionTechnique TBD_SUPPLIER_PROPOSAL (direct, chenille, patch) | RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json) | no | no | no | no | X-08 |
| Embroidery methods shown on the website | "Raised chenille" study; letter styles "Cotton patch — black / grey"; library "Class patches" | Website copy (src/locales/en/story.ts, studies.ts, hero.ts, catalog.ts) | yes | no | no | no | X-08 |
| Embroidery thread (BOM16) | Colours from the 19-thread palette (customer); brand / type / weight TBD | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | yes | no | no | no | — |
| Embroidery backing (BOM17) / patch base (BOM21) | TBD (per shell material); patch base only if a patch method is adopted | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | — |
| Cuff protector (BOM22) | UNKNOWN — seen on Golden Bear; not decided | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) | no | no | no | no | X-11 |
| S.i. template material callouts | 100% Wool; 2X1 Cotton Rib 350GSM; Cotton thread; metal snap buttons; internal quilting; self-fabric bias tape; chenille patch; care label 100% cotton | S.i. template text (purchased Blank + Example PDF; demo style SW-TSH-04) — REFERENCE ONLY | no | no | no | no | X-12 |
| Golden Bear reference construction | Melton wool / leather, quilted satin-acetate lining, set-in sleeve, leather cuff protector | Golden Bear Classic (FIT_REFERENCE / EXTERNAL_REFERENCE) | no | no | no | no | X-12 |

## Contradictions

| ID | Status | Topic | Between | Detail | Handling |
|---|---|---|---|---|---|
| X-01 | OPEN — PRODUCT / CONSTRUCTION ALIGNMENT ITEM | Customer material choice vs design intent | CFG, V01, K2 design intent | The configurator lets the customer choose Leather or Cotton Fabric for the body and for the sleeves separately; v0.1 BOM01 / BOM02 and dataOwnership record a customer choice. JACKETEK design intent is body = Cotton Fabric, sleeves = Leather — the configurator's default and RFQ-05's values. | Recorded, website not changed. Product decision open: whether other combinations stay orderable. The factory proposal covers only Cotton Fabric body + Leather sleeves. |
| X-02 | RECORDED | Material name | CFG, SITE, GB, SITEXT | Shown as "Cotton Fabric", stored as id "felt"; code comments say "wool felt" and the story copy keys say "wool". Golden Bear's reference body is melton wool; the S.i. template example is 100% Wool. | "Cotton Fabric" (the customer-facing name) is the design intent. No wool or felt composition is implied. Internal id not changed. |
| X-03 | OPEN — PRODUCT / CONSTRUCTION ALIGNMENT ITEM | Leather wording | SITE, K2.2 | Website copy promises "supple leather that softens with wear" and "a soft, natural sheen" — qualities of genuine leather. K2.2 leaves genuine vs synthetic open for the supplier. | Leather stays the design intent; synthetic / PU is an alternative proposal only. If JACKETEK ever approves an alternative, the website copy must be reviewed first. Copy not changed now. |
| X-04 | OPEN — PRODUCT / CONSTRUCTION ALIGNMENT ITEM | Pocket welt material | LEG, RFQFLAT, V01, RFQ | Legacy sheet and the 3D model cut the welts from the sleeve material; RFQ and legacy drawings colour the welts as the sleeves; v0.1 BOM13 says "leather or shell fabric" and the RFQ lists it TBD_SUPPLIER_PROPOSAL. The S.i. template calls them "contrasting" (template text). | OPEN. Welt material: FACTORY TO PROPOSE / JACKETEK TO APPROVE. Leather matching the sleeves (as drawn) is a visual reference / option only, not a decision. Build TBD_PATTERN_MAKER. |
| X-05 | OPEN — PRODUCT / CONSTRUCTION ALIGNMENT ITEM | Snap count / waistband tab | LEG, SIFLAT, RFQ | Legacy sheet: 7 snaps (5 placket + 2 on the waistband tab) and 2 "front tabs". S.i. flat: 6 snap marks (5 placket + 1 on the waistband) and a waistband-tab layer. RFQ: count TBD_PATTERN_MAKER (F03–F07). | Count, spacing and the tab stay TBD_PATTERN_MAKER. Neither drawing is a specification. |
| X-06 | RECORDED | Rib stripes | V01, RFQ, LEG, SITE | v0.1 BOM09: "the configurator has no stripe option today"; the 3D preview, RFQ and legacy sheet show stripes in the sleeve colour (SYSTEM_DERIVED); the website shows a "striped rib cuff". The legacy rib heights come from 5 strips of the 3D mesh, not a stripe specification. | Striped colourway supported as construction intent; stripe count, widths, positions and yarn stay open. |
| X-07 | RECORDED | Lining: quilted or plain | V01, GB, SITEXT, M3D | Golden Bear uses quilted satin acetate; the S.i. template shows "internal quilting" (template demo); v0.1 BOM05 says quilting is undecided; the 3D model has only a dark inside render material. | No project evidence decides quilted vs plain: TBD_SUPPLIER_PROPOSAL with JACKETEK decision after the sample. |
| X-08 | RECORDED | Embroidery method | CFG, SITE, RFQ | The configurator previews satin stitch only; the website shows raised chenille, "Cotton patch" letter styles and "Class patches"; the RFQ asks the supplier to propose the technique. | Method per artwork type TBD_SUPPLIER_PROPOSAL. The website's chenille / patch imagery is product direction, not a specification. |
| X-09 | RECORDED | Inside pocket | V01, SITEXT | v0.1 L04 says whether an inside pocket is fitted is undecided; the S.i. template shows an internal welt pocket (template demo). | UNKNOWN — JACKETEK decision; if fitted, build TBD_PATTERN_MAKER. |
| X-10 | RECORDED | Hidden zipper | CFG, SITE | ZIPPER_ENABLED = false and the RFQ prints "Not fitted", but the configurator's closure help text still mentions "an optional hidden zipper". | NOT_FITTED for K2. Website text not changed. |
| X-11 | RECORDED | Cuff protector | GB, V01 | Golden Bear has a leather cuff protector; v0.1 BOM22 marks it UNKNOWN for JACKETEK. Not shown on the S.i. flat or the 3D model. | UNKNOWN — not fitted unless JACKETEK decides otherwise. |
| X-12 | RECORDED | Reference construction ≠ JACKETEK | GB, SITEXT | Golden Bear (melton wool / leather, quilted lining, set-in) and the S.i. template example (100% wool, 2×1 cotton rib 350 GSM, cotton thread) describe other garments. The S.i. callouts appear in the Blank file too: template demo content. | REFERENCE ONLY. No value imported. |
| X-13 | OPEN — PRODUCT / CONSTRUCTION ALIGNMENT ITEM | "Clean-finished seams" | SITE, V01 | Website copy claims clean-finished seams; every v0.1 construction operation is TO_SET_BY_PATTERN_MAKER with no value. | Seam finish TBD_PATTERN_MAKER; the claim must be met by the approved construction or the copy reviewed. |

## Source key

| Key | Source |
|---|---|
| V01 | Master Spec v0.1 (garment-spec/jacketek-master-spec-v0.1.json — bom, construction, conflicts K2, dataOwnership) |
| V02 | Master Spec v0.2 (measurement plan only before K2; no material fields beyond v0.1) |
| CFG | Configurator (src/features/configurator/model/catalog.ts MATERIALS / BUTTON_FINISHES / ZIPPER_ENABLED; config.ts defaults) |
| SITE | Website copy (src/locales/en/story.ts, studies.ts, hero.ts, catalog.ts) |
| RFQ | RFQ generator (src/features/techpack/build.ts; RFQ-05 manufacturing-spec.json) |
| RFQFLAT | RFQ drawings (server/rfq/flats.mjs fillsFor: welts coloured as the sleeves) |
| LEG | Legacy production sheet (src/features/production/orderToProductionOrder.ts → production-drawing PDF, LEGACY) |
| LEGFLAT | Legacy flat (production-drawing/flats/varsityFlat.mjs, LEGACY) |
| M3D | 3D model (src/three/jacket/*) — render materials only |
| SIFLAT | S.i. canonical flat (garment-spec/working-varsity-flat/front.svg + flat.json) — drawing, not to scale |
| SITEXT | S.i. template text (purchased Blank + Example PDF; demo style SW-TSH-04) — REFERENCE ONLY |
| GB | Golden Bear Classic (FIT_REFERENCE / EXTERNAL_REFERENCE) |

