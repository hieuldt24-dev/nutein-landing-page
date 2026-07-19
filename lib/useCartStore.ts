"use client";

import { useCallback, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  CART_QUANTITY_SWR_KEY,
  CART_UPDATING_SWR_KEY,
  MIN_CART_QUANTITY,
} from "@/features/cart/constants";
import { cartRepository } from "@/features/cart/services/cart.repository";
import { cartService } from "@/features/cart/services/cart.service";
import type { CartSummary } from "@/features/cart/types";

/**
 * Global UI state giỏ hàng — SWR-as-store (docs/state-management.md mục 3 + 7).
 * Persist/mutate đi qua cartRepository + cartService; hook không đụng localStorage trực tiếp.
 */
export function useCartStore() {
  const { mutate } = useSWRConfig();
  const inFlightRef = useRef(false);

  const { data: quantity } = useSWR(
    CART_QUANTITY_SWR_KEY,
    () => cartRepository.getState().quantity,
    {
      fallbackData: MIN_CART_QUANTITY,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const { data: isUpdating } = useSWR(CART_UPDATING_SWR_KEY, () => false, {
    fallbackData: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const currentQuantity = quantity ?? MIN_CART_QUANTITY;
  const summary = cartService.buildSummary(currentQuantity);

  const runMutation = useCallback(
    async (action: () => Promise<CartSummary>) => {
      if (inFlightRef.current) {
        return cartService.buildSummary(cartRepository.getState().quantity);
      }

      inFlightRef.current = true;
      await mutate(CART_UPDATING_SWR_KEY, true, { revalidate: false });
      try {
        const next = await action();
        await mutate(CART_QUANTITY_SWR_KEY, next.quantity, { revalidate: false });
        return next;
      } finally {
        inFlightRef.current = false;
        await mutate(CART_UPDATING_SWR_KEY, false, { revalidate: false });
      }
    },
    [mutate]
  );

  return {
    quantity: currentQuantity,
    summary,
    isEmpty: summary.isEmpty,
    isUpdating: Boolean(isUpdating),
    setQuantity: (next: number) => runMutation(() => cartService.setQuantity(next)),
    increment: () => runMutation(() => cartService.increment()),
    decrement: () => runMutation(() => cartService.decrement()),
    addToCart: (amount: number = 1) => runMutation(() => cartService.add(amount)),
    removeFromCart: () => runMutation(() => cartService.remove()),
  };
}
