import type { JacketConfig } from "@/features/configurator";

/** The one product sold today. */
export const PRODUCT = { id: "graduation-jacket", name: "Graduation Jacket" } as const;

/** Jackets per cart line. */
export const MAX_QUANTITY = 99;

/**
 * A designed jacket in the cart. `config` is the configurator's complete
 * design, copied at the moment it was added — the full customisation
 * (colours, materials, buttons, zipper, every embroidery element with
 * its text/image, placement, offset, rotation, scale and thread, size,
 * fit), never a summary.
 */
export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  config: JacketConfig;
  quantity: number;
  /** Unit price when added (null while prices aren't configured). */
  unitPrice: number | null;
  /** A small image of the jacket as designed (display only; not part of orders). */
  preview: string | null;
  addedAt: string;
};

export type PaymentMethod = "cod" | "card";

export type CustomerDetails = {
  fullName: string;
  phone: string;
};

export type DeliveryDetails = {
  city: string;
  area: string;
  address: string;
  notes: string;
};

/**
 * An order, as submitted. Each line carries the complete customisation
 * JSON (`customization`), for production (e.g. the drawing PDF).
 */
export type Order = {
  id: string;
  createdAt: string;
  status: "pending";
  items: {
    productId: string;
    productName: string;
    size: string | null;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    customization: JacketConfig;
  }[];
  pricing: {
    currency: string;
    subtotal: number | null;
    delivery: number | null;
    total: number | null;
  };
  customer: CustomerDetails;
  delivery: DeliveryDetails;
  payment: {
    method: PaymentMethod;
    /** Cash on delivery is collected later; card would be set by the provider. */
    status: "due-on-delivery" | "pending";
  };
};
