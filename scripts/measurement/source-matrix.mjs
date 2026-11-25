#!/usr/bin/env node
// MEASUREMENT SOURCE MATRIX v0.1 — one generator for the measurement-strategy documents, so the
// matrix, the method definitions, the grading strategy, the sample plan, the Master Spec v0.2 and
// the review images can never disagree.
//
//   node scripts/measurement/source-matrix.mjs
//
// Reads:   garment-spec/jacketek-master-spec-v0.1.json (never changed) + scripts/measurement/sources.mjs
// Writes:  garment-spec/measurement-source-matrix-v0.1.{json,md}
//          garment-spec/measurement-methods-v0.1.md
//          garment-spec/grading-strategy-v0.1.md
//          garment-spec/m-sample-validation-plan.md
//          reports/JACKETEK Master Garment Spec Validation Draft v0.2.json
//          garment-spec/jacketek-master-spec-v0.2.json   (verbatim copy of the report JSON)
//          dev-output/measurement-source-review/  (6 PNG + measurement-source-review.json)
//
// v0.2 also carries the K2 materials / construction plan from scripts/materials/components.mjs
// (its matrix, factory request and review images: scripts/materials/material-matrix.mjs).
//
// Rules: sources are never averaged; methods that differ are never combined; S.i. drawing units
// are never converted to cm; nothing is APPROVED_PRODUCTION. The RFQ generator keeps reading v0.1.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalFlat } from "../../server/rfq/flats.mjs";
import { pomDisplay } from "../../server/rfq/techflat/pomlabels.mjs";
import { canonicalSheets } from "../../server/rfq/techflat/sheets.mjs";
import { COMPONENTS as K2_COMPONENTS, CONTRADICTIONS as K2_CONTRADICTIONS, EMBROIDERY_FIELDS, EMBROIDERY_SUBSTRATES, EMBROIDERY_TYPES, K2, LEATHER_POLICY, OPEN_ALIGNMENT, STATUS as K2_STATUS } from "../materials/components.mjs";
import { chartJson as developmentSizeChart } from "./size-system.mjs";
import { CHECKED, CONFLICTS, GOLDEN_BEAR as GB, IN, LEGACY, METHODS, PROPOSED_TARGETS_M, SET_IN_REFERENCE_M, SHOULDER_DECISION as K1, SHOULDER_IMPACT, SI, SUPPLIED as SUP, cm } from "./sources.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const V01 = "garment-spec/jacketek-master-spec-v0.1.json";
const V01_REPORT = "reports/JACKETEK Master Garment Spec Validation Draft v0.1.json";
const V02_REPORT = "reports/JACKETEK Master Garment Spec Validation Draft v0.2.json";
const V02 = "garment-spec/jacketek-master-spec-v0.2.json";
const REVIEW = "dev-output/measurement-source-review";
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const v01Buf = readFileSync(join(ROOT, V01));
if (sha(v01Buf) !== sha(readFileSync(join(ROOT, V01_REPORT)))) throw new Error("garment-spec v0.1 is no longer a verbatim copy of the report — stop");
const master = JSON.parse(v01Buf.toString("utf8"));
if (master.poms.length !== 56) throw new Error(`expected 56 POMs, found ${master.poms.length}`);
for (const p of master.poms) if (!METHODS[p.id]) throw new Error(`no method definition for ${p.id}`);
const r1 = (n) => Math.round(n * 10) / 10;
const f1 = (n) => r1(n).toFixed(1);

// ------------------------------------------------------------- check the Golden Bear record
for (const [size, row] of Object.entries(GB.rows)) {
  for (const id of ["B01", "B06", "B09", "S01"]) {
    const rec = master.referenceValues.values[id][size];
    if (rec && rec.inches !== row[id]) throw new Error(`GB ${id} ${size}: page ${row[id]} ≠ v0.1 ${rec.inches}`);
    const steps = Object.keys(GB.rows).indexOf(size) - 2;
    if (Math.abs(GB.rows.M[id] + steps * GB.gradeIn[id] - row[id]) > 1e-9) throw new Error(`GB ${id} ${size} is not on the linear grade`);
  }
}

// ------------------------------------------------------------- where S.i. shows each POM
const sheets = canonicalSheets(canonicalFlat(), pomDisplay(master));
const drawn = new Set(sheets.flatMap((s) => s.ids));
const siRowsOf = (id) => SI.specSheet.filter((r) => r.pom === id || r.also === id);

// ------------------------------------------------------------- per-POM matrix
const PLAN_STATUS = { VERIFIED_SOURCE: "VERIFIED_SOURCE", TO_MEASURE_ON_SAMPLE: "TO_MEASURE_ON_SAMPLE", TO_SET_BY_PATTERN_MAKER: "TBD_PATTERN_MAKER", DERIVED_FROM_APPROVED_SPEC: "TBD_PATTERN_MAKER" };
const SAMPLE_CLASS = { VERIFIED_SOURCE: "MEASURE ON SAMPLE", TO_MEASURE_ON_SAMPLE: "MEASURE ON SAMPLE", TO_SET_BY_PATTERN_MAKER: "PATTERN MAKER TO SET", DERIVED_FROM_APPROVED_SPEC: "CALCULATED AFTER SAMPLE" };
const AUTH = "Pattern maker + physical M sample + sample measurement + JACKETEK final approval";
const supByPom = Object.fromEntries(Object.values(SUP.valuesM).map((v) => [v.pom.replace("?", ""), v]));

const matrix = master.poms.map((p) => {
  const ref = master.referenceValues.values[p.id]?.M ?? null;
  const t = PROPOSED_TARGETS_M[p.id] ?? null;
  const meth = METHODS[p.id];
  const conflicts = CONFLICTS.filter((c) => c.poms.includes(p.id)).map((c) => c.id);

  const goldenBear = ref
    ? { available: true, value: ref.cm, unit: "cm", valueSource: { value: ref.inches, unit: "in", text: ref.inchesText }, sourceMeasurementName: GB.columns[p.id], comparable: p.id === "S01" ? "BENCHMARK ONLY — set-in; not directly transferable to the dropped shoulder" : p.id === "B09" ? "NO — set-in shoulder point; not transferable to the dropped shoulder (K1)" : "YES — this POM is defined on Golden Bear's measure", method: GB.methodStated[p.id], notes: `Published M value; re-checked ${CHECKED}. FIT_REFERENCE / EXTERNAL_REFERENCE — not a JACKETEK value.${p.id === "B09" || p.id === "S01" ? " Set-in construction: not directly transferable to JACKETEK's dropped shoulder without pattern / sample validation." : ""}` }
    : { available: false, value: null, unit: null, sourceMeasurementName: null, comparable: "N/A", notes: "Golden Bear publishes only chest, sleeve from CB, centre back and across shoulder." };

  const sv = supByPom[p.id];
  const suppliedChart = sv
    ? p.id === "S02"
      ? { available: true, verified: false, provenance: SUP.provenance, value: sv.cm, unit: "cm", sourceMeasurementName: sv.name, comparable: "NO — measurement method conflict (MC-01)", method: sv.method, notes: "Recorded for reference only. End point unknown; not entered as an S02 value. Unverified: source image currently unavailable." }
      : { available: true, verified: false, provenance: SUP.provenance, value: sv.cm, unit: "cm", sourceMeasurementName: sv.name, comparable: p.id === "B09" ? "NO — construction unknown; JACKETEK shoulder point is dropped (K1)" : "PARTIAL — same quantity, method not fully stated", method: sv.method, notes: `${sv.mapping ? `${sv.mapping}. ` : ""}${SUP.provenance.join(" · ")}. Not independently verified; adds no confidence.` }
    : { available: false, value: null, unit: null, sourceMeasurementName: null, comparable: "N/A", notes: "The supplied chart has chest, shoulder, body length and sleeve only." };

  const rows = siRowsOf(p.id);
  const siGraphics = rows.length
    ? { available: true, value: cm(rows[0].in), unit: "cm", valueSource: { value: rows[0].in, unit: "in", text: rows[0].text, tolerancePlusMinusIn: rows[0].tol }, sourceMeasurementName: rows[0].name, classification: "EXAMPLE_VALUE", comparable: "NO — template example value", notes: `S.i. spec sheet row ${rows[0].n} (Medium TARGET, demo style SW-TSH-04; identical in Blank and Example). Never imported.${rows[0].note ? ` ${rows[0].note}` : ""}` }
    : drawn.has(p.id)
      ? { available: false, value: null, unit: null, sourceMeasurementName: null, classification: "POM_LOCATION_ONLY", comparable: "N/A", notes: "Located on the licensed S.i. flat by the JACKETEK POM overlay (S.i. prints no POM arrows). Flat is in drawing units — no value." }
      : { available: false, value: null, unit: null, sourceMeasurementName: null, classification: "NOT_APPLICABLE", comparable: "N/A", notes: "Inside / pattern / lining measure; not shown on the S.i. flats." };

  let planStatus = PLAN_STATUS[p.status];
  let proposedTarget = { value: null, rangeMin: null, rangeMax: null, unit: null, status: planStatus, derivation: null, confidence: null };
  let priority, unresolvedReason;
  if (t) {
    planStatus = "PROVISIONAL_TARGET";
    proposedTarget = { value: null, valueNote: "A range, not a single value, until the sample.", rangeMin: t.rangeMin, rangeMax: t.rangeMax, unit: t.unit, quantity: t.quantity, ...(t.circumference ? { circumference: t.circumference } : {}), status: "PROVISIONAL_TARGET", derivation: t.derivation, confidence: t.confidence, confidenceReason: t.confidenceReason, sources: t.sources };
    priority = ["1. Golden Bear Classic M — fit / grade benchmark (verified)", "2. Supplied chart — target silhouette (secondary)", "S.i. example value — excluded", "Final: the approved M sample"];
    unresolvedReason = `Provisional only. ${t.sampleValidation}`;
  } else if (p.id === "B09" || p.id === "B10") {
    planStatus = "TBD_PATTERN_MAKER";
    proposedTarget = { ...proposedTarget, status: planStatus, derivation: p.id === "B09" ? SET_IN_REFERENCE_M.B09.reason : "Set by the dropped shoulder-point position (K1).", ...(p.id === "B09" ? { setInReference: SET_IN_REFERENCE_M.B09 } : {}) };
    priority = ["Pattern maker places the dropped shoulder point (K1 = DROPPED_SHOULDER)", ...(p.id === "B09" ? ["Golden Bear 49.53 cm (set-in) and supplied 50 cm — REFERENCE ONLY, not transferable"] : []), "Final: measured on the M sample"];
    unresolvedReason = "TBD_PATTERN_MAKER — dropped shoulder point set by the pattern maker; measured on the M sample.";
  } else if (p.id === "S01") {
    proposedTarget.derivation = "No JACKETEK target: only Golden Bear measures from centre back (set-in, not directly transferable to the dropped shoulder); the supplied chart measures from the shoulder seam (MC-01).";
    priority = ["Golden Bear — FIT_REFERENCE / EXTERNAL_REFERENCE only (set-in)", "No JACKETEK target", "Final: sleeve set on the fit model, then measured"];
    unresolvedReason = "MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED (MC-01, MC-02).";
  } else if (p.id === "S02") {
    proposedTarget.derivation = "No target: the supplied 51 cm has an unknown end point; Golden Bear does not publish S02 (MC-01).";
    priority = ["None — set on the fit model", "Supplied 51 cm kept as a separate, non-comparable reference", "Final: sample"];
    unresolvedReason = "MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED (MC-01, MC-02).";
  } else if (p.status === "TO_MEASURE_ON_SAMPLE") {
    priority = [rows.length ? "No reference source (S.i. value is an example)" : "No reference source", "Final: measured on the approved M sample"];
    unresolvedReason = meth.clarity === "DISTANCE_TBD" ? "TO_MEASURE_ON_SAMPLE — and the pattern maker must first fix the measuring level." : "TO_MEASURE_ON_SAMPLE — no source publishes it.";
  } else if (p.status === "TO_SET_BY_PATTERN_MAKER") {
    priority = ["No reference source", "Final: set by the pattern maker, verified on the sample"];
    unresolvedReason = "TBD_PATTERN_MAKER — construction decision.";
  } else {
    priority = ["Calculated from approved inputs + the pattern maker's rib / spacing ratio"];
    unresolvedReason = "TBD_PATTERN_MAKER — calculated once its inputs are approved (CALCULATED AFTER SAMPLE).";
  }

  return {
    pomId: p.id, name: p.name, area: p.area,
    measurementMethod: p.method,
    jacketekMethod: meth,
    currentSpec: { status: p.status, certainty: p.certainty, valueM: ref ? { value: ref.cm, unit: "cm", note: "Golden Bear reference" } : null, unit: p.unit, source: p.source?.name ?? null },
    goldenBear, suppliedChart, siGraphics,
    ...(p.id === "B01" || p.id === "B08" || p.id === "S02" ? { legacyChart: { excluded: true, file: LEGACY.file, value: p.id === "B01" ? LEGACY.valuesM.chestWidthFlat : p.id === "B08" ? LEGACY.valuesM.jacketLength : LEGACY.valuesM.sleeveLength, unit: "cm", notes: "LEGACY — excluded as a source (§ legacy chart audit)." } } : {}),
    recommendedSourcePriority: priority,
    proposedTarget,
    planStatus,
    sampleClass: p.id === "B09" || p.id === "B10" ? "PATTERN MAKER TO SET" : SAMPLE_CLASS[p.status],
    ...(SHOULDER_IMPACT[p.id] ? { shoulderConstruction: { decision: "K1 = DROPPED_SHOULDER", ...SHOULDER_IMPACT[p.id] } } : {}),
    verifyOnSample: p.id !== "S10",
    methodConflicts: conflicts,
    finalAuthority: AUTH,
    approvalState: "NOT_APPROVED",
    unresolvedReason,
  };
});

