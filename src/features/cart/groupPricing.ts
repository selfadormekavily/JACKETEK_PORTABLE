import { PRICING } from "./pricing";

/**
 * Group order pricing — a quote for a whole group, computed ONLY by the
 * server (server/groups.mjs, through src/features/production/server.ts).
 * The website shows the server's quote; it never prices a group itself.
 *
 * Volume discounts: NONE ARE ACTIVE. `tiers` is empty on purpose — no
 * discount values have been decided, so none are invented here. Adding
 * tiers later is a data change (and a `version` bump), not a code change.
 *
 * Basis: tiers count JACKETS (the sum of every active item's quantity,
 * from active members), not members — production cost follows the number
 * of jackets made. The quote also reports how many members contribute
 * jackets, so a rule could switch to `basis: "members"` instead.
 *
 * Delivery isn't part of a group quote: how a group is delivered (one
 * address or one per member) is decided at checkout.
 */
export type GroupDiscountBasis = "jackets" | "members";

export type GroupDiscountTier = {
  id: string;
  /** Applies from this many units of `basis` upward. */
  min: number;
  /** 0–1 (0.1 = 10 % off the subtotal). */
  rate: number;
};

export type GroupPricingRules = {
  /** Bumped whenever tiers or basis change: a frozen quote with an older version must be re-quoted. */
  version: number;
  basis: GroupDiscountBasis;
  tiers: readonly GroupDiscountTier[];
};

export const GROUP_PRICING: GroupPricingRules = { version: 1, basis: "jackets", tiers: [] };

/** One active item, as the server counts it. */
export type GroupQuoteLine = { itemId: string; memberId: string; quantity: number };

export type GroupQuote = {
  currency: string;
  rulesVersion: number;
  basis: GroupDiscountBasis;
  totalJackets: number;
  /** Members with at least one active jacket. */
  contributingMembers: number;
  /** null while the jacket price isn't configured. */
  unitPrice: number | null;
  subtotal: number | null;
  tier: { id: string; min: number; rate: number } | null;
  discountRate: number;
  /** null when the subtotal is unknown. */
  discountAmount: number | null;
  total: number | null;
  lines: { itemId: string; memberId: string; quantity: number; unitPrice: number | null; lineTotal: number | null }[];
  /**
   * Each member's share — what that member would pay if members pay
   * individually. The discount is shared out in proportion to each
   * member's subtotal, to the cent (largest remainder), so the shares
   * always add up to the group's discount exactly.
   */
  members: { memberId: string; jackets: number; subtotal: number | null; discountAmount: number | null; total: number | null }[];
};

const cents = (amount: number) => Math.round(amount * 100);

export function quoteGroup(
  lines: readonly GroupQuoteLine[],
  rules: GroupPricingRules = GROUP_PRICING,
  unitPrice: number | null = PRICING.jacketPrice,
  currency: string = PRICING.currency
): GroupQuote {
  const totalJackets = lines.reduce((n, l) => n + l.quantity, 0);
  const byMember = new Map<string, number>();
  for (const l of lines) byMember.set(l.memberId, (byMember.get(l.memberId) ?? 0) + l.quantity);
  const contributingMembers = [...byMember.values()].filter((n) => n > 0).length;

  const count = rules.basis === "members" ? contributingMembers : totalJackets;
  const tier = [...rules.tiers].filter((t) => count >= t.min).sort((a, b) => b.min - a.min)[0] ?? null;
  const discountRate = tier?.rate ?? 0;

  const known = unitPrice !== null;
  const unitCents = known ? cents(unitPrice) : 0;
  const subtotalCents = unitCents * totalJackets;
  const discountCents = Math.round(subtotalCents * discountRate);

  // Discount shares by member, largest remainder, in cents.
  const memberIds = [...byMember.keys()];
  const exact = memberIds.map((id) => (subtotalCents ? (discountCents * unitCents * byMember.get(id)!) / subtotalCents : 0));
  const shares = exact.map(Math.floor);
  let left = discountCents - shares.reduce((a, b) => a + b, 0);
  for (const i of exact.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i)) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }

  const money = (c: number) => (known ? c / 100 : null);
  return {
    currency,
    rulesVersion: rules.version,
    basis: rules.basis,
    totalJackets,
    contributingMembers,
    unitPrice: known ? unitCents / 100 : null,
    subtotal: money(subtotalCents),
    tier: tier ? { id: tier.id, min: tier.min, rate: tier.rate } : null,
    discountRate,
    discountAmount: money(discountCents),
    total: money(subtotalCents - discountCents),
    lines: lines.map((l) => ({ ...l, unitPrice: money(unitCents), lineTotal: money(unitCents * l.quantity) })),
    members: memberIds.map((memberId, i) => {
      const sub = unitCents * byMember.get(memberId)!;
      return { memberId, jackets: byMember.get(memberId)!, subtotal: money(sub), discountAmount: money(shares[i]), total: money(sub - shares[i]) };
    }),
  };
}
