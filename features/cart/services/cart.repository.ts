import {
  CART_QUANTITY_STORAGE_KEY,
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
} from "../constants";
import type { CartState } from "../types";

function clampQuantity(value: number): number {
  return Math.min(MAX_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, value));
}

/**
 * Nguồn dữ liệu giỏ hàng phía client — hiện persist localStorage.
 * Khi có API: đổi thân `getState`/`setState` sang `fetch('/api/cart')`,
 * giữ nguyên chữ ký để service/UI không đổi.
 */
export const cartRepository = {
  getState(): CartState {
    if (typeof window === "undefined") {
      return { quantity: MIN_CART_QUANTITY };
    }

    const raw = window.localStorage.getItem(CART_QUANTITY_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : MIN_CART_QUANTITY;
    const quantity = Number.isFinite(parsed) ? clampQuantity(parsed) : MIN_CART_QUANTITY;
    return { quantity };
  },

  setState(state: CartState): CartState {
    const next: CartState = { quantity: clampQuantity(state.quantity) };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CART_QUANTITY_STORAGE_KEY, String(next.quantity));
    }
    return next;
  },
};