const count = (k, list = matrix) => list.reduce((a, m) => ((a[m[k]] = (a[m[k]] ?? 0) + 1), a), {});
const planCounts = count("planStatus");
const sampleCounts = count("sampleClass");
const clarityCounts = matrix.reduce((a, m) => ((a[m.jacketekMethod.clarity] = (a[m.jacketekMethod.clarity] ?? 0) + 1), a), {});
const withReference = matrix.filter((m) => m.goldenBear.available).map((m) => m.pomId);
const withTarget = matrix.filter((m) => m.planStatus === "PROVISIONAL_TARGET").map((m) => m.pomId);
const siExample = matrix.filter((m) => m.siGraphics.classification === "EXAMPLE_VALUE").map((m) => m.pomId);

// ------------------------------------------------------------- S.i. inventory (every value it holds)
const siInventory = [
  ...SI.specSheet.map((r) => ({ item: `Spec sheet row ${r.n}: ${r.name}`, value: r.text, tolerance: `±${r.tol}"`, classification: "EXAMPLE_VALUE", mapsTo: r.ambiguous ?? (r.also ? `${r.pom} / ${r.also}` : r.pom) })),
  { item: "Spec sheet tolerances (13 rows, ±⅛\"–⅜\")", value: "0.125–0.375 in", classification: "EXAMPLE_VALUE", mapsTo: "—", note: "Template sample tolerances, not a factory standard." },
  { item: "Grading page (13 POMs × XS–XXL)", value: "empty", classification: "NOT_APPLICABLE", mapsTo: "—", note: "No grading values; \"BASE PATTERN: (PROVIDE)\"." },
  { item: "Header: size range XS–XXL, sample size Medium", value: "XS/S/M/L/XL/XXL · Medium", classification: "EXAMPLE_VALUE", mapsTo: "—" },
  { item: "Hangtag 2.44 × 1.5 in, cord 5 in, grommet 6 mm", value: "trim example", classification: "EXAMPLE_VALUE", mapsTo: "— (trims, not garment POMs)" },
  { item: "Label sizes \"XX INCH\"", value: "placeholder", classification: "EXAMPLE_VALUE", mapsTo: "—" },
  { item: "Flat drawings (front / back / sleeves) and garment-spec/working-varsity-flat/flat.json landmarks", value: "vector coordinates", classification: "DRAWING_UNIT", mapsTo: "—", note: "Not to scale; never converted to cm." },
  { item: "Garment features drawn on the flats (collar, snaps, welt pockets, ribs, seams)", value: "positions only", classification: "POM_LOCATION_ONLY", mapsTo: `${[...drawn].length} POMs located by the JACKETEK overlay` },
];

// ------------------------------------------------------------- Phase 7: legacy chart audit
const legacyAudit = {
  file: LEGACY.file,
  labels: LEGACY.labels,
  rule: LEGACY.rule,
  valuesM: LEGACY.valuesM,
  stillSays: "Its \"_source\" text still reads \"Values are authoritative\"; the \"_status\" key added on 2026-10-09 marks the file LEGACY and overrides it. Values unchanged.",
  conflicts: [
    { field: "CHEST WIDTH FLAT 60 cm (underarm to underarm)", vs: "Provisional half chest 61.0–62.2 cm (B01 ÷ 2)", difference: "1.0–2.2 cm narrower; measured AT the underarm, not 1\" below" },
    { field: "JACKET LENGTH 70 cm (front, from HPS)", vs: "B06 centre-back 67.3–68.0 cm (provisional)", difference: "Different POM (front length from HPS ≈ B08) — not comparable with B06 (MC-08)" },
    { field: "SLEEVE LENGTH 62 cm (from the shoulder/sleeve attachment)", vs: "No JACKETEK sleeve target; supplied 51 cm from the shoulder seam", difference: "Third sleeve method/value; excluded" },
    { field: "Grade +3 / +2 / +1 cm per size, XS–3XL", vs: "Golden Bear +3.81 half chest / +1.27 CB length / +1.905 CB sleeve", difference: "Disagrees with Golden Bear on every dimension" },
  ],
  readers: [
    { code: "production-drawing/build/populate.mjs", via: "scripts/production-pdf.mjs ← server/index.mjs POST /api/admin/orders/:id/production-pdf", effect: "STILL ACTIVE: the admin's legacy Production Drawing PDF prints these values (badge reads \"LEGACY CHART (2026-10-02) — conflicts with Master Garment Spec v0.1; confirm before production\"). Its DERIVED POMs are scaled from this chart via data/measurements.json." },
    { code: "production-drawing/flats/varsityFlat.mjs", via: "legacy production drawing flats", effect: "Draws the legacy sheet's flat to this chart's proportions. Not used by the RFQ (test-enforced)." },
    { code: "server/index.mjs measurementsFor()", via: "admin order page", effect: "Shown as \"Measurements — legacy chart\" with the legacy source label." },
    { code: "src/features/production/orderToProductionOrder.ts", via: "CHART_SIZES / SIZE_TO_CHART", effect: "Uses only the chart's size list (XS–3XL, XXL → 2XL) for the legacy sheet." },
    { code: "scripts/techflat/measurement-review.mjs", via: "review package", effect: "Quotes the conflict only." },
  ],
  labelledLegacy: true,
  rfq05DependsOnIt: false,
  masterSpecDependsOnIt: false,
  evidence: "RFQ-05 manufacturing-spec.json contains no reference to the chart; the RFQ build reads Master Spec v0.1 only; scripts/techpack/rfq.test.mjs asserts no RFQ source file reads production-drawing/data.",
  recommendation: "Keep (not deleted in this phase). Before any order goes to a factory, retire or relabel the legacy Production Drawing PDF so it cannot be mistaken for a spec.",
};

