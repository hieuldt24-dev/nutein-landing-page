import {
  CART_LOCAL_LATENCY_MS,
  MIN_CART_QUANTITY,
} from "../constants";
import { buildCartSummary } from "../pricing";
import type { CartSummary } from "../types";
import { cartRepository } from "./cart.repository";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Business logic giỏ hàng single-SKU — mutate qua repository.
 * Pure calc nằm ở `features/cart/pricing.ts` (checkout cũng import được).
 */
export const cartService = {
  buildSummary: buildCartSummary,

  async getSummary(): Promise<CartSummary> {
    await delay(CART_LOCAL_LATENCY_MS);
    const { quantity } = cartRepository.getState();
    return buildCartSummary(quantity);
  },

  async setQuantity(quantity: number): Promise<CartSummary> {
    await delay(CART_LOCAL_LATENCY_MS);
    const { quantity: next } = cartRepository.setState({ quantity });
    return buildCartSummary(next);
  },

  async add(amount: number = 1): Promise<CartSummary> {
    const { quantity } = cartRepository.getState();
    return cartService.setQuantity(quantity + amount);
  },

  async increment(): Promise<CartSummary> {
    const { quantity } = cartRepository.getState();
    return cartService.setQuantity(quantity + 1);
  },

  async decrement(): Promise<CartSummary> {
    const { quantity } = cartRepository.getState();
    return cartService.setQuantity(quantity - 1);
  },

  async remove(): Promise<CartSummary> {
    return cartService.setQuantity(MIN_CART_QUANTITY);
  },
};
