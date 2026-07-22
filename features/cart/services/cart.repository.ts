import {
  CART_QUANTITY_STORAGE_KEY,
  CART_STATE_STORAGE_KEY,
} from "../constants";
import { normalizeCartState } from "../pricing";
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
 * Legacy localStorage — chỉ đọc/xoá one-shot migrate sang session API.
 * Không còn source of truth cho giỏ.
 */
export const cartRepository = {
  /** Đọc giỏ local cũ (nếu còn) để PUT lên `/api/cart` một lần. */
  readLegacyState(): CartState {
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
      return normalizeCartState({
        lines: [{ variantId: "pack-1", quantity: legacyQty }],
      });
    }

    return emptyState();
  },

  clearLegacy(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(CART_STATE_STORAGE_KEY);
    window.localStorage.removeItem(CART_QUANTITY_STORAGE_KEY);
  },
};
