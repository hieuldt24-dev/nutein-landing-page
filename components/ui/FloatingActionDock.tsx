"use client";

import { ShoppingBag } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";

/**
 * FAB Cart tròn — kem default, fill primary khi hover (FillButton `cream`).
 * Không shadow / không float khi hover.
 */
export function FloatingActionDock() {
  const { open } = useCartDrawer();
  const { quantity } = useCartStore();

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-40 md:right-8 md:bottom-8">
      <div className="pointer-events-auto relative">
        <FillButton
          variant="cream"
          onClick={open}
          aria-label={
            quantity > 0 ? `Mở giỏ hàng, ${quantity} sản phẩm` : "Mở giỏ hàng"
          }
          className="size-14 items-center justify-center p-0"
        >
          <ShoppingBag size={22} strokeWidth={2.2} aria-hidden />
        </FillButton>
        {quantity > 0 ? (
          <span className="pointer-events-none absolute -top-1 -right-1 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-extrabold text-[var(--color-bg)]">
            {quantity > 99 ? "99+" : quantity}
          </span>
        ) : null}
      </div>
    </div>
  );
}
