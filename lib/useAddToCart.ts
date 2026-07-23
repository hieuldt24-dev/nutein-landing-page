"use client";

import { useCartStore } from "@/lib/useCartStore";
import { useCartDrawer } from "@/lib/useCartDrawer";

/**
 * Hành động "Mua ngay"/"Thêm vào giỏ" dùng chung cho mọi CTA trên site
 * (Hero, CTA sections, PDP…) — `amount` = số gói (không phải số hũ).
 */
export function useAddToCart() {
  const { addToCart } = useCartStore();
  const { open } = useCartDrawer();

  return async (amount: number = 1, variantId?: string) => {
    open();
    await addToCart(amount, variantId);
  };
}
