/**
 * PROVENANCE — every manufacturing value in a Manufacturing Spec says where
 * it came from and whether it is approved. One list of statuses, used by the
 * builder, the validator and the PDF; nothing else may invent a status.
 *
 * An unknown is `value: null` with an explicit status — never 0, never a
 * placeholder number, never an "industry average".
 */

export const STATUSES = [
  /** Published by a verified reference source (e.g. Golden Bear Classic M). A reference, not a JACKETEK approval. */
  "VERIFIED_SOURCE",
  /** Calculated only from verified source values (e.g. base + published grade). */
  "DERIVED_FROM_VERIFIED_SOURCE",
  /** M-only visual benchmark; source/method not verified. Never a spec value. */
  "SECONDARY_VISUAL_REFERENCE",
  /** A target range or value awaiting physical sample approval. */
  "PROVISIONAL_TARGET",
  /** Chosen by the customer in the configurator. */
  "CUSTOMER_SELECTED",
  /** Computed by JACKETEK software from other data (IDs, configurator geometry). Not a physical measurement. */
  "SYSTEM_DERIVED",
  /** Has to be measured on the physical sample. */
  "TO_MEASURE_ON_SAMPLE",
  /** A pattern-maker decision. */
  "TBD_PATTERN_MAKER",
  /** The supplier is asked to propose it. */
  "TBD_SUPPLIER_PROPOSAL",
  /** Approved for bulk production. Never produced automatically. */
  "APPROVED_PRODUCTION",
  /** Not known; whether it applies may itself be undecided. */
  "UNKNOWN",
] as const;

export type Status = (typeof STATUSES)[number];

/** Statuses that may carry a value. Every other status must have `value: null`. */
export const VALUE_STATUSES: readonly Status[] = [
  "VERIFIED_SOURCE",
  "DERIVED_FROM_VERIFIED_SOURCE",
  "SECONDARY_VISUAL_REFERENCE",
  "PROVISIONAL_TARGET",
  "CUSTOMER_SELECTED",
  "SYSTEM_DERIVED",
  "APPROVED_PRODUCTION",
];

/** Statuses that mean "nobody knows this yet": always printed as TBD in the PDF. */
export const OPEN_STATUSES: readonly Status[] = ["TO_MEASURE_ON_SAMPLE", "TBD_PATTERN_MAKER", "TBD_SUPPLIER_PROPOSAL", "UNKNOWN"];

/** How each open status reads in a factory document. */
export const OPEN_WORDING: Record<string, string> = {
  TO_MEASURE_ON_SAMPLE: "TBD — to be confirmed on sample",
  TBD_PATTERN_MAKER: "TBD — pattern maker",
  TBD_SUPPLIER_PROPOSAL: "TBD — supplier proposal required",
  UNKNOWN: "TBD — unknown",
};

/** A value with its provenance. `approved` is true only for APPROVED_PRODUCTION (never in an RFQ). */
export type Field<T> = {
  value: T | null;
  unit: string | null;
  status: Status;
  /** Where the value comes from (null when there is none). */
  source: string | null;
  approved: boolean;
  /** A range instead of a single value (e.g. a provisional target). */
  range?: [number, number];
  /** The value exactly as the source published it, when its unit differs (e.g. inches). */
  sourceValue?: { value: number; unit: string; text?: string };
  /** Decimal places the value is meaningful to (display precision). */
  precision?: number;
  note?: string;
};

type Extra = Pick<Field<unknown>, "range" | "sourceValue" | "precision" | "note">;

/** A known value. */
export function known<T>(value: T, status: Status, source: string, unit: string | null = null, extra: Extra = {}): Field<T> {
  if (!VALUE_STATUSES.includes(status)) throw new Error(`Status ${status} cannot carry a value`);
  if (status === "APPROVED_PRODUCTION") throw new Error("APPROVED_PRODUCTION is never set automatically");
  return { value, unit, status, source, approved: false, ...extra };
}

/** An unknown value: null, with the status saying who resolves it. */
export function open<T>(status: Status, unit: string | null = null, note?: string, source: string | null = null): Field<T> {
  if (VALUE_STATUSES.includes(status) && status !== "PROVISIONAL_TARGET") throw new Error(`Status ${status} needs a value`);
  return { value: null, unit, status, source, approved: false, ...(note ? { note } : {}) };
}

/** A provisional target range (value stays null: a range is not a spec value). */
export function targetRange(range: [number, number], unit: string, source: string, note?: string): Field<number> {
  return { value: null, unit, status: "PROVISIONAL_TARGET", source, approved: false, range, ...(note ? { note } : {}) };
}

export const isOpen = (f: Pick<Field<unknown>, "status">) => OPEN_STATUSES.includes(f.status);

/** Rounds to the field's meaningful precision (for display only; JSON keeps the exact value). */
export const roundTo = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
