import {
  CART_QUANTITY_STORAGE_KEY,
  CART_STATE_STORAGE_KEY,
} from "../constants";
import { normalizeCartState } from "../pricing";
import type { CartState } from "../types";

function emptyState(): CartState {
  return { lines: [] };
}

/** Coerce shape cũ `{ quantity, variantId }` → `{ lines }` — dữ liệu tồn đọng
 *  từ trước khi có multi-line theo gói. */
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
 * localStorage — nguồn thật duy nhất của giỏ hàng (không còn DB/API, dùng
 * chung cho guest lẫn logged-in trong cùng trình duyệt). `coerceState` +
 * `readLegacyQuantity` xử lý 2 shape cũ hơn để không mất giỏ của user cũ
 * khi deploy bản này.
 */
export const cartRepository = {
  readState(): CartState {
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

  /** Ghi đè toàn bộ giỏ — đồng bộ, không network. */
  writeState(state: CartState): CartState {
    const next = normalizeCartState(state);
    if (typeof window === "undefined") {
      return next;
    }
    try {
      window.localStorage.setItem(CART_STATE_STORAGE_KEY, JSON.stringify(next));
      window.localStorage.removeItem(CART_QUANTITY_STORAGE_KEY);
    } catch {
      // Storage đầy / bị chặn (Safari private mode cũ) — bỏ qua, SWR cache
      // vẫn đúng cho phiên hiện tại, chỉ mất persist.
    }
    return next;
  },
};