// ------------------------------------------------------------- grading strategy data
const GRADE = [
  { dim: "Chest (B01, circumference)", pom: "B01", gbIn: 3, gbCm: cm(3), halfCm: cm(1.5), sup: null, legacy: "+3 cm half (= +6 cm circ.)", agree: "Cannot be checked — supplied grading not available; legacy chart (excluded) disagrees", proposed: "+7.62 cm circumference (+3.81 cm half) per size — Golden Bear's step, applied as an increment to the JACKETEK M sample", status: "PROVISIONAL_TARGET (grade reference)", dep: "Pattern maker confirms the grade rule on the approved M pattern; no absolute size values until then." },
  { dim: "Across shoulder (B09)", pom: "B09", gbIn: 0.75, gbCm: cm(0.75), sup: null, legacy: "—", agree: "Not applicable — Golden Bear grades a set-in shoulder", proposed: "None. Golden Bear +1.905 cm (set-in) kept as reference only", status: "TBD_PATTERN_MAKER", dep: "K1 = DROPPED_SHOULDER: the pattern maker grades the dropped shoulder point." },
  { dim: "Centre-back length (B06)", pom: "B06", gbIn: 0.5, gbCm: cm(0.5), sup: null, legacy: "+2 cm (front length, excluded)", agree: "Cannot be checked; legacy (different POM) disagrees", proposed: "+1.27 cm per size (Golden Bear)", status: "PROVISIONAL_TARGET (grade reference)", dep: "Pattern maker; start point fixed on the sample (MC-04)." },
  { dim: "Sleeve (S01 from CB / S02 from shoulder point)", pom: "S01", gbIn: 0.75, gbCm: cm(0.75), sup: null, legacy: "+1 cm (shoulder attachment, excluded)", agree: "No — methods differ (MC-01)", proposed: "None. Golden Bear +1.905 cm from CB (set-in) kept as reference only", status: "TBD_PATTERN_MAKER", dep: "Sleeve base length set on the fit model first (dropped shoulder); then the pattern maker sets the grade." },
];

// ------------------------------------------------------------- write JSON matrix
const SPEC_DIR = join(ROOT, "garment-spec");
const meta = {
  schema: "jacketek.measurementSourceMatrix", version: "0.1", generated: CHECKED,
  generator: "scripts/measurement/source-matrix.mjs (data: scripts/measurement/sources.mjs)",
  masterSpec: { file: V01, sha256: sha(v01Buf), revision: master.revision },
  status: "VALIDATION DRAFT — nothing here is production approved",
  baseSize: "M", unit: "cm (inches kept as source values; 1 in = 2.54 cm exactly)",
  principle: "Three sources with three roles, never averaged: Golden Bear = fit / grade benchmark; supplied chart = target silhouette; S.i. Graphics = drawing / POM layout / presentation. Final authority: pattern maker + physical M sample + sample measurement + JACKETEK approval.",
};
const sources = {
  goldenBear: { ...GB, rows: Object.fromEntries(Object.entries(GB.rows).map(([s, r]) => [s, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { in: v, cm: cm(v) }]))])) },
  suppliedChart: SUP,
  siGraphics: { ...SI, inventory: siInventory },
  excluded: [{ ...LEGACY, reason: "Legacy chart: conflicts with the Master Spec; different methods; see legacyChartAudit." }, ...master.decisions.excludedSources.map((s) => ({ name: s, reason: "Master Spec v0.1: not independently verifiable" }))],
};
const summary = {
  poms: matrix.length,
  defensibleNumericalReference: { count: withReference.length, poms: withReference, note: "Golden Bear M only. The supplied chart adds values for the same POMs (plus a non-comparable sleeve); S.i. holds example values only." },
  provisionalTargets: { count: withTarget.length, poms: withTarget },
  planStatus: planCounts,
  sampleClass: sampleCounts,
  methodClarity: clarityCounts,
  siExampleValuesRecorded: siExample,
};
const matrixJson = { ...meta, summary, shoulderConstruction: K1, setInReferenceM: SET_IN_REFERENCE_M, sources, conflicts: CONFLICTS, legacyChartAudit: legacyAudit, grading: GRADE, poms: matrix };
writeFileSync(join(SPEC_DIR, "measurement-source-matrix-v0.1.json"), JSON.stringify(matrixJson, null, 1) + "\n");

// ------------------------------------------------------------- markdown helpers
const mx0 = (id) => matrix.find((m) => m.pomId === id);
const mdEsc = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(mdEsc).join(" | ")} |`)].join("\n");
const val = (s) => (s.available ? `${s.valueSource ? `${s.valueSource.text ?? s.valueSource.value} = ` : ""}${s.value} ${s.unit}` : "—");
const targetText = (m) => (m.proposedTarget.rangeMin !== null ? `${f1(m.proposedTarget.rangeMin)}–${f1(m.proposedTarget.rangeMax)} cm${m.pomId === "B01" ? " (half chest)" : ""}` : "—");
const HEADER = (title) => `# ${title}\n\n**VALIDATION DRAFT — NOT PRODUCTION APPROVED.** Generated ${CHECKED} by \`scripts/measurement/source-matrix.mjs\` from Master Spec v0.1 (\`${V01}\`, unchanged) and \`scripts/measurement/sources.mjs\`. Regenerate; do not edit by hand.\n`;

// ------------------------------------------------------------- measurement-source-matrix-v0.1.md
{
  const L = [HEADER("JACKETEK Measurement Source Matrix v0.1 — size M")];
  L.push("## Principle\n", meta.principle, "", "Sources are **never averaged**. Where two sources measure the same thing the same way and agree closely, their values become the ends of a **provisional range** (Rule 1). Where methods differ, the values stay separate and the POM is marked **MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED** (Rule 2). S.i. drawing coordinates are never converted to cm (Rule 5).\n");
  L.push("## Summary\n");
  L.push(table(["", "Count", "POMs"], [
    ["POMs in Master Spec v0.1", matrix.length, "—"],
    ["Defensible numerical reference (Golden Bear, verified)", withReference.length, withReference.join(", ")],
    ["Provisional JACKETEK target (range)", withTarget.length, withTarget.join(", ")],
    ["VERIFIED_SOURCE reference, no target (method conflict)", planCounts.VERIFIED_SOURCE ?? 0, "S01"],
    ["TO_MEASURE_ON_SAMPLE", planCounts.TO_MEASURE_ON_SAMPLE ?? 0, matrix.filter((m) => m.planStatus === "TO_MEASURE_ON_SAMPLE").map((m) => m.pomId).join(", ")],
    ["TBD_PATTERN_MAKER", planCounts.TBD_PATTERN_MAKER ?? 0, matrix.filter((m) => m.planStatus === "TBD_PATTERN_MAKER").map((m) => m.pomId).join(", ")],
    ["S.i. example values recorded (never imported)", siExample.length, siExample.join(", ")],
  ]));
  L.push("\n## Sources\n");
  L.push(table(["Source", "Role", "What it supports", "Status"], [
    ["A. Golden Bear Classic Fit", GB.role.join(" · "), `M + XS–4XL: chest circumference 1" below armhole, sleeve from CB, centre back, across shoulder. Re-checked ${CHECKED}: unchanged.`, "VERIFIED_SOURCE (reference, not JACKETEK approval)"],
    ["B. Supplied chart", SUP.role.join(" · "), "M: half chest 61, across shoulder 50, body length 68, sleeve from shoulder seam 51 (cm). Original not available — values from Master Spec v0.1 §3A.", SUP.provenance.join(" · ")],
    ["C. S.i. Graphics", SI.role.join(" · "), "13 POM names + example Medium values + example tolerances; empty grading; flats in drawing units.", "EXAMPLE_VALUE / POM_LOCATION_ONLY / DRAWING_UNIT"],
    ["Legacy official_size_chart.json", "none — historical compatibility only", "60 / 70 / 62 cm M, other methods", `${LEGACY.labels.join(" · ")} — EXCLUDED`],
  ]));
  L.push(`\n> **Supplied chart — provenance limitation.** ${SUP.provenance.map((x) => `**${x}**`).join(" · ")}. ${SUP.original.note} The values may stay as one end of a provisional range, but they are **not independently verified source data** and add **no confidence**: every confidence below rests on Golden Bear alone. ${SUP.original.notToConfuse}\n`);
  L.push("### S.i. Graphics — every value in the package\n");
  L.push(table(["Item", "Value", "Classification", "Maps to"], siInventory.map((r) => [r.item, r.tolerance ? `${r.value} (tol ${r.tolerance})` : r.value, r.classification, r.mapsTo])));
  L.push(`\nFindings:\n${SI.findings.map((f) => `- ${f}`).join("\n")}\n`);
  L.push("## Size M — proposed provisional targets\n");
  L.push(table(["POM", "Quantity", "Target range", "Golden Bear", "Supplied chart", "Derivation", "Status", "Confidence", "Still needs sample validation"], withTarget.map((id) => { const t = PROPOSED_TARGETS_M[id]; const m = matrix.find((x) => x.pomId === id); return [id, t.quantity, `${f1(t.rangeMin)}–${f1(t.rangeMax)} cm${t.circumference ? ` (circumference ${f1(t.circumference.rangeMin)}–${f1(t.circumference.rangeMax)})` : ""}`, val(m.goldenBear), `${m.suppliedChart.value} cm (unverified secondary reference)`, t.derivation, "PROVISIONAL_TARGET", `${t.confidence} — ${t.confidenceReason}`, t.sampleValidation]; })));
  L.push(`\n**B09 across shoulder — no longer a target.** ${SET_IN_REFERENCE_M.B09.reason} Reference range kept: ${f1(SET_IN_REFERENCE_M.B09.rangeMin)}–${f1(SET_IN_REFERENCE_M.B09.rangeMax)} cm (${SET_IN_REFERENCE_M.B09.status}; previously ${SET_IN_REFERENCE_M.B09.previous}).\n`);
  L.push("\n**Sleeve: no JACKETEK target** (MC-01). Golden Bear 35½ in (90.17 cm) from centre back and the supplied 51 cm from the shoulder seam are different measurements.\n");
  L.push(`## Shoulder construction — K1 ${K1.status}: ${K1.decision} (${K1.decided})\n`);
  L.push(`${K1.reasons.map((r) => `- ${r}`).join("\n")}\n\n- **Shoulder point:** ${K1.shoulderPoint}\n- **Golden Bear:** ${K1.goldenBear}\n- **S.i. flat:** ${K1.siFlat}\n- ${K1.notApproved}\n`);
  L.push(table(["POM", "What changes (dropped shoulder)", "Reference still comparable?", "Plan status", "Measure on M sample"], Object.entries(SHOULDER_IMPACT).map(([id, x]) => [`${id} ${mx0(id).name}`, x.change, x.referenceComparable, x.planStatus, x.measureOnSample])));
  L.push("");
  L.push(table(["Pattern-maker parameter", "Definition", "Status"], K1.patternMakerParameters.map((x) => [`${x.id} ${x.name}`, x.definition, x.status])));
  L.push("\n## All 56 POMs\n");
  L.push(table(["POM", "Name", "Golden Bear (M)", "Supplied chart (M)", "S.i. Graphics", "Current status", "Plan status", "Proposed target", "Method", "Unresolved"], matrix.map((m) => [m.pomId, m.name, m.goldenBear.available ? `${val(m.goldenBear)} · ${m.goldenBear.comparable.split(" —")[0]}` : "—", m.suppliedChart.available ? `${m.suppliedChart.value} cm · unverified · ${m.suppliedChart.comparable.split(" —")[0]}` : "—", m.siGraphics.classification === "EXAMPLE_VALUE" ? `EXAMPLE ${m.siGraphics.valueSource.text}` : m.siGraphics.classification, m.currentSpec.status, m.planStatus, targetText(m), m.jacketekMethod.clarity, m.unresolvedReason])));
  L.push("\n## Measurement-method conflicts\n");
  L.push(table(["ID", "POMs", "Conflict", "Status", "Detail", "Result"], CONFLICTS.map((c) => [c.id, c.poms.join(", "), c.title, c.status ?? "OPEN", c.detail, c.result])));
  L.push("\n## Legacy official size chart — audit (Phase 7)\n");
  L.push(`**${LEGACY.labels.join(" · ")}.** ${LEGACY.rule}\n`);
  L.push(`\`${legacyAudit.file}\` — M ${LEGACY.valuesM.chestWidthFlat} / ${LEGACY.valuesM.jacketLength} / ${LEGACY.valuesM.sleeveLength} cm. ${legacyAudit.stillSays}\n`);
  L.push(table(["Legacy field", "Current Master Spec", "Conflict"], legacyAudit.conflicts.map((c) => [c.field, c.vs, c.difference])));
  L.push("");
  L.push(table(["Code that still reads it", "Path", "Effect"], legacyAudit.readers.map((r) => [r.code, r.via, r.effect])));
  L.push(`\n- Labelled LEGACY: **yes**. RFQ-05 depends on it: **no**. Master Spec depends on it: **no**. ${legacyAudit.evidence}`);
  L.push(`- ${legacyAudit.recommendation}\n`);
  L.push("## Final authority\n", `${AUTH}. Every entry is \`approvalState: NOT_APPROVED\`.`);
  writeFileSync(join(SPEC_DIR, "measurement-source-matrix-v0.1.md"), L.join("\n") + "\n");
}

