"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { CART_LINES_SWR_KEY, MIN_CART_QUANTITY } from "@/features/cart/constants";
import {
  addToCartLines,
  buildCartSummary,
  setLineQuantityInCart,
} from "@/features/cart/pricing";
import { cartRepository } from "@/features/cart/services/cart.repository";
import type { CartLine } from "@/features/cart/types";
import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";

/**
 * Global UI state giỏ — nguồn thật `localStorage` (`cartRepository`), lớp
 * reactive cross-component là SWR-as-store (docs/state-management.md mục 3).
 * Không còn network round-trip / merge-on-login — localStorage dùng chung
 * mọi trạng thái đăng nhập trong cùng trình duyệt.
 */
export function useCartStore() {
  const { data: lines, mutate: mutateLines } = useSWR(
    CART_LINES_SWR_KEY,
    () => cartRepository.readState().lines,
    {
      fallbackData: [] as CartLine[],
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const currentLines = lines ?? [];
  const summary = buildCartSummary({ lines: currentLines });

  const writeLines = useCallback(
    (nextLines: CartLine[]) => {
      const next = cartRepository.writeState({ lines: nextLines });
      void mutateLines(next.lines, { revalidate: false });
      return buildCartSummary(next);
    },
    [mutateLines],
  );

  return {
    lines: currentLines,
    /** Tổng số gói mọi dòng — dùng pricing / checkout. */
    quantity: summary.quantity,
    /** Số dòng gói trong giỏ — dùng badge navbar / dock. */
    lineCount: currentLines.length,
    summary,
    isEmpty: summary.isEmpty,
    addToCart: (
      amount: number = 1,
      variantId: string = DEFAULT_PRODUCT_VARIANT_ID,
    ) => writeLines(addToCartLines(currentLines, amount, variantId)),
    increment: (variantId: string) => {
      const line = currentLines.find((l) => l.variantId === variantId);
      return writeLines(
        setLineQuantityInCart(
          currentLines,
          variantId,
          (line?.quantity ?? MIN_CART_QUANTITY) + 1,
        ),
      );
    },
    decrement: (variantId: string) => {
      const line = currentLines.find((l) => l.variantId === variantId);
      return writeLines(
        setLineQuantityInCart(
          currentLines,
          variantId,
          (line?.quantity ?? MIN_CART_QUANTITY) - 1,
        ),
      );
    },
    setLineQuantity: (variantId: string, nextQty: number) =>
      writeLines(setLineQuantityInCart(currentLines, variantId, nextQty)),
    removeLine: (variantId: string) =>
      writeLines(setLineQuantityInCart(currentLines, variantId, 0)),
    removeFromCart: () => writeLines([]),
  };
}
