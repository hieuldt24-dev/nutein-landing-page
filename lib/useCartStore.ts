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
import type { CartLine, CartState, CartSummary } from "@/features/cart/types";
import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";
import { authRepository } from "@/features/auth/services/auth.repository";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Hydrate `/api/cart` — module-level (không per-hook-instance).
 * Key theo auth mode để login/logout re-fetch đúng (merge / session).
 */
let hydratePromise: Promise<CartSummary | null> | null = null;
let hydrateKey: string | null = null;

async function withApiSessionIfLoggedIn<T>(
  isLoggedIn: boolean,
  run: () => Promise<T>,
): Promise<T> {
  if (isLoggedIn) {
    await authRepository.waitForInFlightApiSession();
  }
  return run();
}

async function fetchCartSummary(isLoggedIn: boolean): Promise<CartSummary> {
  return withApiSessionIfLoggedIn(isLoggedIn, () =>
    apiRequest<CartSummary>(CART_API_PATH),
  );
}

async function putCartState(
  isLoggedIn: boolean,
  state: CartState,
): Promise<CartSummary> {
  return withApiSessionIfLoggedIn(isLoggedIn, () =>
    apiRequest<CartSummary>(CART_API_PATH, {
      method: "PUT",
      body: JSON.stringify(normalizeCartState(state)),
    }),
  );
}

async function hydrateCartOnce(
  authKey: string,
  isLoggedIn: boolean,
  syncFromSummary: (next: CartSummary) => Promise<CartSummary>,
): Promise<CartSummary | null> {
  if (hydrateKey === authKey && hydratePromise) {
    return hydratePromise;
  }

  hydrateKey = authKey;
  hydratePromise = (async () => {
    try {
      let remote = await fetchCartSummary(isLoggedIn);

      // One-shot: localStorage legacy → session/user API rồi xoá local.
      const legacy = cartRepository.readLegacyState();
      if (legacy.lines.length > 0) {
        if (remote.isEmpty) {
          remote = await putCartState(isLoggedIn, legacy);
        }
        cartRepository.clearLegacy();
      }

      await syncFromSummary(remote);
      return remote;
    } catch {
      hydratePromise = null;
      hydrateKey = null;
      return null;
    }
  })();

  return hydratePromise;
}

function resetCartHydration() {
  hydrateKey = null;
  hydratePromise = null;
}

/**
 * Global UI state giỏ — mọi mutate qua `/api/cart` (guest session + logged-in).
 */
export function useCartStore() {
  const { mutate } = useSWRConfig();
  const { isLoggedIn, isReady } = useAuthStore();
  const inFlightRef = useRef(false);
  const linesRef = useRef<CartLine[]>([]);

  const { data: lines } = useSWR(
    CART_LINES_SWR_KEY,
    () => linesRef.current,
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
  linesRef.current = currentLines;
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
      linesRef.current = state.lines;
      await mutate(CART_LINES_SWR_KEY, state.lines, { revalidate: false });
      return next;
    },
    [mutate],
  );

  useEffect(() => {
    if (!isReady) return;

    const authKey = isLoggedIn ? "user" : "guest";
    if (hydrateKey !== authKey) {
      resetCartHydration();
    }
    void hydrateCartOnce(authKey, isLoggedIn, syncFromSummary);
  }, [isLoggedIn, isReady, syncFromSummary]);

  const runMutation = useCallback(
    async (action: () => Promise<CartSummary>) => {
      if (inFlightRef.current) {
        return buildCartSummary({ lines: linesRef.current });
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
      runMutation(() => putCartState(isLoggedIn, state)),
    [isLoggedIn, runMutation],
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
