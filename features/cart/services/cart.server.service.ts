import "server-only";

import { buildCartSummary, normalizeCartState } from "../pricing";
import type { CartOwner, CartState, CartSummary } from "../types";
import { cartDbRepository } from "./cart.db.repository";

function summaryFromState(state: CartState): CartSummary {
  return buildCartSummary(state);
}

function userOwner(userId: string): CartOwner {
  return { kind: "user", userId };
}

function sessionOwner(sessionId: string): CartOwner {
  return { kind: "session", sessionId };
}

/**
 * Cart server — `/api/cart`.
 * Guest: session cookie. Logged-in: user rows + mirror session (logout giữ giỏ).
 */
export const cartServerService = {
  async getSummary(owner: CartOwner): Promise<CartSummary> {
    return summaryFromState(await cartDbRepository.getState(owner));
  },

  async setState(owner: CartOwner, state: CartState): Promise<CartSummary> {
    const next = await cartDbRepository.setState(
      owner,
      normalizeCartState(state),
    );
    return summaryFromState(next);
  },

  /**
   * Logged-in mutate: ghi user + mirror session (Joy Rush logout giữ giỏ).
   */
  async setStateForLoggedIn(
    userId: string,
    sessionId: string,
    state: CartState,
  ): Promise<CartSummary> {
    const normalized = normalizeCartState(state);
    await cartDbRepository.setState(userOwner(userId), normalized);
    await cartDbRepository.setState(sessionOwner(sessionId), normalized);
    return summaryFromState(normalized);
  },

  /**
   * Joy Rush merge khi có JWT + session:
   * 1) User non-empty → replace session = user (discard guest)
   * 2) User empty + session non-empty → copy session → user
   * 3) Cả hai empty → noop
   */
  async mergeOnLogin(
    userId: string,
    sessionId: string,
  ): Promise<CartSummary> {
    const userState = await cartDbRepository.getState(userOwner(userId));
    const sessionState = await cartDbRepository.getState(
      sessionOwner(sessionId),
    );

    const userHas = userState.lines.length > 0;
    const sessionHas = sessionState.lines.length > 0;

    if (userHas) {
      await cartDbRepository.setState(sessionOwner(sessionId), userState);
      return summaryFromState(userState);
    }

    if (sessionHas) {
      await cartDbRepository.setState(userOwner(userId), sessionState);
      return summaryFromState(sessionState);
    }

    return summaryFromState(userState);
  },

  async clear(userId: string): Promise<void> {
    await cartDbRepository.clear(userOwner(userId));
  },

  /** Clear user + session sau đặt hàng (tránh logout còn hàng cũ). */
  async clearUserAndSession(
    userId: string,
    sessionId: string | null,
  ): Promise<void> {
    await cartDbRepository.clear(userOwner(userId));
    if (sessionId) {
      await cartDbRepository.clear(sessionOwner(sessionId));
    }
  },
};
