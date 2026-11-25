// POM LABELS — what each point of measure says on a drawing: its id (the master register's
// own id; no second system), a short name, and the size-M value with its status. Values
// are never computed from a drawing: they come from the master spec or the
// Manufacturing Spec built from it. Nothing is invented here.

/** Short names for labels on the drawing (the tables carry the full names). */
export const SHORT = {
  B01: "CHEST (½ × 2)", B02: "WAIST", B03: "BODY @ WAISTBAND", B04: "BOTTOM OPENING relaxed", B05: "BOTTOM OPENING extended",
  B06: "CB LENGTH", B07: "BACK LENGTH from HPS", B08: "FRONT LENGTH from HPS", B09: "ACROSS SHOULDER", B10: "SHOULDER LENGTH",
  B11: "SHOULDER DROP", B12: "ACROSS FRONT", B13: "ACROSS BACK", B14: "ARMHOLE DEPTH", B15: "ARMHOLE straight", B16: "ARMHOLE along seam",
  S01: "SLEEVE from CB", S02: "SLEEVE from SP", S03: "UNDERARM LENGTH", S04: "BICEP (1\" below armhole)", S05: "ELBOW",
  S06: "SLEEVE @ CUFF SEAM", S07: "CUFF OPENING relaxed", S08: "CUFF OPENING extended", S09: "CUFF RIB HEIGHT", S10: "CAP HEIGHT (pattern)",
  R01: "WAISTBAND RIB HEIGHT", R02: "WAISTBAND RIB CUT LENGTH", R03: "CUFF RIB CUT LENGTH", R04: "COLLAR RIB CUT LENGTH", R05: "RIB STRIPE LAYOUT",
  C01: "COLLAR HEIGHT @ CB", C02: "COLLAR HEIGHT @ FRONT", C03: "COLLAR NECK EDGE", C04: "COLLAR OUTER EDGE", C05: "NECK WIDTH",
  C06: "FRONT NECK DROP", C07: "BACK NECK DROP", F01: "FACING WIDTH", F02: "FRONT OVERLAP", F03: "SNAP COUNT", F04: "TOP SNAP below neck seam",
  F05: "LOWEST SNAP above edge", F06: "SNAP SPACING", F07: "SNAP from edge", P01: "POCKET OPENING", P02: "WELT WIDTH",
  P03: "POCKET below HPS", P04: "POCKET from CF", P05: "POCKET ANGLE", P06: "POCKET BAG DEPTH", P07: "POCKET BAG WIDTH",
};

/** Label status codes: PROV, REF, SAMPLE, PATTERN, DERIVED. */
const STATUS_SHORT = {
  TO_MEASURE_ON_SAMPLE: "SAMPLE", TO_SET_BY_PATTERN_MAKER: "PATTERN", TBD_PATTERN_MAKER: "PATTERN",
  DERIVED_FROM_APPROVED_SPEC: "DERIVED", SYSTEM_DERIVED: "DERIVED", TBD_SUPPLIER_PROPOSAL: "SAMPLE", UNKNOWN: "SAMPLE",
  VERIFIED_SOURCE: "REF", DERIVED_FROM_VERIFIED_SOURCE: "REF", SECONDARY_VISUAL_REFERENCE: "REF", PROVISIONAL_TARGET: "PROV",
};

const range = (r) => `${r[0]}–${r[1]} cm`;

/**
 * id → { code, short, name, method, value, status, target } from the master spec (M) — the
 * review packages. value = the reference value (VERIFIED_SOURCE) or TBD; target = the
 * master spec's PROVISIONAL target range for M where it has one (B01 as a half chest).
 */
export function pomDisplay(master) {
  const t = master.provisionalTargetRangeM;
  const ref = master.referenceValues.values;
  const targets = { B01: `½ ${range(t.chestHalfFlatCm)}`, B09: range(t.acrossShoulderCm), B06: range(t.bodyLengthCm) };
  const out = {};
  for (const p of master.poms) {
    let value = "TBD", status = STATUS_SHORT[p.status] ?? "SAMPLE";
    if (p.status === "VERIFIED_SOURCE") [value, status] = [`${ref[p.id].M.cm.toFixed(1)} cm`, "REF"];
    out[p.id] = { code: p.id, short: SHORT[p.id] ?? p.name, name: p.name, method: p.method, value, status, target: targets[p.id] ?? null, masterStatus: p.status };
  }
  return out;
}

/** POM id → its provisional target text from a Manufacturing Spec (measurements.provisionalTargets). */
export function targetsFromSpec(spec) {
  const out = {};
  for (const t of spec.measurements.provisionalTargets ?? []) {
    const r = t.field?.range;
    if (!t.relatedPom || !r) continue;
    out[t.relatedPom] = `${/half chest/i.test(t.measurement) ? "½ " : ""}${range(r)}`;
  }
  return out;
}

/**
 * id → label from a Manufacturing Spec (the RFQ): the same base-size field the RFQ's
 * measurement table prints, so a drawing and its table can never disagree.
 */
export function pomDisplayFromSpec(spec) {
  const base = spec.measurements.baseSize;
  const targets = targetsFromSpec(spec);
  const out = {};
  for (const p of spec.measurements.poms) {
    const f = p.values[base] ?? {};
    let value = "TBD";
    if (f.value !== null && f.value !== undefined && typeof f.value === "number") value = `${f.value.toFixed(f.precision ?? 1)} ${f.unit ?? ""}`.trim();
    else if (f.range) value = `${f.range[0]}–${f.range[1]} ${f.unit ?? ""}`.trim();
    const status = value === "TBD" ? STATUS_SHORT[f.status] ?? "SAMPLE" : STATUS_SHORT[f.status] ?? "REF";
    out[p.id] = { code: p.id, short: SHORT[p.id] ?? p.name, name: p.name, method: p.method, value, status, target: targets[p.id] ?? null, specStatus: f.status };
  }
  return out;
}