// ------------------------------------------------------------- measurement-methods-v0.1.md
{
  const L = [HEADER("JACKETEK measurement methods v0.1")];
  L.push("How every POM is measured on the JACKETEK garment. Where a reference source is ambiguous, JACKETEK's own definition is stated here and the sample records the alternatives too, so the reference can be reconciled afterwards.\n");
  L.push("## Rules for every POM unless stated\n");
  L.push([
    "- **Garment:** finished garment, **laid flat** on a table, smoothed without stretching, snaps **closed**, back facing up for back measurements. Never measured worn.",
    "- **Seam allowance:** excluded — finished measurements only. Pattern (S10) and cut-piece (R02–R04) values are stated by the pattern maker.",
    "- **Straight vs along the curve:** straight unless the POM says *along*.",
    "- **Widths:** \"flat width × 2\" POMs (B01–B05) record the flat width AND the circumference. Sleeve widths (S04–S08) are flat widths = half circumference.",
    "- **Rib:** relaxed unless the POM says stretched (B05, S08: full extension without straining stitches).",
    "- **Lengths include the rib** to the finished edge (B06–B08, S01–S03).",
    `- **Shoulder construction:** K1 = **${K1.decision}** (${K1.decided}).`,
    `- **Shoulder point (SP):** ${K1.shoulderPoint} **HPS:** where the shoulder seam meets the collar seam.`,
    "- **Sleeve:** S01 starts at centre back; S02 at the shoulder point; S03 at the armhole point. They are three different POMs and are never interchanged.",
    "- **Units:** cm, 0.1 cm. Inches only as source values.",
    "- **Visual reference:** the POM diagrams in the RFQ (S.i. flat + JACKETEK overlay, `server/rfq/techflat/sheets.mjs`); the licensed S.i. files are not modified.",
  ].join("\n"));
  L.push(`\n## Across shoulder and sleeve on the dropped shoulder\n\n${table(["Measure", "Landmark A", "Landmark B", "Path", "Notes"], [
    ["B09 Across shoulder", METHODS.B09.a, METHODS.B09.b, "Straight, garment flat, back facing up, at the seam LINE", "Also record the contour along the back. Value set by the pattern maker's shoulder point; Golden Bear's set-in 19½\" does not transfer."],
    ["S02 Sleeve — shoulder point → cuff seam (JACKETEK primary)", METHODS.S02.a, "Cuff seam (where the rib is attached); rib excluded", "Along the overarm, sleeve laid straight", "The sleeve-zone unit (S02 − S09 in the zone ratios). Also record S02-E to the finished cuff edge (secondary): edge ≈ seam + S09."],
    ["S01 Sleeve — centre back → cuff seam (comparison only); S01-E → finished cuff edge", METHODS.S01.a, "Cuff seam (S01); finished cuff edge (S01-E)", "Along the shoulder line to the dropped shoulder point, then down the overarm", "COMPARISON ONLY, never a target. Kept to compare with Golden Bear's \"from center back\" (set-in; end point assumed cuff edge). Record S01 (→ cuff seam) and S01-E (→ finished cuff edge) separately."],
  ])}\n\nS01 and S02 are two different measurements: S01 starts at centre back and crosses the shoulder; S02 starts at the dropped shoulder point. They are never interchanged, combined or converted into each other.\n`);
  L.push(`\n## Clarity\n\n${table(["Clarity", "Count", "Meaning"], [["CLEAR", clarityCounts.CLEAR ?? 0, "One unambiguous method."], ["SOURCE_AMBIGUOUS", clarityCounts.SOURCE_AMBIGUOUS ?? 0, "JACKETEK's method is defined; the reference source does not state its own — sample records the alternatives."], ["CONFLICT", clarityCounts.CONFLICT ?? 0, "Two sources measure differently — never combined."], ["DISTANCE_TBD", clarityCounts.DISTANCE_TBD ?? 0, "A measuring level the pattern maker must fix before the sample."], ["PATTERN_DEPENDENT", clarityCounts.PATTERN_DEPENDENT ?? 0, "Method clear; the landmark (dropped shoulder point) is placed by the pattern maker."], ["NOT_ON_GARMENT", clarityCounts.NOT_ON_GARMENT ?? 0, "Pattern / cut piece / count / calculation."]])}\n`);
  for (const area of [...new Set(master.poms.map((p) => p.area))]) {
    L.push(`## ${area}\n`);
    L.push(table(["POM", "Name", "Landmark A", "Landmark B", "Laid", "Path", "Extent", "Rib", "Rib state", "Sleeve ref.", "Clarity", "Resolution / note"], master.poms.filter((p) => p.area === area).map((p) => { const m = METHODS[p.id]; return [p.id, p.name, m.a, m.b, p.condition, m.path, m.extent, m.rib, m.ribState, m.sleeveRef, m.clarity, m.resolution || "—"]; })));
    L.push("");
  }
  L.push("## Method conflicts\n");
  L.push(table(["ID", "POMs", "Conflict", "Result"], CONFLICTS.map((c) => [c.id, c.poms.join(", "), c.title, c.result])));
  writeFileSync(join(SPEC_DIR, "measurement-methods-v0.1.md"), L.join("\n") + "\n");
}

// ------------------------------------------------------------- grading-strategy-v0.1.md
{
  const L = [HEADER("JACKETEK grading strategy v0.1")];
  L.push("**The M sample stays the anchor size.** No full production size chart is created in this phase. Golden Bear's published steps are a grade **reference**: once the JACKETEK M is approved, they are applied as increments to the approved M, never as Golden Bear's absolute values.\n");
  L.push("## Core dimensions\n");
  L.push(table(["Dimension", "Golden Bear step / size", "Supplied chart step", "Legacy chart step (excluded)", "Agree?", "Proposed provisional JACKETEK grade", "Status", "Dependency"], GRADE.map((g) => [g.dim, `+${g.gbIn} in = +${g.gbCm} cm${g.halfCm ? ` (half: +${g.halfCm})` : ""}`, "Not available (source image unavailable)", g.legacy, g.agree, g.proposed, g.status, g.dep])));
  L.push(`\nGolden Bear steps are read from its published rows (no grade rule is printed); the rows are exactly linear XS–4XL (checked by the generator, page re-read ${CHECKED}).\n`);
  L.push("## Golden Bear Classic rows (reference, cm)\n");
  L.push(table(["Size", "Chest circ. (B01)", "Half chest", "Across shoulder (B09)", "Centre back (B06)", "Sleeve from CB (S01)"], Object.entries(GB.rows).map(([s, r]) => [s, cm(r.B01), r1(cm(r.B01) / 2), cm(r.B09), cm(r.B06), cm(r.S01)])));
  L.push("\n## Every other POM\n");
  L.push("No source publishes a grade for any other POM. All remaining grade rules are **TBD_PATTERN_MAKER**, set on the approved M pattern. Fixed-by-design candidates (rib heights R01 / S09, collar heights C01 / C02, placket F01, welt width P02, snap-to-edge F07) are typically not graded — the pattern maker confirms.\n");
  L.push("## Size range\n");
  L.push("Master Spec sizes: XS–XXL (base M). Golden Bear publishes XS–4XL; the legacy chart XS–3XL; S.i.'s header XS–XXL (example). The JACKETEK range beyond XXL is not decided here.\n");
  L.push("## Why the supplied chart's grading is not used\n");
  L.push(`${SUP.gradingNote} If the original chart is found, its steps can be added here and compared — but they are only adopted where they agree with Golden Bear; otherwise TBD_PATTERN_MAKER (no averaging).`);
  writeFileSync(join(SPEC_DIR, "grading-strategy-v0.1.md"), L.join("\n") + "\n");
}

