/**
 * Pricing — the single place prices come from.
 *
 * CONFIGURE BEFORE LAUNCH: the project has no prices yet, so none are
 * invented here. While a value is `null` the cart and checkout show it
 * as "To be confirmed" (and totals with it), and orders record it as
 * `null` — nothing is ever charged from a guessed number.
 */
export const PRICING = {
  /** ISO 4217 code shown with every amount. */
  currency: "JOD",
  /** Price of one Graduation Jacket (any configuration), or null if not set. */
  jacketPrice: null as number | null,
  /** Flat delivery fee per order, or null if not set. */
  deliveryFee: null as number | null,
};

/** "JOD 45.00": an amount with its currency code (Western digits in every language). */
export function formatAmount(amount: number): string {
  return `${PRICING.currency} ${amount.toFixed(2)}`;
}

/**
 * "JOD 45.00", or the not-yet-set wording, in English (admin). Customer
 * pages show prices through <Price> (components/ui), which localizes the
 * wording and isolates the amount as left-to-right.
 */
export function formatPrice(amount: number | null): string {
  if (amount === null) return "To be confirmed";
  return formatAmount(amount);
}

/** Sum that stays unknown if any part is unknown. */
export function sumKnown(values: (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (v === null) return null;
    total += v;
  }
  return Math.round(total * 100) / 100;
}
