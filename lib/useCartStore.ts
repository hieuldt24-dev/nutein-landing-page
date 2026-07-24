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
import { productService } from "@/features/product/services/product.service";

const PRODUCT_CATALOG_CACHE_SWR_KEY = "product-catalog-cache";

/**
 * Global UI state giỏ — nguồn thật `localStorage` (`cartRepository`), lớp
 * reactive cross-component là SWR-as-store (docs/state-management.md mục 3).
 * Không còn network round-trip / merge-on-login — localStorage dùng chung
 * mọi trạng thái đăng nhập trong cùng trình duyệt.
 */
export function useCartStore() {
  const { data: lines, isLoading, mutate: mutateLines } = useSWR(
    CART_LINES_SWR_KEY,
    () => cartRepository.readState().lines,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Làm mới cache sync của productService (giá/tên/ảnh sản phẩm) từ DB thật
  // — mọi component gọi useCartStore() đều tự re-render khi cache này đổi
  // nhờ SWR, nên buildCartSummary/getProductDetail() bên dưới luôn theo kịp
  // mà không cần đổi chữ ký sync đang dùng khắp CartDrawer/CheckoutOrderSummary.
  useSWR(PRODUCT_CATALOG_CACHE_SWR_KEY, () => productService.refreshCatalogCache(), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

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
    /**
     * true khi đã đọc xong localStorage lần đầu. Trước đây dùng
     * `fallbackData: []` khiến `isEmpty` = true ngay ở lần render đầu (kể cả
     * khi giỏ có hàng) — nơi nào dựa vào `isEmpty` để redirect (vd
     * CheckoutForm) phải đợi `isReady` trước, tránh đá nhầm user còn giỏ hàng
     * về home khi họ hard-refresh/mở thẳng /checkout.
     */
    isReady: !isLoading,
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
