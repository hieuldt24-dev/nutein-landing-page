import {
  CART_QUANTITY_STORAGE_KEY,
  CART_STATE_STORAGE_KEY,
} from "../constants";
import {
  normalizeCartState,
  totalPackQuantity,
} from "../pricing";
import type { CartState } from "../types";

function emptyState(): CartState {
  return { lines: [] };
}

/** Migrate shape cũ `{ quantity, variantId }` → `{ lines }`. */
function coerceState(raw: unknown): CartState {
  if (!raw || typeof raw !== "object") return emptyState();
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.lines)) {
    return normalizeCartState({ lines: obj.lines as CartState["lines"] });
  }

  // Legacy single-line
  const quantity =
    typeof obj.quantity === "number" && Number.isFinite(obj.quantity)
      ? obj.quantity
      : 0;
  const variantId =
    typeof obj.variantId === "string" && obj.variantId.length > 0
      ? obj.variantId
      : undefined;

  if (quantity > 0 && variantId) {
    return normalizeCartState({ lines: [{ variantId, quantity }] });
  }

  return emptyState();
}

function readLegacyQuantity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CART_QUANTITY_STORAGE_KEY);
  if (raw == null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Nguồn dữ liệu giỏ hàng phía client — localStorage (guest + mirror).
 * Logged-in: `useCartStore` ghi `/api/cart` (DB).
 */
export const cartRepository = {
  getState(): CartState {
    if (typeof window === "undefined") {
      return emptyState();
    }

    const raw = window.localStorage.getItem(CART_STATE_STORAGE_KEY);
    if (raw) {
      try {
        return coerceState(JSON.parse(raw));
      } catch {
        // fall through
      }
    }

    const legacyQty = readLegacyQuantity();
    if (legacyQty != null && legacyQty > 0) {
      const migrated = normalizeCartState({
        lines: [{ variantId: "pack-1", quantity: legacyQty }],
      });
      cartRepository.setState(migrated);
      return migrated;
    }

    return emptyState();
  },

  setState(state: CartState): CartState {
    const next = normalizeCartState(state);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CART_STATE_STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(
        CART_QUANTITY_STORAGE_KEY,
        String(totalPackQuantity(next.lines)),
      );
    }
    return next;
  },
};
