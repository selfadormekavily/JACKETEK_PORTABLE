import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CartContext, type CartContextValue } from "./context";
import { PRICING } from "./pricing";
import { MAX_QUANTITY, PRODUCT, type CartItem } from "./types";

const STORAGE_KEY = "jacketek-cart-v1";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full (large embroidery uploads) or unavailable: keep the
    // cart in memory; try again without the display-only previews.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((i) => ({ ...i, preview: null }))));
    } catch {
      /* in memory only */
    }
  }
}

/**
 * The cart: designed jackets waiting to be ordered. Lives above the
 * routes (so the configurator, cart and checkout share it) and is kept
 * in this browser's storage across reloads.
 */
export default function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);
  useEffect(() => save(items), [items]);

  const add = useCallback<CartContextValue["add"]>(({ config, preview }) => {
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        productId: PRODUCT.id,
        productName: PRODUCT.name,
        // A deep copy: later edits in the configurator never change it.
        config: structuredClone(config),
        quantity: 1,
        unitPrice: PRICING.jacketPrice,
        preview,
        addedAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    const q = Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity)));
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: q } : i)));
  }, []);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({ items, count: items.reduce((n, i) => n + i.quantity, 0), add, setQuantity, remove, clear }),
    [items, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
