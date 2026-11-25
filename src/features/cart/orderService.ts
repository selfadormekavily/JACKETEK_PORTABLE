import type { Order } from "./types";

/**
 * Where orders go: the JACKETEK server (server/index.mjs), which checks
 * the order, gives it its ID, prices and date, and stores it — with each
 * jacket's complete customisation — for the admin.
 *
 * The server never shows an order back to the public; so the
 * confirmation page reads the copy kept on this device after placing it.
 */
const PLACED_KEY = "jacketek-placed-orders-v1";

/**
 * Why an order couldn't be placed, for the checkout to word in the
 * customer's language: the server couldn't be reached, or it refused the
 * order (with its own English message, if it gave one). `message` keeps
 * the English wording.
 */
export class OrderSubmitError extends Error {
  constructor(
    readonly reason: "network" | "rejected",
    message: string,
    readonly serverMessage: string | null = null
  ) {
    super(message);
    this.name = "OrderSubmitError";
  }
}

export async function submitOrder(order: Order): Promise<Order> {
  let res: Response;
  try {
    res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: order.items, customer: order.customer, delivery: order.delivery, payment: order.payment }),
    });
  } catch {
    throw new OrderSubmitError("network", "We couldn't reach our server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as { order?: Order; error?: string } | null;
  if (!res.ok || !body?.order)
    throw new OrderSubmitError("rejected", body?.error ?? "Your order couldn't be placed. Please try again.", body?.error ?? null);
  rememberPlaced(body.order);
  return body.order;
}

/** The confirmation's copy of a just-placed order (this device only). */
export async function getOrder(orderId: string): Promise<Order | null> {
  return readPlaced().find((o) => o.id === orderId) ?? null;
}

function readPlaced(): Order[] {
  try {
    const raw = localStorage.getItem(PLACED_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

function rememberPlaced(order: Order) {
  // Without the design data: the confirmation only shows a summary.
  const copy: Order = { ...order, items: order.items.map((i) => ({ ...i, customization: { ...i.customization, embroidery: [] } })) };
  try {
    localStorage.setItem(PLACED_KEY, JSON.stringify([copy, ...readPlaced().filter((o) => o.id !== order.id)].slice(0, 5)));
  } catch {
    /* the confirmation still gets the order via navigation state */
  }
}
