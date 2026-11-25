// The selected size's development measurements, read from the approved development size chart
// (garment-spec/jacketek-development-size-chart-v0.1.json — APPROVED FOR DEVELOPMENT USE, NOT
// PRODUCTION APPROVED). Values are taken from the chart as they are; nothing is recomputed here.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SIZE_CHART_FILE = "garment-spec/jacketek-development-size-chart-v0.1.json";

/** How each chart row is presented in a development tech pack. */
export const PRESENTATION = {
  B01: { group: "DEVELOPMENT TARGET", note: "Flat width only, 2.54 cm below the armhole point." },
  "B01-C": { group: "DERIVED DEVELOPMENT VALUE", note: "B01 × 2 — derived, never measured separately." },
  B06: { group: "DEVELOPMENT TARGET", note: "Collar seam at CB → finished waistband edge." },
  "SC-1": { group: "DEVELOPMENT TARGET", note: "JACKETEK dropped-shoulder development rule, per side." },
  B09: { group: "DERIVED DEVELOPMENT VALUE", note: "Golden Bear (size) + 2 × SC-1." },
  "S02-E": { group: "DERIVED DEVELOPMENT VALUE", note: "Golden Bear centre-back sleeve − ½ × B09." },
  S02: { group: "PATTERN MAKER SET", note: "Formula only: S02-E − S09 (S09 cuff rib height, pattern maker)." },
  B03: { group: "DERIVED DEVELOPMENT VALUE", note: "= B01 (straight body before rib contraction)." },
  S01: { group: "REFERENCE ONLY", note: "Centre back → finished cuff edge; comparison only, never a JACKETEK target." },
};
const ORDER = ["B01", "B01-C", "B06", "SC-1", "B09", "S02-E", "S02", "B03", "S01"];

let chart = null;
export function developmentChart() {
  chart ??= JSON.parse(readFileSync(join(ROOT, SIZE_CHART_FILE), "utf8"));
  return chart;
}

/** The development measurements of one size (the configurator's selected size), as stated in the chart. */
export function developmentMeasurements(size) {
  const c = developmentChart();
  if (!c.sizes.includes(size)) throw new Error(`Size "${size}" is not in the development size chart (${c.sizes.join(", ")}).`);
  if (c.productionApproved !== false) throw new Error("The development size chart must not be production approved.");
  const rows = ORDER.map((id) => {
    const r = c.table.find((x) => x.id === id);
    if (!r) throw new Error(`Development size chart: row ${id} is missing.`);
    return {
      id,
      name: r.name,
      group: PRESENTATION[id].group,
      chartClass: r.class,
      value: r.bySize[size],
      unit: "cm",
      formula: r.formula,
      note: PRESENTATION[id].note,
      gradePerSizeCm: r.gradePerSizeCm,
    };
  });
  return {
    source: SIZE_CHART_FILE,
    chartVersion: c.version,
    status: c.status,
    productionApproved: false,
    selectedSize: size,
    anchorSize: c.anchorSize,
    rows,
    fullTable: c.table.map((r) => ({ id: r.id, name: r.name, class: r.class, label: r.label, bySize: r.bySize })),
    sizes: c.sizes,
    patternMaker: c.patternMaker,
    sourceHierarchy: c.sourceHierarchy,
  };
}
