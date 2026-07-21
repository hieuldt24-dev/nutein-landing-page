"use client";

import { useCallback, useEffect, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  CART_API_PATH,
  CART_LINES_SWR_KEY,
  CART_UPDATING_SWR_KEY,
  MIN_CART_QUANTITY,
} from "@/features/cart/constants";
import {
  addToCartLines,
  buildCartSummary,
  normalizeCartState,
  setLineQuantityInCart,
} from "@/features/cart/pricing";
import { cartRepository } from "@/features/cart/services/cart.repository";
import { cartService } from "@/features/cart/services/cart.service";
import type { CartLine, CartState, CartSummary } from "@/features/cart/types";
import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Hydrate DB cart — module-level (không per-hook-instance).
 */
let hydratePromise: Promise<CartSummary | null> | null = null;
let hydrateLoggedIn = false;

async function hydrateCartOnce(
  syncFromSummary: (next: CartSummary) => Promise<CartSummary>,
  persistRemote: (state: CartState) => Promise<CartSummary>,
): Promise<CartSummary | null> {
  if (hydrateLoggedIn) {
    return summaryFromRepo();
  }
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const remote = await apiRequest<CartSummary>(CART_API_PATH);
      const local = cartRepository.getState();
      if (remote.isEmpty && local.lines.length > 0) {
        const merged = await persistRemote(local);
        await syncFromSummary(merged);
        hydrateLoggedIn = true;
        return merged;
      }
      await syncFromSummary(remote);
      hydrateLoggedIn = true;
      return remote;
    } catch {
      hydratePromise = null;
      return null;
    }
  })();

  return hydratePromise;
}

function resetCartHydration() {
  hydrateLoggedIn = false;
  hydratePromise = null;
}

/**
 * Global UI state giỏ hàng — multi-line theo gói.
 * Guest: localStorage. Logged-in: sync `/api/cart`.
 */
export function useCartStore() {
  const { mutate } = useSWRConfig();
  const { isLoggedIn, isReady } = useAuthStore();
  const inFlightRef = useRef(false);

  const { data: lines } = useSWR(
    CART_LINES_SWR_KEY,
    () => cartRepository.getState().lines,
    {
      fallbackData: [] as CartLine[],
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const { data: isUpdating } = useSWR(CART_UPDATING_SWR_KEY, () => false, {
    fallbackData: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const currentLines = lines ?? [];
  const summary = buildCartSummary({ lines: currentLines });
  const quantity = summary.quantity;
  const lineCount = currentLines.length;

  const syncFromSummary = useCallback(
    async (next: CartSummary) => {
      const state = normalizeCartState({
        lines: next.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      });
      cartRepository.setState(state);
      await mutate(CART_LINES_SWR_KEY, state.lines, { revalidate: false });
      return next;
    },
    [mutate],
  );

  const persistRemote = useCallback(async (state: CartState) => {
    return apiRequest<CartSummary>(CART_API_PATH, {
      method: "PUT",
      body: JSON.stringify(normalizeCartState(state)),
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;

    if (!isLoggedIn) {
      resetCartHydration();
      return;
    }

    void hydrateCartOnce(syncFromSummary, persistRemote);
  }, [isLoggedIn, isReady, persistRemote, syncFromSummary]);

  const runMutation = useCallback(
    async (action: () => Promise<CartSummary>) => {
      if (inFlightRef.current) {
        return summaryFromRepo();
      }

      inFlightRef.current = true;
      await mutate(CART_UPDATING_SWR_KEY, true, { revalidate: false });
      try {
        const next = await action();
        return await syncFromSummary(next);
      } finally {
        inFlightRef.current = false;
        await mutate(CART_UPDATING_SWR_KEY, false, { revalidate: false });
      }
    },
    [mutate, syncFromSummary],
  );

  const mutateState = useCallback(
    (state: CartState) =>
      runMutation(async () => {
        if (isLoggedIn) {
          return persistRemote(state);
        }
        return cartService.setState(state);
      }),
    [isLoggedIn, persistRemote, runMutation],
  );

  return {
    lines: currentLines,
    /** Tổng số gói mọi dòng — dùng pricing / checkout. */
    quantity,
    /** Số dòng gói trong giỏ — dùng badge navbar / dock. */
    lineCount,
    summary,
    isEmpty: summary.isEmpty,
    isUpdating: Boolean(isUpdating),
    addToCart: (
      amount: number = 1,
      variantId: string = DEFAULT_PRODUCT_VARIANT_ID,
    ) =>
      mutateState({
        lines: addToCartLines(currentLines, amount, variantId),
      }),
    increment: (variantId: string) => {
      const line = currentLines.find((l) => l.variantId === variantId);
      return mutateState({
        lines: setLineQuantityInCart(
          currentLines,
          variantId,
          (line?.quantity ?? MIN_CART_QUANTITY) + 1,
        ),
      });
    },
    decrement: (variantId: string) => {
      const line = currentLines.find((l) => l.variantId === variantId);
      return mutateState({
        lines: setLineQuantityInCart(
          currentLines,
          variantId,
          (line?.quantity ?? MIN_CART_QUANTITY) - 1,
        ),
      });
    },
    setLineQuantity: (variantId: string, nextQty: number) =>
      mutateState({
        lines: setLineQuantityInCart(currentLines, variantId, nextQty),
      }),
    removeLine: (variantId: string) =>
      mutateState({
        lines: setLineQuantityInCart(currentLines, variantId, 0),
      }),
    removeFromCart: () => mutateState({ lines: [] }),
  };
}

function summaryFromRepo(): CartSummary {
  return cartService.buildSummary(cartRepository.getState());
}