// ------------------------------------------------------------- m-sample-validation-plan.md
{
  const L = [HEADER("JACKETEK M sample — validation plan")];
  L.push("What happens when the first physical M sample arrives. The sample is the first JACKETEK measurement; everything before it is reference, provisional, derived or TBD.\n");
  L.push("## Before the sample is made\n");
  L.push([
    `1. **K1 is decided: ${K1.decision}** (${K1.decided}). The pattern maker must provide / confirm: the actual shoulder drop and shoulder-point position (${K1.patternMakerParameters.map((x) => x.id).join(", ")}), and mark the shoulder point on the sample.`,
    "2. **Pattern maker proposes** every TBD_PATTERN_MAKER item (list below) and the measuring levels for B02, B12, B13, S05.",
    "3. **Pattern maker receives** `measurement-methods-v0.1.md` and builds to the provisional ranges (B01 **Half Chest — Flat Width** 61.0–62.2 cm — the circumference is derived as flat width × 2, not a separately measured POM; B06 67.3–68.0 cm). Across shoulder has no target: it follows from the dropped shoulder point the pattern maker sets. The **sleeve length is set on the fit model**, not taken from any chart.",
  ].join("\n"));
  L.push("\n## When the sample arrives\n");
  L.push([
    "1. Factory / pattern maker has proposed the missing construction dimensions (TBD_PATTERN_MAKER).",
    "2. The M sample is produced.",
    "3. **Every required POM is measured** (MEASURE ON SAMPLE below), flat, by the written method, with a photo of the tape on each core POM. Ambiguous POMs record every alternative (B01 at 1\" below AND at the armhole; B06 from the collar seam AND the top of the collar, plus B07; B09 straight AND contour; S01 = centre back → cuff seam AND S01-E = centre back → finished cuff edge, recorded separately as comparison measurements; S02 = shoulder point → cuff seam (primary) AND S02-E = shoulder point → finished cuff edge (secondary)).",
    "4. **Actual vs target** is compared for B01, B06 (provisional ranges); B09 and the sleeve against the pattern maker's stated values; Golden Bear (set-in) only as a benchmark for B09 / S01.",
    "5. **Variance** = actual − nearest range end (0 inside the range), in cm and %; S.i.'s example tolerances are not used — JACKETEK tolerances are set at approval.",
    "6. **JACKETEK approves / rejects / requests an adjustment** per POM, with the fit-on-body review (bagginess, sleeve on the fit model).",
    "7. **Master Spec is revised** (new version, approved values marked by approval, old provenance kept).",
    "8. **Only then** can a Production Tech Pack v1.0 be created, and grading applied from the approved M.",
  ].join("\n"));
  L.push(`\n## Classification of all 56 POMs\n\n${table(["Class", "Count", "Meaning"], [["MEASURE ON SAMPLE", sampleCounts["MEASURE ON SAMPLE"] ?? 0, "Measured on the sample; compared with the provisional target where one exists."], ["PATTERN MAKER TO SET", sampleCounts["PATTERN MAKER TO SET"] ?? 0, "Set by the pattern maker; verified on the sample where it can be measured."], ["CALCULATED AFTER SAMPLE", sampleCounts["CALCULATED AFTER SAMPLE"] ?? 0, "Computed from approved values + a ratio the pattern maker sets."], ["REFERENCE ONLY", sampleCounts["REFERENCE ONLY"] ?? 0, "None — S01 is a reference but is also measured on the sample."], ["NOT REQUIRED", sampleCounts["NOT REQUIRED"] ?? 0, "None (L04 applies only if an inside pocket is fitted)."]])}\n`);
  L.push(table(["POM", "Name", "Class", "Compare with", "Record", "Verify on sample"], matrix.map((m) => [m.pomId, m.name, m.sampleClass, m.proposedTarget.rangeMin !== null ? `Provisional ${targetText(m)}` : m.pomId === "S01" ? "Comparison only — no JACKETEK target (S01 → cuff seam, S01-E → finished cuff edge); Golden Bear 90.17 cm set-in benchmark only" : m.pomId === "B09" ? "Pattern maker's value; GB 49.53 set-in reference only" : m.pomId === "S02" || m.pomId === "B10" ? "Pattern maker's value" : "—", m.jacketekMethod.clarity === "SOURCE_AMBIGUOUS" || m.jacketekMethod.clarity === "CONFLICT" ? "All alternative methods (see methods doc)" : m.jacketekMethod.clarity === "DISTANCE_TBD" ? "At the level the pattern maker fixed" : "As defined", m.verifyOnSample ? "yes" : "no (pattern)"])));
  L.push(`\n## Shoulder and sleeve — the pattern maker provides / confirms (K1 = ${K1.decision})\n`);
  L.push(table(["Item", "Provided by the pattern maker", "Measured on the M sample"], [
    ["Actual shoulder drop (SC-1 drop extension, SC-2 / B11 slope)", "Yes — stated on the pattern", "B11; shoulder point marked and photographed"],
    ["Actual shoulder point", "Yes — marked on the pattern and the sample", "Yes — photo"],
    ["Across shoulder (B09)", "Intended value", "Straight at the seam line AND contour"],
    ["S02 Sleeve — shoulder point → cuff seam (PRIMARY)", "Intended value, set on the fit model", "Yes — no target; compared with the pattern maker's value"],
    ["S02-E Sleeve — shoulder point → finished cuff edge (SECONDARY)", "—", "Yes — recorded separately (≈ S02 + S09)"],
    ["S01 Sleeve — centre back → cuff seam (COMPARISON ONLY)", "—", "Yes — reference only, not a JACKETEK sleeve target; Golden Bear (set-in) benchmark only"],
    ["S01-E Sleeve — centre back → finished cuff edge (COMPARISON ONLY)", "—", "Yes — reference only, not a JACKETEK sleeve target"],
    ["Armhole depth / sleeve cap (B14, S10)", "Yes (SC-3)", "B14 yes; S10 pattern only"],
  ]));
  L.push("\nNothing here is production approved.");
  L.push("\n## Sample record per POM\n");
  L.push("`pomId · method used · value (cm, 0.1) · photo · measured by · date · target / range · variance · decision (approve / reject / adjust) · note`");
  writeFileSync(join(SPEC_DIR, "m-sample-validation-plan.md"), L.join("\n") + "\n");
}

