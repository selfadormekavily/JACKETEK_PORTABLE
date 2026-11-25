/**
 * The JACKETEK Master Garment Spec (garment-spec/jacketek-master-spec-v0.1.json,
 * a verbatim copy of the validated research document) → the garment parts of
 * a Manufacturing Spec: points of measure, reference grading, provisional
 * targets, BOM skeleton, construction, zones, open questions.
 *
 * No measurement is typed here: every number is read from the master spec
 * object passed in. Statuses translate one-to-one (MASTER_STATUS); a master
 * status this file doesn't know is an error, not a guess.
 */
import { known, open, targetRange, type Field, type Status } from "./provenance";
import type { BomItem, ConstructionItem, Pom, ProvisionalTarget, SizeId } from "./types";

/** The parts of the master spec JSON this module reads (schema jacketek.masterGarmentSpec 0.1.0). */
export type MasterSpec = {
  schema: string;
  schemaVersion: string;
  title: string;
  revision?: string;
  productionApproved: boolean;
  sizes: string[];
  baseSize: string;
  decisions: Record<string, string | string[]>;
  poms: {
    id: string;
    area: string;
    name: string;
    arabic: string;
    method: string;
    start: string;
    end: string;
    condition: string;
    unit: string;
    status: string;
    source?: { name: string; url: string; accessed: string };
    gradePerSize?: { inches: number; cm: number };
  }[];
  referenceValues: { label: string; source: string; values: Record<string, Record<string, { inches: number; inchesText: string; cm: number }>> };
  secondaryVisualReference: {
    classification: string;
    role: string;
    valuesM: { chestHalfFlatCm: number; acrossShoulderCm: number; bodyLengthCm: number; sleeveFromShoulderSeamCm: number };
    methods: Record<string, string>;
  };
  provisionalTargetRangeM: { label: string; chestHalfFlatCm: [number, number]; acrossShoulderCm: [number, number]; bodyLengthCm: [number, number]; note: string };
  methodAmbiguities: { id: string; pom: string; title: string; detail: string }[];
  conflicts: { id: string; topic: string; detail: string }[];
  bom: { id: string; category: string; component: string; placement: string; description: string; dataSource: string; status: string }[];
  construction: { id: string; operation: string; fieldsRequired: string; status: string }[];
  embroideryZones: {
    zones: {
      zoneId: string;
      name: string;
      panel: string;
      primaryAnchor: string;
      secondaryAnchor: string;
      lockFields: { maxWidthCm: number | null; maxHeightCm: number | null; xReferenceCm: number | null; yReferenceCm: number | null };
      status: string;
    }[];
  };
};

export const MASTER_SCHEMA = "jacketek.masterGarmentSpec";

/** Master POM status → Manufacturing Spec status. */
const MASTER_STATUS: Record<string, Status> = {
  VERIFIED_SOURCE: "VERIFIED_SOURCE",
  TO_MEASURE_ON_SAMPLE: "TO_MEASURE_ON_SAMPLE",
  TO_SET_BY_PATTERN_MAKER: "TBD_PATTERN_MAKER",
  // Calculated once its inputs are approved: until then nobody has a value.
  DERIVED_FROM_APPROVED_SPEC: "TBD_PATTERN_MAKER",
};

const PRIMARY = "Golden Bear Classic Fit size chart (garment measurements, inches)";

/** Master unit text → the unit printed (cm unless the POM is a count / angle). */
const unitOf = (u: string) => (u === "count" ? "count" : u === "deg" ? "deg" : "cm");

export function masterPoms(master: MasterSpec, sizes: readonly SizeId[]): Pom[] {
  return master.poms.map((p) => {
    const status = MASTER_STATUS[p.status];
    if (!status) throw new Error(`Master spec POM ${p.id}: unknown status "${p.status}"`);
    const unit = unitOf(p.unit);
    const ref = master.referenceValues.values[p.id];
    const values = Object.fromEntries(
      sizes.map((s) => {
        if (status === "VERIFIED_SOURCE") {
          const v = ref?.[s];
          if (!v) return [s, open<number>("UNKNOWN", unit, `No reference value for ${s} in the master spec`)];
          const base = s === master.baseSize;
          return [
            s,
            known(v.cm, base ? "VERIFIED_SOURCE" : "DERIVED_FROM_VERIFIED_SOURCE", base ? PRIMARY : `${PRIMARY}: base ${master.baseSize} + published grade`, "cm", {
              sourceValue: { value: v.inches, unit: "in", text: `${v.inchesText} in` },
              precision: 1,
              note: "Reference value — not JACKETEK production approved",
            }),
          ];
        }
        const note = status === "TO_MEASURE_ON_SAMPLE" ? "To be confirmed on sample" : p.status === "DERIVED_FROM_APPROVED_SPEC" ? "Calculated once its inputs are approved" : "Pattern-maker decision";
        return [s, open<number>(status, unit, note)];
      })
    ) as Record<SizeId, Field<number>>;
    const notes: string[] = [];
    if (status === "VERIFIED_SOURCE") notes.push(`Source label: ${p.source?.name ?? PRIMARY}`);
    return {
      id: p.id,
      area: p.area,
      name: p.name,
      nameAr: p.arabic,
      method: p.method,
      start: p.start,
      end: p.end,
      condition: p.condition,
      values,
      tolerance: open<number>("TBD_SUPPLIER_PROPOSAL", unit === "cm" ? "cm" : unit, "Supplier to propose a tolerance"),
      notes,
    };
  });
}

