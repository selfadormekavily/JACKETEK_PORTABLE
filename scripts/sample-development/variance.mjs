#!/usr/bin/env node
// M SAMPLE VARIANCE — compares a returned M sample (m-sample-return-form, filled by the factory)
// with the MSR measurement sheet. JACKETEK-side tool.
//
//   node scripts/sample-development/variance.mjs <returned-form.json> [--request <m-sample-request.json>] [--out <report.json>]
//
// Actual − target is reported against the provisional range (each end, the midpoint, and how far
// outside the nearest end). No tolerance is approved, so nothing is PASSED or FAILED:
//   WITHIN_TARGET_RANGE · OUTSIDE_TARGET_RANGE · REFERENCE_ONLY · NO_TARGET · REVIEW_REQUIRED
// Every result still needs JACKETEK's decision; no status here means approval.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { VARIANCE_STATUS as S } from "./request.mjs";

const r1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One measurement-sheet row against the factory's returned values. */
export function varianceFor(row, returned = {}) {
  const actual = num(returned.sampleActual);
  const pattern = num(returned.patternProposed);
  const base = {
    id: row.id,
    pomId: row.pomId,
    sampleActual: actual,
    patternProposed: pattern,
    actualMinusPatternProposed: actual !== null && pattern !== null ? r1(actual - pattern) : null,
    tolerance: "TBD — no tolerance approved; no pass / fail",
    decision: "JACKETEK TO APPROVE AFTER SAMPLE",
  };
  if (row.role === "ALTERNATIVE" || row.role === "COMPARISON") return { ...base, status: S.REFERENCE };
  if (row.role === "CALCULATED" || row.role === "PATTERN_ONLY") return { ...base, status: S.NONE };
  if (actual === null) return { ...base, status: S.REVIEW, reason: "No sample actual returned." };
  if (!row.target) return { ...base, status: S.NONE };
  const { min, max } = row.target;
  const outsideBy = actual < min ? actual - min : actual > max ? actual - max : 0;
  return {
    ...base,
    ...(row.derived ? { derived: { name: row.derived.name, formula: row.derived.formula, value: r1(actual * 2), measured: false } } : {}),
    target: { min, max, status: row.target.status, confidence: row.target.confidence },
    actualMinusMin: r1(actual - min),
    actualMinusMax: r1(actual - max),
    actualMinusMid: r1(actual - (min + max) / 2),
    outsideBy: r1(outsideBy),
    outsideByPct: r1((outsideBy / (outsideBy < 0 ? min : max)) * 100),
    status: outsideBy === 0 ? S.WITHIN : S.OUTSIDE,
  };
}

/** Every row of the sheet; returned values matched by row id. */
export function varianceReport(request, returnForm) {
  const byId = new Map((returnForm.measurements ?? []).map((m) => [m.id, m]));
  const rows = request.measurementSheet.map((row) => varianceFor(row, byId.get(row.id)));
  const counts = Object.fromEntries(Object.values(S).map((s) => [s, rows.filter((x) => x.status === s).length]));
  return {
    request: request.revision,
    factory: returnForm.factory ?? null,
    note: "Variance only. No tolerance is approved, so no row passes or fails; JACKETEK decides per row.",
    counts,
    rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const file = args.find((a) => !a.startsWith("--") && a !== opt("--request") && a !== opt("--out"));
  if (!file) {
    console.error("usage: node scripts/sample-development/variance.mjs <returned-form.json> [--request <m-sample-request.json>] [--out <report.json>]");
    process.exit(2);
  }
  const request = JSON.parse(readFileSync(resolve(opt("--request", "garment-spec/sample-development/m-sample-request-MSR-01.json")), "utf8"));
  const report = varianceReport(request, JSON.parse(readFileSync(resolve(file), "utf8")));
  const out = opt("--out", null);
  if (out) writeFileSync(resolve(out), `${JSON.stringify(report, null, 2)}\n`);
  else console.log(JSON.stringify(report, null, 2));
}