// ------------------------------------------------------------- Master Spec v0.2 (new file; v0.1 untouched)
let v2Checks = null;
{
  const v2 = structuredClone(master);
  v2.title = "JACKETEK Master Garment Spec — Validation Draft v0.2";
  v2.date = CHECKED;
  v2.revision = "v0.2 — measurement source matrix: per-POM source evidence, provisional M targets per POM, method definitions, sample plan; K2 materials / construction plan, PARTIALLY RESOLVED (no value approved; v0.1 statuses and provenance kept)";
  v2.supersedes = { file: V01, sha256: sha(v01Buf), revision: master.revision };
  v2.documentStatus = "VALIDATION_DRAFT";
  v2.productionApproved = false;
  v2.vocabulary.planStatus = ["VERIFIED_SOURCE", "DERIVED_FROM_VERIFIED_SOURCE", "SECONDARY_VISUAL_REFERENCE", "PROVISIONAL_TARGET", "TO_MEASURE_ON_SAMPLE", "TBD_PATTERN_MAKER", "TBD_SUPPLIER_PROPOSAL", "UNKNOWN"];
  v2.vocabulary.sampleClass = ["MEASURE ON SAMPLE", "PATTERN MAKER TO SET", "REFERENCE ONLY", "CALCULATED AFTER SAMPLE", "NOT REQUIRED"];
  v2.vocabulary.siClassification = ["PHYSICAL_MEASUREMENT", "EXAMPLE_VALUE", "DRAWING_UNIT", "POM_LOCATION_ONLY", "NOT_APPLICABLE"];
  const gbSrc = v2.sources.find((s) => s.id === "GB");
  gbSrc.reverified = CHECKED;
  gbSrc.reverifiedResult = GB.reverifiedResult;
  gbSrc.notes = GB.notes;
  const sigSrc = v2.sources.find((s) => s.id === "SIG");
  sigSrc.purchasedPackage = SI.folder;
  sigSrc.valueClassification = "Spec-sheet values and tolerances = EXAMPLE_VALUE (demo style, identical in Blank and Example); grading page empty; flats = DRAWING_UNIT. No PHYSICAL_MEASUREMENT.";
  v2.sources.push({ id: "SUP", name: SUP.name, classification: SUP.classification, provenance: SUP.provenance, verified: false, record: SUP.record, original: SUP.original.note, confidencePolicy: SUP.confidencePolicy, use: "Target silhouette (M only); one end of the provisional ranges for B01 / B06 / B09" });
  v2.sources.push({ id: "LEGACY", name: "production-drawing/data/official_size_chart.json (2026-10-02)", classification: "EXCLUDED", labels: LEGACY.labels, rule: LEGACY.rule, use: "None — conflicts with this spec (see legacySizeChart)" });
  // v0.1's own §3A record is kept verbatim; the limitation is recorded beside it.
  v2.secondaryVisualReferenceLimitation = { flags: SUP.provenance, verified: false, note: SUP.original.note, confidencePolicy: SUP.confidencePolicy, v01TextKept: "v0.1 §3A and sampleStrategy statements that the visual chart \"confirms\" Golden Bear are kept as historical text; under v0.2 they are not evidence and raise no confidence." };
  for (const p of v2.poms) {
    const m = matrix.find((x) => x.pomId === p.id);
    p.measurementPlan = {
      status: m.planStatus, previousStatus: p.status, sampleClass: m.sampleClass,
      jacketekMethod: m.jacketekMethod,
      proposedTargetM: m.proposedTarget.rangeMin !== null ? { rangeMin: m.proposedTarget.rangeMin, rangeMax: m.proposedTarget.rangeMax, unit: "cm", quantity: m.proposedTarget.quantity, ...(m.proposedTarget.circumference ? { circumference: m.proposedTarget.circumference } : {}), status: "PROVISIONAL_TARGET", confidence: m.proposedTarget.confidence } : null,
      evidence: { goldenBear: m.goldenBear.available ? { value: m.goldenBear.value, unit: "cm", comparable: m.goldenBear.comparable } : null, suppliedChart: m.suppliedChart.available ? { value: m.suppliedChart.value, unit: "cm", comparable: m.suppliedChart.comparable, verified: false, provenance: SUP.provenance } : null, siGraphics: m.siGraphics.classification },
      methodConflicts: m.methodConflicts, unresolvedReason: m.unresolvedReason,
      finalAuthority: AUTH, approvalState: "NOT_APPROVED",
    };
  }
  const changed = (id, oldState, newState, source, reason, confidence) => ({ pom: id, oldState, newState, source, reason, confidence, approvalState: "NOT_APPROVED" });
  v2.changeLog = [
    ...withTarget.map((id) => { const t = PROPOSED_TARGETS_M[id]; return changed(id, "VERIFIED_SOURCE (Golden Bear reference value; provisional range only at document level)", `PROVISIONAL_TARGET ${f1(t.rangeMin)}–${f1(t.rangeMax)} cm (${t.quantity}); Golden Bear reference kept unchanged`, t.sources.join(" + "), `Rule 1 — two references, same quantity, within ${id === "B01" ? "1.23" : id === "B09" ? "0.47" : "0.69"} cm. ${t.confidenceReason}`, t.confidence); }),
    changed("S01", "VERIFIED_SOURCE", "VERIFIED_SOURCE (reference only) + MEASUREMENT METHOD CONFLICT — no JACKETEK target", "Golden Bear", "Rule 2/3 — only Golden Bear measures from CB; supplied chart measures from the shoulder seam (MC-01).", "n/a"),
    changed("S02", "TO_MEASURE_ON_SAMPLE", "TO_MEASURE_ON_SAMPLE + supplied 51 cm recorded as a non-comparable reference (MC-01)", "Supplied chart", "Rule 2 — method conflict; not combined.", "n/a"),
    ...["R02", "R03", "R04", "F06"].map((id) => changed(id, "DERIVED_FROM_APPROVED_SPEC", "TBD_PATTERN_MAKER (sample class CALCULATED AFTER SAMPLE)", "—", "Allowed-status vocabulary: the input ratio is a pattern-maker decision; the value is calculated after the sample.", "n/a")),
    { pom: "15 POMs", oldState: "TO_SET_BY_PATTERN_MAKER", newState: "TBD_PATTERN_MAKER (same meaning, plan vocabulary)", source: "—", reason: "Vocabulary only.", confidence: "n/a", approvalState: "NOT_APPROVED", poms: master.poms.filter((p) => p.status === "TO_SET_BY_PATTERN_MAKER").map((p) => p.id) },
    changed("B09", "PROVISIONAL_TARGET 49.5–50.0 cm (v0.2 draft, 2026-10-09)", "TBD_PATTERN_MAKER — range kept as a set-in REFERENCE only", "K1 decision (JACKETEK, 2026-10-10)", SET_IN_REFERENCE_M.B09.reason, "n/a"),
    changed("B10", "TO_MEASURE_ON_SAMPLE", "TBD_PATTERN_MAKER (set by the dropped shoulder point; measured on the sample)", "K1 decision", "Shoulder length includes the drop extension.", "n/a"),
    changed("S01 / S02", "Sleeve to the finished cuff edge", "JACKETEK primary end point: cuff seam (rib excluded); finished edge also recorded. S02 from the dropped shoulder point; S01 kept for comparison", "K1 decision + method definition (2026-10-10)", "Shoulder point → cuff seam is the unit the sleeve zones use (S02 − S09); edge = seam + S09.", "n/a"),
    { pom: siExample.join(", "), oldState: "no S.i. value recorded", newState: "S.i. example value recorded as EXAMPLE_VALUE (never imported); status unchanged", source: "S.i. spec sheet", reason: "Phase 2C classification.", confidence: "n/a", approvalState: "NOT_APPROVED" },
    { pom: "— (materials)", oldState: "K2 open (v0.1 conflicts); BOM / construction all TBD", newState: "K2 PARTIALLY_RESOLVED — body Cotton Fabric, sleeves Leather, rib, metal snaps, lining required (intent); every specification TBD_SUPPLIER_PROPOSAL / TBD_PATTERN_MAKER (materialConstructionPlan)", source: "JACKETEK product direction (2026-10-11)", reason: "Design intent recorded; no composition, weight, thickness, dimension or stitch value set. v0.1 bom / construction / conflicts unchanged.", confidence: "n/a", approvalState: "NOT_APPROVED" },
  ];
  v2.methodConflicts = CONFLICTS;
  v2.shoulderConstruction = K1;
  // v0.1's conflict K1 is kept verbatim in `conflicts`; its resolution is recorded here.
  v2.resolvedConflicts = [{ id: "K1", topic: "Shoulder construction", status: K1.status, decision: K1.decision, decided: K1.decided, decidedBy: K1.decidedBy, reasons: K1.reasons, notApproved: K1.notApproved, affectedPoms: Object.keys(SHOULDER_IMPACT) }];
  v2.setInReferenceM = SET_IN_REFERENCE_M;
  // K2 — materials and construction: design intent recorded, every specification open. v0.1 `bom`,
  // `construction` and `conflicts` stay verbatim; the plan sits beside them.
  v2.partiallyResolvedConflicts = [{ id: "K2", topic: K2.topic, status: K2.status, recorded: K2.recorded, decidedBy: K2.decidedBy, resolved: K2.resolved, unresolved: K2.unresolved, notApproved: K2.notApproved }];
  v2.materialConstructionPlan = {
    k2: K2,
    statusVocabulary: K2_STATUS,
    components: K2_COMPONENTS.map((c) => ({ ...c, approvalState: "NOT_APPROVED" })),
    embroideryConstruction: { fields: EMBROIDERY_FIELDS, substrates: EMBROIDERY_SUBSTRATES, types: EMBROIDERY_TYPES, placement: "Unchanged — v0.1 embroideryZones and the normalised zone placement; not mixed with construction." },
    leatherPolicy: LEATHER_POLICY,
    openAlignmentItems: OPEN_ALIGNMENT,
    contradictions: K2_CONTRADICTIONS,
    documents: ["garment-spec/material-construction-matrix-v0.1.json", "garment-spec/material-construction-matrix-v0.1.md", "garment-spec/factory-material-proposal-request.md"],
  };
  // Development size chart v0.1 (scripts/measurement/size-system.mjs) — APPROVED FOR DEVELOPMENT USE
  // (JACKETEK, 2026-10-11), NOT production approved. Each affected POM also carries its development
  // value in measurementPlan.developmentValue; the historical plan fields beside it are kept.
  const chart = developmentSizeChart();
  v2.developmentSizeChart = { ...chart, documents: ["garment-spec/jacketek-development-size-chart-v0.1.json", "garment-spec/jacketek-development-size-chart-v0.1.md"] };
  const DEV_ROWS = { B01: ["B01", "B01-C"], B06: ["B06"], B09: ["B09"], S02: ["S02", "S02-E"], S01: ["S01"], B03: ["B03"] };
  for (const [pomId, rowIds] of Object.entries(DEV_ROWS)) {
    const p = v2.poms.find((x) => x.id === pomId);
    p.measurementPlan.developmentValue = {
      status: chart.status,
      source: "garment-spec/jacketek-development-size-chart-v0.1.json",
      rows: rowIds.map((id) => { const r = chart.table.find((x) => x.id === id); return { id, name: r.name, class: r.class, label: r.label, bySize: r.bySize, formula: r.formula, gradePerSizeCm: r.gradePerSizeCm }; }),
    };
  }
  for (const id of ["B14", "B15", "B16", "S10", "S09"]) v2.poms.find((x) => x.id === id).measurementPlan.developmentValue = { status: "PATTERN_MAKER_SET + SAMPLE_VALIDATION", note: id === "S09" ? "Cuff rib height; fixes S02 = S02-E − S09." : "Armhole / sleeve cap: not derived from Golden Bear or S.i." };
  v2.changeLog.push({ pom: "B01, B06, B09, S02-E, S02, B03, S01 (+ SC-1)", oldState: "B01 / B06 provisional ranges; B09, sleeve TBD", newState: "Development size chart v0.1 APPROVED FOR DEVELOPMENT USE: B01 62.0, B06 68.0 (DEVELOPMENT_TARGET); SC-1 5.0 cm per side (development rule); B09 = Golden Bear + 10.0 (59.5 at M), S02-E = Golden Bear CB sleeve − ½ B09 (60.4 at M), B03 = B01 (DERIVED); S02 = S02-E − S09 (formula only); S01 / S01-E reference only; armhole pattern maker; XS–XXL graded from Golden Bear", source: "Golden Bear (fit / grading), supplied chart (M silhouette), S.i. (POM / proportional reference)", reason: "JACKETEK approval 2026-10-11. SC-1 = 5.0 cm per side; the earlier 3.0 cm proposal was REJECTED / REPLACED and is not active.", confidence: "LOW–MEDIUM", approvalState: "APPROVED FOR DEVELOPMENT USE — NOT PRODUCTION APPROVED" });
  v2.sampleValidationWorkflow = {
    document: "garment-spec/m-sample-validation-plan.md",
    anchorSize: "M",
    beforeSample: [`K1 decided: ${K1.decision} (${K1.decided}) — pattern maker provides / confirms the actual shoulder drop, shoulder point, across shoulder and sleeve length (shoulder point → cuff seam; centre back → cuff seam for comparison)`, "Pattern maker proposes every TBD_PATTERN_MAKER item and the measuring levels for B02, B12, B13, S05", "Pattern maker builds to the provisional ranges using measurement-methods-v0.1; sleeve length set on the fit model"],
    steps: ["Factory / pattern maker proposes missing construction dimensions", "M sample is produced", "Every required POM is measured (all alternative methods for ambiguous POMs)", "Actual vs target is compared", "Variance is calculated", "JACKETEK approves / rejects / requests adjustment", "Master Spec gets revised", "Only then can a Production Tech Pack v1.0 be created"],
  };
  v2.legacySizeChart = legacyAudit;
  v2.planCounts = planCounts;
  v2.sampleClassCounts = sampleCounts;
  v2.counts = master.counts; // v0.1 status counts, unchanged (field `status` per POM is unchanged)
  v2.measurementDocuments = ["garment-spec/measurement-source-matrix-v0.1.json", "garment-spec/measurement-source-matrix-v0.1.md", "garment-spec/measurement-methods-v0.1.md", "garment-spec/grading-strategy-v0.1.md", "garment-spec/m-sample-validation-plan.md"];
  // ---- v0.2 checks (approved requirements, 2026-10-09) — any failure stops the build
  const checks = {
    keepsEveryV01Pom: v2.poms.length === master.poms.length && master.poms.every((p, i) => v2.poms[i].id === p.id),
    preservesOriginalPomData: master.poms.every((p, i) => { const { measurementPlan, ...rest } = v2.poms[i]; return !!measurementPlan && JSON.stringify(rest) === JSON.stringify(p); }),
    preservesV01Sections: ["referenceValues", "secondaryVisualReference", "provisionalTargetRangeM", "fitValidation", "bom", "construction", "embroideryZones", "dataOwnership", "sampleChecklist", "methodAmbiguities", "conflicts", "sampleStrategy", "decisions", "counts"].every((k) => JSON.stringify(v2[k]) === JSON.stringify(master[k])),
    measurementPlanOnEveryPom: v2.poms.every((p) => p.measurementPlan?.approvalState === "NOT_APPROVED"),
    noProductionApproval: v2.productionApproved === false && v2.documentStatus === "VALIDATION_DRAFT" && !JSON.stringify(v2).includes("APPROVED_PRODUCTION"),
    suppliedChartLimitation: SUP.provenance.every((f) => v2.secondaryVisualReferenceLimitation.flags.includes(f)) && v2.sources.find((x) => x.id === "SUP").verified === false,
    allEightMethodConflicts: v2.methodConflicts.length === 8,
    k1Resolved: v2.resolvedConflicts.some((c) => c.id === "K1" && c.status === "RESOLVED" && c.decision === "DROPPED_SHOULDER") && JSON.stringify(v2.conflicts) === JSON.stringify(master.conflicts),
    noShoulderApproval: ["B09", "B10", "B11", "S01", "S02", "S10"].every((id) => { const pl = v2.poms.find((p) => p.id === id).measurementPlan; return pl.approvalState === "NOT_APPROVED" && pl.proposedTargetM === null; }),
    sampleValidationWorkflow: v2.sampleValidationWorkflow.steps.length === 8,
    supersedesV01: v2.supersedes.sha256 === sha(v01Buf),
    k2PartiallyResolved: v2.partiallyResolvedConflicts.some((c) => c.id === "K2" && c.status === "PARTIALLY_RESOLVED") && !v2.resolvedConflicts.some((c) => c.id === "K2"),
    k2DesignIntent: v2.materialConstructionPlan.components.find((c) => c.id === "K2.1").material.value === "Cotton Fabric" && v2.materialConstructionPlan.components.find((c) => c.id === "K2.2").material.value === "Leather",
    sizeChartDevelopmentOnly: v2.developmentSizeChart.productionApproved === false && v2.developmentSizeChart.approval.production.approved === false && v2.developmentSizeChart.status === "APPROVED FOR DEVELOPMENT USE — NOT PRODUCTION APPROVED",
    k2NoInventedSpec: v2.materialConstructionPlan.components.every((c) => c.approvalState === "NOT_APPROVED" && Object.values(c.spec).every((f) => typeof f.value !== "number")) && EMBROIDERY_TYPES.every((t) => Object.values(t.fields).every((f) => f.value === null)),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) throw new Error(`Master Spec v0.2 checks failed: ${failed.join(", ")}`);
  v2Checks = checks;
  const text = JSON.stringify(v2, null, 2) + "\n";
  writeFileSync(join(ROOT, V02_REPORT), text);
  writeFileSync(join(ROOT, V02), text);
}

