import "server-only";

import { buildCartSummary, normalizeCartState } from "../pricing";
import type { CartState, CartSummary } from "../types";
import { cartDbRepository } from "./cart.db.repository";

function summaryFromState(state: CartState): CartSummary {
  return buildCartSummary(state);
}

/** Cart server — `/api/cart` (user đã authenticate). */
export const cartServerService = {
  async getSummary(userId: string): Promise<CartSummary> {
    return summaryFromState(await cartDbRepository.getState(userId));
  },

  async setState(userId: string, state: CartState): Promise<CartSummary> {
    const next = await cartDbRepository.setState(
      userId,
      normalizeCartState(state),
    );
    return summaryFromState(next);
  },

  async clear(userId: string): Promise<void> {
    await cartDbRepository.clear(userId);
  },
};
