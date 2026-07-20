import {
  CART_LOCAL_LATENCY_MS,
  MIN_CART_QUANTITY,
} from "../constants";
import { buildCartSummary } from "../pricing";
import type { CartState, CartSummary } from "../types";
import { cartRepository } from "./cart.repository";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function summaryFromState(state: CartState): CartSummary {
  return buildCartSummary(state.quantity, undefined, undefined, state.variantId);
}

/**
 * Business logic giỏ hàng single-SKU — mutate qua repository.
 * Pure calc nằm ở `features/cart/pricing.ts` (checkout cũng import được).
 */
export const cartService = {
  buildSummary: buildCartSummary,

  async getSummary(): Promise<CartSummary> {
    await delay(CART_LOCAL_LATENCY_MS);
    return summaryFromState(cartRepository.getState());
  },

  async setState(state: CartState): Promise<CartSummary> {
    await delay(CART_LOCAL_LATENCY_MS);
    const next = cartRepository.setState(state);
    return summaryFromState(next);
  },

  async setQuantity(quantity: number): Promise<CartSummary> {
    const { variantId } = cartRepository.getState();
    return cartService.setState({ quantity, variantId });
  },

  async setVariant(variantId: string): Promise<CartSummary> {
    const { quantity } = cartRepository.getState();
    return cartService.setState({ quantity, variantId });
  },

  async add(amount: number = 1, variantId?: string): Promise<CartSummary> {
    const current = cartRepository.getState();
    return cartService.setState({
      quantity: current.quantity + amount,
      variantId: variantId ?? current.variantId,
    });
  },

  async increment(): Promise<CartSummary> {
    const { quantity, variantId } = cartRepository.getState();
    return cartService.setState({ quantity: quantity + 1, variantId });
  },

  async decrement(): Promise<CartSummary> {
    const { quantity, variantId } = cartRepository.getState();
    return cartService.setState({ quantity: quantity - 1, variantId });
  },

  async remove(): Promise<CartSummary> {
    const { variantId } = cartRepository.getState();
    return cartService.setState({ quantity: MIN_CART_QUANTITY, variantId });
  },
};