/** Grading the master spec actually supports: Golden Bear's published increments, for its four POMs only. */
export function masterGrading(master: MasterSpec) {
  return master.poms
    .filter((p) => p.status === "VERIFIED_SOURCE" && p.gradePerSize)
    .map((p) => ({
      pomId: p.id,
      name: p.name,
      perSize: known(p.gradePerSize!.cm, "VERIFIED_SOURCE", `${PRIMARY}: published grade per size`, "cm", {
        sourceValue: { value: p.gradePerSize!.inches, unit: "in" },
        precision: 2,
        note: "Reference grading — not JACKETEK production approved",
      }),
    }));
}

export function masterTargets(master: MasterSpec): ProvisionalTarget[] {
  const t = master.provisionalTargetRangeM;
  const src = "Master Spec v0.1 provisional target (Golden Bear Classic M and the JACKETEK visual fit reference)";
  return [
    { measurement: "Half chest, flat", relatedPom: "B01", field: targetRange(t.chestHalfFlatCm, "cm", src, "B01 is a full circumference: compare the half chest × 2"), method: "Half chest, laid flat (exact height below the armhole to be confirmed)" },
    { measurement: "Across shoulder", relatedPom: "B09", field: targetRange(t.acrossShoulderCm, "cm", src), method: "Shoulder point to shoulder point across the back" },
    { measurement: "Body length", relatedPom: "B06", field: targetRange(t.bodyLengthCm, "cm", src, "Start point to be confirmed (CB collar seam vs top of collar)"), method: "Centre back, to the finished bottom edge" },
  ];
}

export function masterBenchmark(master: MasterSpec) {
  const v = master.secondaryVisualReference.valuesM;
  const m = master.secondaryVisualReference.methods;
  return {
    label: "JACKETEK visual fit reference — M only, secondary benchmark",
    status: "SECONDARY_VISUAL_REFERENCE" as const,
    note: "Source and measuring method not independently verified. Not a specification; its grading is not used. Its sleeve (from shoulder seam) is not comparable with the centre-back sleeve S01.",
    values: [
      { measurement: "Half chest, flat", value: v.chestHalfFlatCm, unit: "cm", method: m.chestHalfFlatCm },
      { measurement: "Across shoulder", value: v.acrossShoulderCm, unit: "cm", method: m.acrossShoulderCm },
      { measurement: "Body length", value: v.bodyLengthCm, unit: "cm", method: m.bodyLengthCm },
      { measurement: "Sleeve from shoulder seam", value: v.sleeveFromShoulderSeamCm, unit: "cm", method: m.sleeveFromShoulderSeamCm },
    ],
  };
}

/** The master BOM skeleton; per-order values (materials, colours) are filled by the builder. */
export function masterBom(master: MasterSpec): BomItem[] {
  return master.bom.map((b) => ({
    id: b.id,
    category: b.category,
    component: b.component,
    placement: b.placement,
    material: /^UNKNOWN/.test(b.description) ? open<string>("UNKNOWN", null, b.description) : open<string>("TBD_SUPPLIER_PROPOSAL", null, "Supplier proposal required"),
    colour: open<string>("TBD_SUPPLIER_PROPOSAL", null),
    specification: open<string>("TBD_SUPPLIER_PROPOSAL", null, "Composition, weight / thickness and construction: supplier proposal required"),
    supplier: open<string>("TBD_SUPPLIER_PROPOSAL", null),
    notes: [b.description],
  }));
}

export function masterConstruction(master: MasterSpec): ConstructionItem[] {
  return master.construction.map((c) => ({
    id: c.id,
    operation: c.operation,
    fieldsRequired: c.fieldsRequired,
    // Sleeve attachment depends on open conflict K1 (set-in vs dropped shoulder).
    value: c.id === "CON04" ? open<string>("UNKNOWN", null, "Set-in vs dropped shoulder is undecided (conflict K1)") : open<string>("TBD_SUPPLIER_PROPOSAL", null, "Supplier proposal required"),
    notes: [],
  }));
}

/** A master zone's locked dimension, or an explicit open value. Values set in a future master are proposals until approved. */
export function zoneField(v: number | null, label: string): Field<number> {
  return v === null || v === undefined
    ? open<number>("TBD_PATTERN_MAKER", "cm", `${label}: to be set by the pattern maker and approved on sample`)
    : known(v, "PROVISIONAL_TARGET", "Master Spec zone dimensions (not yet approved)", "cm", { precision: 1 });
}
