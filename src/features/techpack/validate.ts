/**
 * Validation of a Manufacturing Spec before any document is made from it.
 *
 * ERROR   — structural: the spec is wrong or incomplete in a way a document
 *           would hide (no size, broken artwork, impossible zone, a number
 *           where nobody knows the value, any production approval). No PDF.
 * WARNING — open manufacturing items. Expected in an RFQ; printed as the
 *           "open items" list.
 * INFO    — context.
 */
import { isFixedZone, LEGACY_ZONES, TEXT_MAX_CHARS, TEXT_MAX_LINES, ZONE_SCALE_MIN } from "@/features/configurator/model/embroideryGeometry";
import { OPEN_STATUSES, STATUSES, VALUE_STATUSES, type Field } from "./provenance";
import type { Issue, ManufacturingSpec, Severity, ValidationResult } from "./types";

export type ValidateOptions = {
  /** POM ids the master spec defines; a POM outside it is an error. */
  masterPomIds?: readonly string[];
  /** Server check that an artwork file exists in the tech pack folder. */
  fileExists?: (relativePath: string) => boolean;
};

const isField = (v: unknown): v is Field<unknown> =>
  !!v && typeof v === "object" && "status" in v && "approved" in v && "value" in v && "source" in v && "unit" in v;

export function validateManufacturingSpec(spec: ManufacturingSpec, opts: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const add = (severity: Severity, code: string, path: string, message: string) => issues.push({ severity, code, path, message });

  // ---- Document status ----
  if (spec.meta?.documentType !== "RFQ_TECH_PACK") add("ERROR", "DOCUMENT_TYPE", "meta.documentType", "Only RFQ_TECH_PACK documents are generated.");
  if (spec.meta?.documentStatus !== "NOT_FOR_BULK_PRODUCTION" || spec.meta?.statusBanner !== "RFQ — NOT FOR BULK PRODUCTION")
    add("ERROR", "DOCUMENT_STATUS", "meta", "An RFQ must be NOT_FOR_BULK_PRODUCTION with the banner \"RFQ — NOT FOR BULK PRODUCTION\".");
  if (spec.documentStatus?.productionApproved !== false) add("ERROR", "PRODUCTION_APPROVAL", "documentStatus", "An RFQ can never be production approved.");

  // ---- Every Field: provenance rules ----
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!v || typeof v !== "object") return;
    if (isField(v)) {
      if (!(STATUSES as readonly string[]).includes(v.status)) add("ERROR", "UNKNOWN_STATUS", path, `Status "${v.status}" is not one of the defined statuses.`);
      if (v.approved || v.status === "APPROVED_PRODUCTION") add("ERROR", "PRODUCTION_APPROVAL", path, "Production approval cannot appear in an RFQ.");
      if (OPEN_STATUSES.includes(v.status) && v.value !== null) add("ERROR", "VALUE_WITHOUT_SOURCE", path, `Status ${v.status} must not carry a value (found ${JSON.stringify(v.value)}).`);
      if (VALUE_STATUSES.includes(v.status) && v.value === null && !v.range) add("ERROR", "STATUS_WITHOUT_VALUE", path, `Status ${v.status} needs a value or a range.`);
      if (v.value !== null && !v.source) add("ERROR", "VALUE_WITHOUT_SOURCE", path, "A value needs a source.");
      if (typeof v.value === "number" && !Number.isFinite(v.value)) add("ERROR", "NOT_A_NUMBER", path, "Value is not a finite number.");
    }
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(spec, "");

  // ---- Customer garment data ----
  const g = spec.garment;
  if (!g?.size || g.size.value === null) add("ERROR", "MISSING_SIZE", "garment.size", "No selected size.");
  for (const [k, label] of [["bodyMaterial", "body material"], ["sleeveMaterial", "sleeve material"]] as const)
    if (!g?.[k] || g[k].value === null) add("ERROR", "MISSING_MATERIAL", `garment.${k}`, `No ${label}.`);
  for (const c of spec.colourway ?? [])
    if (["Body", "Sleeves"].includes(c.role) && c.colourId.value === null) add("ERROR", "MISSING_COLOUR", "colourway", `No ${c.role.toLowerCase()} colour.`);
  if (g?.closure?.snapFinish?.value === null) add("ERROR", "MISSING_SNAP_FINISH", "garment.closure.snapFinish", "No snap finish.");

  // ---- Measurements ----
  const m = spec.measurements;
  const ids = new Set<string>();
  for (const p of m?.poms ?? []) {
    if (ids.has(p.id)) add("ERROR", "DUPLICATE_POM", `measurements.poms.${p.id}`, "Duplicate POM id.");
    ids.add(p.id);
    if (opts.masterPomIds && !opts.masterPomIds.includes(p.id)) add("ERROR", "UNKNOWN_POM", `measurements.poms.${p.id}`, `POM ${p.id} is not defined in the master spec.`);
    const keys = Object.keys(p.values ?? {});
    if (keys.length !== m.sizes.length || !m.sizes.every((s) => keys.includes(s))) add("ERROR", "POM_SIZES", `measurements.poms.${p.id}`, "Values must cover exactly the size range.");
  }
  const reference = (m?.poms ?? []).filter((p) => Object.values(p.values).some((f) => f.status === "VERIFIED_SOURCE" || f.status === "DERIVED_FROM_VERIFIED_SOURCE"));
  if (reference.length)
    add("WARNING", "MEASUREMENT_REFERENCE_ONLY", "measurements", `${reference.map((p) => p.id).join(", ")}: Golden Bear Classic reference values — not JACKETEK production approved; provisional target ranges apply.`);
  const sample = (m?.poms ?? []).filter((p) => p.values[m.baseSize]?.status === "TO_MEASURE_ON_SAMPLE").map((p) => p.id);
  if (sample.length) add("WARNING", "MEASURE_ON_SAMPLE", "measurements", `${sample.length} POMs to be confirmed on sample: ${sample.join(", ")}.`);
  const pm = (m?.poms ?? []).filter((p) => p.values[m.baseSize]?.status === "TBD_PATTERN_MAKER").map((p) => p.id);
  if (pm.length) add("WARNING", "PATTERN_MAKER_DECISION", "measurements", `${pm.length} POMs are pattern-maker decisions: ${pm.join(", ")}.`);
  add("WARNING", "TOLERANCES_TBD", "measurements", "No tolerances are approved: supplier to propose per POM.");
  if (spec.grading?.productionApproved !== false) add("ERROR", "PRODUCTION_APPROVAL", "grading", "Grading cannot be production approved in an RFQ.");
  else add("INFO", "GRADING_REFERENCE", "grading", "Grading shown is Golden Bear reference grading for four POMs only.");
  for (const a of m?.methodAmbiguities ?? []) add("INFO", "METHOD_AMBIGUITY", `measurements.${a.pomId}`, `${a.id} ${a.title}.`);
  if (m?.secondaryBenchmark) add("INFO", "SECONDARY_BENCHMARK", "measurements.secondaryBenchmark", "Visual fit benchmark (M only) shown for context; not a specification.");

  // ---- Zones and artwork ----
  const zones = new Map((spec.embroideryZones ?? []).map((z) => [z.zoneId, z]));
  const artIds = new Set<string>();
  for (const [i, a] of (spec.artwork ?? []).entries()) {
    const path = `artwork[${i}] ${a.artworkId}`;
    if (artIds.has(a.artworkId)) add("ERROR", "DUPLICATE_ARTWORK", path, "Duplicate artwork id.");
    artIds.add(a.artworkId);
    if (!isFixedZone(a.zoneId)) {
      if (LEGACY_ZONES[a.zoneId]) add("WARNING", "LEGACY_PLACEMENT", path, `Older order: free placement in "${a.zoneName}" (before the fixed zones). Physical placement to be agreed.`);
      else add("ERROR", "UNKNOWN_ZONE", path, `Zone "${a.zoneId}" does not exist.`);
    } else if (!zones.has(a.zoneId)) add("ERROR", "ZONE_NOT_IN_SPEC", path, `Zone "${a.zoneId}" has no zone specification.`);
    if (!(a.aspect > 0) || !Number.isFinite(a.aspect)) add("ERROR", "MALFORMED_ARTWORK", path, "Artwork has no valid proportions.");
    const p = a.placement;
    if (isFixedZone(a.zoneId)) {
      if (!(p.normalizedScale >= ZONE_SCALE_MIN - 1e-9 && p.normalizedScale <= 1 + 1e-9)) add("ERROR", "MALFORMED_PLACEMENT", path, `Scale ${p.normalizedScale} is outside ${ZONE_SCALE_MIN}–1.`);
      if (Math.abs(p.normalizedOffsetX) > 0.5 || Math.abs(p.normalizedOffsetY) > 0.5) add("ERROR", "MALFORMED_PLACEMENT", path, "Offset places the artwork outside its zone.");
    }
    if (a.artworkType !== "TEXT" && !a.files.artwork) add("ERROR", "BROKEN_ASSET", path, "No artwork file.");
    if (a.files.artwork && opts.fileExists && !opts.fileExists(a.files.artwork)) add("ERROR", "BROKEN_ASSET", path, `Artwork file ${a.files.artwork} is missing.`);
    if (a.artworkType === "TEXT") {
      if (!a.text?.content.trim()) add("ERROR", "MALFORMED_TEXT", path, "Text embroidery without text.");
      else if (a.text.characterCount > TEXT_MAX_CHARS || a.text.lineCount > TEXT_MAX_LINES) add("ERROR", "MALFORMED_TEXT", path, `Text exceeds ${TEXT_MAX_CHARS} characters / ${TEXT_MAX_LINES} lines.`);
      if (!a.files.artwork) add("WARNING", "TEXT_NOT_DRAWN", path, "The text could not be drawn in its font: the PDF shows the text only.");
    }
    if (p.status === "PENDING_MASTER_ZONE_DIMENSIONS") add("WARNING", "ZONE_DIMENSIONS_PENDING", path, `${a.zoneName}: physical zone size and anchor offsets not approved — placement is proportional only.`);
    if (a.colourMode === "ORIGINAL" && a.artworkType !== "TEXT") add("WARNING", "THREADS_TO_MATCH", path, `${a.artworkId} is in the design's original colours: supplier / digitizer to match threads to the artwork file.`);
    for (const t of a.threads) if (t.threadId.value === null) add("WARNING", "THREAD_TBD", path, `${t.role}: thread to be proposed${t.hex ? ` (design colour ${t.hex})` : ""}.`);
  }
  if ((spec.artwork ?? []).length) add("WARNING", "TECHNIQUE_TBD", "artwork", "Embroidery technique, backing and digitizing for every artwork: supplier proposal required.");

  // ---- BOM / construction / garment decisions ----
  const bomOpen = [...(spec.materials ?? []), ...(spec.labels ?? [])].filter((b) => b.specification.value === null).map((b) => b.id);
  if (bomOpen.length) add("WARNING", "BOM_SUPPLIER_PROPOSAL", "materials", `${bomOpen.length} BOM lines need a supplier specification: ${bomOpen.join(", ")}.`);
  const conOpen = (spec.construction ?? []).filter((c) => c.value.value === null).map((c) => c.id);
  if (conOpen.length) add("WARNING", "CONSTRUCTION_TBD", "construction", `${conOpen.length} construction items need a supplier proposal: ${conOpen.join(", ")}.`);
  if (g?.closure?.snapCount?.value === null) add("WARNING", "SNAP_COUNT_TBD", "garment.closure.snapCount", "Snap count and spacing: pattern maker.");
  for (const c of spec.conflicts ?? []) add("WARNING", "OPEN_DECISION", `conflicts.${c.id}`, `${c.id} ${c.topic}: ${c.detail}`);

  const errors = issues.filter((x) => x.severity === "ERROR");
  return { ok: errors.length === 0, errors, warnings: issues.filter((x) => x.severity === "WARNING"), info: issues.filter((x) => x.severity === "INFO") };
}
