import { createContext, useContext } from "react";
import type { JacketConfig } from "@/features/configurator";
import type { CartItem } from "./types";

export type CartContextValue = {
  items: CartItem[];
  /** Total number of jackets (quantities summed). */
  count: number;
  /** Adds a designed jacket (its config is copied, never shared). */
  add: (design: { config: JacketConfig; preview: string | null }) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>.");
  return value;
}
