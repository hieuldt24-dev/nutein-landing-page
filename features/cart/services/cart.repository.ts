import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";
import {
  CART_QUANTITY_STORAGE_KEY,
  CART_STATE_STORAGE_KEY,
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
} from "../constants";
import type { CartState } from "../types";

function clampQuantity(value: number): number {
  return Math.min(MAX_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, value));
}

function emptyState(): CartState {
  return { quantity: MIN_CART_QUANTITY, variantId: DEFAULT_PRODUCT_VARIANT_ID };
}

function normalizeState(partial: Partial<CartState>): CartState {
  return {
    quantity: clampQuantity(
      typeof partial.quantity === "number" && Number.isFinite(partial.quantity)
        ? partial.quantity
        : MIN_CART_QUANTITY
    ),
    variantId:
      typeof partial.variantId === "string" && partial.variantId.length > 0
        ? partial.variantId
        : DEFAULT_PRODUCT_VARIANT_ID,
  };
}

function readLegacyQuantity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CART_QUANTITY_STORAGE_KEY);
  if (raw == null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clampQuantity(parsed) : null;
}

/**
 * Nguồn dữ liệu giỏ hàng phía client — hiện persist localStorage (JSON state).
 * Khi có API: đổi thân `getState`/`setState` sang `fetch('/api/cart')`,
 * giữ nguyên chữ ký để service/UI không đổi.
 */
export const cartRepository = {
  getState(): CartState {
    if (typeof window === "undefined") {
      return emptyState();
    }

    const raw = window.localStorage.getItem(CART_STATE_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<CartState>;
        return normalizeState(parsed);
      } catch {
        // fall through to legacy / empty
      }
    }

    const legacyQty = readLegacyQuantity();
    if (legacyQty != null) {
      const migrated = normalizeState({ quantity: legacyQty });
      cartRepository.setState(migrated);
      return migrated;
    }

    return emptyState();
  },

  setState(state: CartState): CartState {
    const next = normalizeState(state);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CART_STATE_STORAGE_KEY, JSON.stringify(next));
      // Giữ key legacy đồng bộ quantity — tránh lệch nếu code cũ còn đọc.
      window.localStorage.setItem(CART_QUANTITY_STORAGE_KEY, String(next.quantity));
    }
    return next;
  },
};
