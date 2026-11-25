import type { JacketConfig } from "@/features/configurator/model/types";
import { idbDelete, idbGet, idbSet } from "@/lib/idb";

/**
 * The integration boundary between Add to Cart and authentication. When a
 * signed-out customer presses Add to Cart, the exact jacket they're adding
 * (design + its still) waits here while they log in or sign up; the auth
 * page then hands it to the cart. Kept in IndexedDB (artwork can be large),
 * for at most a day, and never alongside any account data.
 */
const KEY = "pending-add-to-cart-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingAdd = { config: JacketConfig; preview: string | null };
type Stored = PendingAdd & { version: 1; savedAt: number };

export const savePendingAdd = (item: PendingAdd) =>
  idbSet(KEY, { version: 1, savedAt: Date.now(), config: item.config, preview: item.preview } satisfies Stored);

/** The waiting item, without removing it (for showing it on the auth page). */
export async function peekPendingAdd(): Promise<PendingAdd | null> {
  const stored = await idbGet<Stored>(KEY);
  if (!stored || stored.version !== 1 || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
  return { config: stored.config, preview: stored.preview };
}

/** The waiting item, removed so it's added to the cart exactly once. */
export async function takePendingAdd(): Promise<PendingAdd | null> {
  const item = await peekPendingAdd();
  await idbDelete(KEY);
  return item;
}