// ------------------------------------------------------------- review images
const out = join(ROOT, REVIEW);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const BROWSER = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const C = { GB: "#1f5fbf", SUP: "#d9822b", SIG: "#7a5aa6", TGT: "#2e8b57", TBD: "#a07800", X: "#9a9a9a" };
const chip = (k, t) => `<span class="chip" style="background:${C[k]}">${esc(t)}</span>`;
const legend = `<div class="legend">${chip("GB", "GOLDEN BEAR")}${chip("SUP", "MY SIZE CHART — UNVERIFIED")}${chip("SIG", "S.I. GRAPHICS")}${chip("TGT", "PROVISIONAL JACKETEK TARGET")}${chip("TBD", "TBD")}${chip("X", "EXCLUDED / EXAMPLE")}</div>`;
const CSS = `*{box-sizing:border-box}body{margin:0;font:12px/1.35 Arial,Helvetica,sans-serif;color:#111;background:#fff}.pg{padding:26px 34px}
h1{font-size:20px;margin:0 0 2px;letter-spacing:.3px}.sub{color:#555;margin-bottom:10px}.legend{margin:6px 0 12px}.chip{display:inline-block;color:#fff;font-weight:700;font-size:10px;padding:2px 7px;border-radius:3px;margin:0 5px 3px 0}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9c9c9;padding:4px 6px;vertical-align:top;text-align:left}th{background:#f0f0f0;font-size:11px}
.gb{color:${C.GB};font-weight:700}.sup{color:${C.SUP};font-weight:700}.sig{color:${C.SIG}}.tgt{color:${C.TGT};font-weight:700}.tbd{color:${C.TBD};font-weight:700}.x{color:${C.X};text-decoration:line-through}
.foot{margin-top:12px;color:#666;font-size:10px;border-top:1px solid #ccc;padding-top:6px}.badge{float:right;border:2px solid #b00;color:#b00;font-weight:700;padding:3px 8px;font-size:11px}.small{font-size:10.5px;color:#444}`;
const FOOT = `<div class="foot">JACKETEK · measurement source review v0.1 · ${CHECKED} · Master Spec v0.1 (unchanged) + measurement-source-matrix-v0.1 · VALIDATION DRAFT — NOT PRODUCTION APPROVED · values 0.1 cm; no value read from a drawing</div>`;
const page = (title, sub, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="pg"><span class="badge">NOT PRODUCTION APPROVED</span><h1>${esc(title)}</h1><div class="sub">${sub}</div>${legend}${body}${FOOT}</div></body></html>`;
const shots = [];
const shot = (name, html, h = 794) => {
  const f = join(out, `${name}.html`);
  writeFileSync(f, html);
  execFileSync(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--screenshot=${join(out, `${name}.png`)}`, `--window-size=1123,${h}`, pathToFileURL(f).href], { stdio: "ignore" });
  rmSync(f);
  shots.push(`${name}.png`);
};
const mx = (id) => matrix.find((m) => m.pomId === id);

// 01 core
{
  const rows = ["B01", "B09", "B06", "S01", "S02", "B08"].map((id) => {
    const m = mx(id);
    const siRow = siRowsOf(id)[0];
    const leg = m.legacyChart ? `<span class="x">${m.legacyChart.value} cm</span>` : "—";
    const tgt = id === "B09" ? `<span class="tbd">TBD_PATTERN_MAKER</span><br><span class="small">dropped shoulder (K1); ${f1(SET_IN_REFERENCE_M.B09.rangeMin)}–${f1(SET_IN_REFERENCE_M.B09.rangeMax)} set-in reference only</span>` : m.proposedTarget.rangeMin !== null ? `<span class="tgt">${f1(m.proposedTarget.rangeMin)}–${f1(m.proposedTarget.rangeMax)} cm</span>${id === "B01" ? "<br><span class='small'>half chest (circ. 122.0–124.5)</span>" : ""}` : `<span class="tbd">${id.startsWith("S") ? "NO TARGET — method conflict" : "TO MEASURE ON SAMPLE"}</span>`;
    return `<tr><td><b>${id}</b><br>${esc(m.name)}</td><td>${m.goldenBear.available ? `<span class="gb">${m.goldenBear.valueSource.text} in = ${f1(m.goldenBear.value)} cm</span>${id === "B01" ? `<br><span class="small">half ${f1(m.goldenBear.value / 2)}</span>` : ""}<br><span class="small">${esc(m.goldenBear.sourceMeasurementName)}</span>` : "—"}</td><td>${m.suppliedChart.available ? `<span class="sup">${m.suppliedChart.value} cm</span><br><span class="small">${esc(m.suppliedChart.sourceMeasurementName)} · ${esc(m.suppliedChart.comparable.split(" —")[0])}<br><i>unverified · image unavailable</i></span>` : "—"}</td><td>${siRow ? `<span class="x">${esc(siRow.text)}</span><br><span class="small">EXAMPLE_VALUE</span>` : `<span class="small">${m.siGraphics.classification}</span>`}</td><td>${leg}</td><td>${tgt}</td><td class="small">${esc(m.jacketekMethod.a)} → ${esc(m.jacketekMethod.b)}</td></tr>`;
  }).join("");
  shot("01-core-measurements", page("CORE MEASUREMENTS — SIZE M", "The four Golden Bear POMs, the shoulder-point sleeve and the front length, by source. Sources are shown side by side and never averaged.", `<table><tr><th>POM</th><th>Golden Bear (verified)</th><th>My size chart (secondary, unverified)</th><th>S.i. Graphics</th><th>Legacy chart (excluded)</th><th>JACKETEK M</th><th>JACKETEK method</th></tr>${rows}</table><p class="small">Golden Bear re-checked ${CHECKED}: unchanged. My size chart: ${esc(SUP.provenance.join(" · "))} — not independently verified; adds no confidence. S.i. spec-sheet values are demo data (style SW-TSH-04), printed identically in the Blank and Example files.</p>`));
}

// 02 source comparison — all 56
{
  const cell = (m) => {
    const gb = m.goldenBear.available ? `<span class="gb">${f1(m.goldenBear.value)}</span>` : "·";
    const sup = m.suppliedChart.available ? `<span class="sup">${m.suppliedChart.value}${m.pomId === "S02" ? "≠" : ""}</span>` : "·";
    const si = m.siGraphics.classification === "EXAMPLE_VALUE" ? `<span class="x">${esc(m.siGraphics.valueSource.text)}</span>` : `<span class="small sig">${m.siGraphics.classification === "POM_LOCATION_ONLY" ? "loc." : "n/a"}</span>`;
    const st = m.planStatus === "PROVISIONAL_TARGET" ? `<span class="tgt">${f1(m.proposedTarget.rangeMin)}–${f1(m.proposedTarget.rangeMax)}</span>` : m.planStatus === "VERIFIED_SOURCE" ? `<span class="gb">REF only</span>` : `<span class="tbd">${m.planStatus === "TBD_PATTERN_MAKER" ? "PATTERN" : "SAMPLE"}</span>`;
    return `<td><b>${m.pomId}</b></td><td>${esc(m.name.length > 38 ? m.name.slice(0, 36) + "…" : m.name)}</td><td>${gb}</td><td>${sup}</td><td>${si}</td><td>${st}</td>`;
  };
  const half = Math.ceil(matrix.length / 2);
  let rows = "";
  for (let i = 0; i < half; i++) rows += `<tr>${cell(matrix[i])}${matrix[i + half] ? cell(matrix[i + half]) : "<td colspan=6></td>"}</tr>`;
  const th = "<th>POM</th><th>Name</th><th>GB</th><th>Mine</th><th>S.i.</th><th>JACKETEK</th>";
  shot("02-source-comparison", page("SOURCE COMPARISON — ALL 56 POMs", "cm, size M. GB = Golden Bear · Mine = my size chart (≠ = not comparable) · S.i.: struck = example value, loc. = location on the flat only · JACKETEK: provisional range, REF only, SAMPLE = to measure on sample, PATTERN = pattern maker.", `<table style="font-size:10.5px"><tr>${th}${th}</tr>${rows}</table>`), 850);
}

