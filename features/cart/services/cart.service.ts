import { buildCartSummary } from "../pricing";

/**
 * Pure helpers giỏ phía client — persist qua `/api/cart` (session/user DB).
 * Không còn delay giả / localStorage mutate.
 */
export const cartService = {
  buildSummary: buildCartSummary,
};
