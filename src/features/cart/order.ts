import { PRICING, sumKnown } from "./pricing";
import type { CartItem, CustomerDetails, DeliveryDetails, Order, PaymentMethod } from "./types";

/** Cart totals (unknown while any price isn't configured). */
export function cartTotals(items: CartItem[]) {
  const subtotal = sumKnown(items.map((i) => (i.unitPrice === null ? null : i.unitPrice * i.quantity)));
  const delivery = items.length ? PRICING.deliveryFee : 0;
  return { subtotal, delivery, total: sumKnown([subtotal, delivery]) };
}

/** A short, readable order number: JK-<time><random>. */
function newOrderId() {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JK-${time}${rand}`;
}

/**
 * Builds the order from the cart and the checkout form. Every line keeps
 * its complete customisation (a deep copy of the configurator's design).
 */
export function buildOrder(
  items: CartItem[],
  customer: CustomerDetails,
  delivery: DeliveryDetails,
  method: PaymentMethod
): Order {
  const totals = cartTotals(items);
  return {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    status: "pending",
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      size: i.config.size,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice === null ? null : Math.round(i.unitPrice * i.quantity * 100) / 100,
      customization: structuredClone(i.config),
    })),
    pricing: { currency: PRICING.currency, ...totals },
    customer: { fullName: customer.fullName.trim(), phone: customer.phone.trim() },
    delivery: {
      city: delivery.city.trim(),
      area: delivery.area.trim(),
      address: delivery.address.trim(),
      notes: delivery.notes.trim(),
    },
    payment: { method, status: method === "cod" ? "due-on-delivery" : "pending" },
  };
}