// 03 size-M target bars
{
  const bar = (id) => {
    const m = mx(id), t = PROPOSED_TARGETS_M[id];
    const gbV = id === "B01" ? m.goldenBear.value / 2 : m.goldenBear.value, supV = m.suppliedChart.value;
    const lo = Math.floor(Math.min(gbV, supV) - 2), hi = Math.ceil(Math.max(gbV, supV) + 2), W = 640, x = (v) => 20 + ((v - lo) / (hi - lo)) * W;
    let ticks = ""; for (let v = lo; v <= hi; v++) ticks += `<line x1="${x(v)}" y1="58" x2="${x(v)}" y2="64" stroke="#999"/><text x="${x(v)}" y="78" font-size="10" text-anchor="middle" fill="#666">${v}</text>`;
    return `<tr><td style="width:250px"><b>${id} · ${esc(t.quantity)}</b><br><span class="tgt">${f1(t.rangeMin)}–${f1(t.rangeMax)} cm</span> PROVISIONAL_TARGET<br><span class="small">Confidence ${t.confidence}: ${esc(t.confidenceReason)}</span><br><span class="small">Sample: ${esc(t.sampleValidation)}</span></td><td><svg width="690" height="86"><line x1="20" y1="60" x2="${20 + W}" y2="60" stroke="#999"/>${ticks}<rect x="${x(t.rangeMin)}" y="30" width="${x(t.rangeMax) - x(t.rangeMin)}" height="22" fill="${C.TGT}" opacity=".25" stroke="${C.TGT}"/><circle cx="${x(gbV)}" cy="41" r="6" fill="${C.GB}"/><text x="${x(gbV)}" y="20" font-size="11" text-anchor="middle" fill="${C.GB}" font-weight="700">GB ${f1(gbV)}</text><rect x="${x(supV) - 6}" y="35" width="12" height="12" fill="${C.SUP}"/><text x="${x(supV)}" y="${Math.abs(x(supV) - x(gbV)) < 60 ? 8 : 20}" font-size="11" text-anchor="middle" fill="${C.SUP}" font-weight="700">Mine ${f1(supV)} *</text></svg></td></tr>`;
  };
  shot("03-size-M-target", page("PROPOSED JACKETEK SIZE M — PROVISIONAL TARGETS", "Only defensible values. Range ends are the two references — not an average. Everything else stays TO_MEASURE_ON_SAMPLE or TBD_PATTERN_MAKER.", `<table>${withTarget.map(bar).join("")}<tr><td><b>B09 · Across shoulder</b><br><span class="tbd">NO TARGET — TBD_PATTERN_MAKER</span></td><td class="small">K1 = DROPPED_SHOULDER (${K1.decided}). Golden Bear <span class="gb">49.5</span> (set-in) and my chart <span class="sup">50.0</span> (construction unknown) are kept as a reference range only. The pattern maker places the dropped shoulder point; B09 is measured on the M sample.</td></tr><tr><td><b>Sleeve (S01 / S02)</b><br><span class="tbd">NO JACKETEK TARGET</span></td><td class="small">Golden Bear <span class="gb">35½ in = 90.2 cm from centre back</span> and my chart <span class="sup">51 cm from the shoulder seam</span> are different measurements (MC-01) — never compared or averaged. The sleeve is set on the fit model at the sample, then measured by the written method.</td></tr></table><p class="small">* My size chart: ${esc(SUP.provenance.join(" · "))}. It may be one end of a range but adds no confidence — every confidence rests on Golden Bear alone.</p><p class="small">B01 is defined as a circumference; the range is shown as half chest (flat) because that is how both references compare. Circumference equivalent: 122.0–124.5 cm.</p>`));
}

// 04 grading
{
  const sizes = Object.keys(GB.rows);
  const gbRow = (lbl, f) => `<tr><td>${lbl}</td>${sizes.map((s) => `<td class="${s === "M" ? "gb" : ""}">${f1(f(GB.rows[s]))}</td>`).join("")}</tr>`;
  shot("04-grading-comparison", page("GRADING COMPARISON", "M stays the anchor. Golden Bear steps are a grade reference, applied later as increments to the approved JACKETEK M — not as Golden Bear's absolute sizes.", `<table><tr><th>Golden Bear Classic (cm)</th>${sizes.map((s) => `<th>${s}</th>`).join("")}</tr>${gbRow("Half chest (B01 ÷ 2)", (r) => cm(r.B01) / 2)}${gbRow("Across shoulder (B09)", (r) => cm(r.B09))}${gbRow("Centre back (B06)", (r) => cm(r.B06))}${gbRow("Sleeve from CB (S01)", (r) => cm(r.S01))}</table><br><table><tr><th>Dimension</th><th>Golden Bear / size</th><th>My chart / size</th><th>Legacy (excluded)</th><th>Agree?</th><th>Proposed JACKETEK grade</th><th>Status</th></tr>${GRADE.map((g) => `<tr><td><b>${esc(g.dim)}</b></td><td class="gb">+${g.gbCm} cm${g.halfCm ? ` (half +${g.halfCm})` : ""}</td><td class="tbd">not available</td><td class="x">${esc(g.legacy)}</td><td class="small">${esc(g.agree)}</td><td class="${g.status.startsWith("TBD") ? "tbd" : "tgt"}">${esc(g.proposed)}</td><td class="small">${esc(g.status)}<br>${esc(g.dep)}</td></tr>`).join("")}</table><p class="small">All other POMs: TBD_PATTERN_MAKER. ${esc(SUP.gradingNote)}</p>`));
}

// 05 unresolved
{
  const group = (lbl, k, list) => `<tr><td style="width:230px"><span class="${k}">${esc(lbl)}</span><br><span class="small">${list.length} POMs</span></td><td>${list.map((m) => `<b>${m.pomId}</b> ${esc(m.name)}`).join(" · ")}</td></tr>`;
  const g = (f) => matrix.filter(f);
  shot("05-unresolved-poms", page("UNRESOLVED POMs", `${matrix.length - withTarget.length} of ${matrix.length} POMs have no JACKETEK target yet. None is approved.`, `<table style="font-size:11px">${group("MEASUREMENT METHOD CONFLICT / SAMPLE REQUIRED", "tbd", g((m) => m.pomId === "S01" || m.pomId === "S02"))}${group("TO_MEASURE_ON_SAMPLE — level to be fixed first", "tbd", g((m) => m.planStatus === "TO_MEASURE_ON_SAMPLE" && m.jacketekMethod.clarity === "DISTANCE_TBD"))}${group("TO_MEASURE_ON_SAMPLE", "tbd", g((m) => m.planStatus === "TO_MEASURE_ON_SAMPLE" && m.pomId !== "S02" && m.jacketekMethod.clarity !== "DISTANCE_TBD"))}${group("TBD_PATTERN_MAKER — construction", "tbd", g((m) => m.planStatus === "TBD_PATTERN_MAKER" && m.sampleClass === "PATTERN MAKER TO SET" && m.pomId !== "B09" && m.pomId !== "B10"))}${group("TBD_PATTERN_MAKER — calculated after sample", "tbd", g((m) => m.sampleClass === "CALCULATED AFTER SAMPLE"))}${group("TBD_PATTERN_MAKER — dropped shoulder point (K1)", "tbd", g((m) => m.pomId === "B09" || m.pomId === "B10"))}${group("PROVISIONAL_TARGET — still needs the sample", "tgt", g((m) => m.planStatus === "PROVISIONAL_TARGET"))}</table>`));
}

// 06 conflicts
shot("06-measurement-method-conflicts", page("MEASUREMENT-METHOD CONFLICTS", "Where sources measure differently they are kept apart. Each conflict is settled on the physical M sample by recording every alternative.", `<table style="font-size:11px"><tr><th>ID</th><th>POMs</th><th>Conflict</th><th>Detail</th><th>Result</th></tr>${CONFLICTS.map((c) => `<tr><td><b>${c.id}</b></td><td>${c.poms.join(", ")}</td><td><b>${esc(c.title)}</b>${c.status ? `<br><span class="tgt small">${esc(c.status)}</span>` : ""}</td><td class="small">${esc(c.detail)}</td><td class="tbd">${esc(c.result)}</td></tr>`).join("")}</table>`));

writeFileSync(join(out, "measurement-source-review.json"), JSON.stringify({ ...meta, images: shots, summary, provisionalTargetsM: Object.fromEntries(withTarget.map((id) => [id, PROPOSED_TARGETS_M[id]])), sleeve: "NO JACKETEK TARGET — MC-01", conflicts: CONFLICTS.map(({ id, poms, title, result }) => ({ id, poms, title, result })), legacyChart: { labelledLegacy: true, rfq05DependsOnIt: false, stillReadBy: legacyAudit.readers.map((r) => r.code) }, matrix: "garment-spec/measurement-source-matrix-v0.1.json", masterSpecV02: { file: V02, wiredIntoRfq: false } }, null, 1) + "\n");

console.log(JSON.stringify({ v02Checks: v2Checks, summary, files: ["measurement-source-matrix-v0.1.json", "measurement-source-matrix-v0.1.md", "measurement-methods-v0.1.md", "grading-strategy-v0.1.md", "m-sample-validation-plan.md", V02, V02_REPORT], review: shots }, null, 1));
