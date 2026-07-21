import { CART_LOCAL_LATENCY_MS } from "../constants";
import {
  addToCartLines,
  buildCartSummary,
  normalizeCartState,
  setLineQuantityInCart,
} from "../pricing";
import type { CartState, CartSummary } from "../types";
import { cartRepository } from "./cart.repository";
import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function summaryFromState(state: CartState): CartSummary {
  return buildCartSummary(state);
}

/**
 * Business logic giỏ — multi-line theo gói (pack-1/3/6).
 * Pure calc ở `features/cart/pricing.ts`.
 */
export const cartService = {
  buildSummary: buildCartSummary,

  async getSummary(): Promise<CartSummary> {
    await delay(CART_LOCAL_LATENCY_MS);
    return summaryFromState(cartRepository.getState());
  },

  async setState(state: CartState): Promise<CartSummary> {
    await delay(CART_LOCAL_LATENCY_MS);
    const next = cartRepository.setState(normalizeCartState(state));
    return summaryFromState(next);
  },

  async add(
    amount: number = 1,
    variantId: string = DEFAULT_PRODUCT_VARIANT_ID,
  ): Promise<CartSummary> {
    const current = cartRepository.getState();
    return cartService.setState({
      lines: addToCartLines(current.lines, amount, variantId),
    });
  },

  async setLineQuantity(
    variantId: string,
    quantity: number,
  ): Promise<CartSummary> {
    const current = cartRepository.getState();
    return cartService.setState({
      lines: setLineQuantityInCart(current.lines, variantId, quantity),
    });
  },

  async increment(variantId: string): Promise<CartSummary> {
    const current = cartRepository.getState();
    const line = current.lines.find((l) => l.variantId === variantId);
    const qty = (line?.quantity ?? 0) + 1;
    return cartService.setLineQuantity(variantId, qty);
  },

  async decrement(variantId: string): Promise<CartSummary> {
    const current = cartRepository.getState();
    const line = current.lines.find((l) => l.variantId === variantId);
    const qty = (line?.quantity ?? 0) - 1;
    return cartService.setLineQuantity(variantId, qty);
  },

  async removeLine(variantId: string): Promise<CartSummary> {
    return cartService.setLineQuantity(variantId, 0);
  },

  async clear(): Promise<CartSummary> {
    return cartService.setState({ lines: [] });
  },
};
