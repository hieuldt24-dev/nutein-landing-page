"use client";

import { useCartStore } from "@/lib/useCartStore";
import { useCartDrawer } from "@/lib/useCartDrawer";

/**
 * Hành động "Mua ngay"/"Thêm vào giỏ" dùng chung cho mọi CTA trên site
 * (Hero, CTA sections…) — mở drawer rồi mutate qua cartService
 * (async + loading), tránh lặp logic ở từng nút mua.
 */
export function useAddToCart() {
  const { addToCart } = useCartStore();
  const { open } = useCartDrawer();

  return async (amount: number = 1) => {
    open();
    await addToCart(amount);
  };
}
