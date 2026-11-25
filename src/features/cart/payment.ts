import type { Order } from "./types";

/**
 * Card payments — an isolated slot for a payment provider.
 *
 * TO CONNECT: no provider is configured in this project. Implement this
 * interface with the provider's hosted fields / redirect (so card numbers
 * never touch this site's code or storage) and assign it to
 * CARD_PROVIDER. Until then the checkout offers Card / Visa but explains
 * it isn't available and doesn't let the order through with it.
 */
export type CardPaymentProvider = {
  name: string;
  /** Mounts the provider's card fields inside `container`. Returns an unmount. */
  mount: (container: HTMLElement) => () => void;
  /**
   * Takes payment for a created order (e.g. confirms the provider's
   * payment intent). Resolves only when the provider reports success.
   */
  pay: (order: Order) => Promise<{ paymentId: string }>;
};

export const CARD_PROVIDER: CardPaymentProvider | null = null;
