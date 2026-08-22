"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";
import {
  CART_CHECKOUT_LABEL,
  CART_CONTINUE_SHOPPING_LABEL,
  CART_DRAWER_ANIMATION_MS,
  CART_DRAWER_TITLE,
  CART_EMPTY_HEADING,
} from "@/features/cart/constants";
import type { CartSummary as CartSummaryData } from "@/features/cart/types";
import { productService } from "@/features/product/services/product.service";
import { CartVoucherProgress } from "@/components/shared/CartVoucherProgress";
import { CartLineItem } from "@/components/shared/CartLineItem";
import { FillButton } from "@/components/ui/FillButton";
import { cn, formatCurrencyVnd } from "@/lib/utils";

function CartEmptyState({ onContinueShopping }: { onContinueShopping: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-8 text-center">
      <p className="font-display text-[clamp(40px,4.5vw,56px)] font-bold leading-tight tracking-[-0.04em] text-ink">
        {CART_EMPTY_HEADING}
      </p>
      <FillButton
        href="/product"
        onClick={(e) => {
          e.preventDefault();
          onContinueShopping();
        }}
        variant="ink-solid"
        className="h-[52px] px-7 text-[15px] font-bold uppercase tracking-[-0.01em]"
      >
        {CART_CONTINUE_SHOPPING_LABEL}
      </FillButton>
    </div>
  );
}

function CartTotals({
  summary,
  onCheckout,
}: {
  summary: CartSummaryData;
  onCheckout: () => void;
}) {
  const hasDiscount = summary.discountAmount > 0;

  return (
    <div className="flex flex-col gap-4 border-t border-ink/25 px-7 py-7">
      <div className="flex flex-col gap-1.5 text-[14px] leading-snug tracking-[-0.01em]">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold uppercase text-ink">Tạm tính</span>
          <span className="flex items-baseline gap-2 font-bold text-ink">
            {hasDiscount && (
              <s className="text-[13px] font-semibold text-text-muted">
                {formatCurrencyVnd(summary.subtotal)}
              </s>
            )}
            <span>{formatCurrencyVnd(hasDiscount ? summary.total : summary.subtotal)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="shrink-0 font-bold uppercase text-ink">Phí vận chuyển</span>
          <span className="text-right font-bold uppercase text-ink">{summary.shippingNote}</span>
        </div>
      </div>
      <FillButton
        variant="ink-solid"
        onClick={onCheckout}
        className="mt-1 h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
      >
        {CART_CHECKOUT_LABEL}
      </FillButton>
    </div>
  );
}

/**
 * Cart Drawer — open/close dùng CSS transition transform (giống Joy Rush),
 * không swap keyframe (dễ bị “pop” vì animation class không restart ổn định).
 */
export default function CartDrawer() {
  const router = useRouter();
  const { isOpen, close } = useCartDrawer();
  const { summary, increment, decrement, removeLine } = useCartStore();
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const detail = productService.getProductDetail();

  const goCheckout = () => {
    close();
    router.push("/checkout");
  };

  const continueShopping = () => {
    close();
    router.push("/product");
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      // 2 rAF: mount DOM ở trạng thái off-canvas rồi mới bật translate-x-0
      // để transition slide-in chạy (không nhảy thẳng vào chỗ).
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => setIsMounted(false), CART_DRAWER_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isMounted ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  if (!isMounted) return null;

  const isEmpty = summary.isEmpty;

  return (
    <div id="cart-drawer-root" className="fixed inset-0 z-[100] flex justify-end p-0 md:p-8">
      <div
        id="cart-drawer-backdrop"
        onClick={close}
        className={cn(
          "absolute inset-0 cursor-pointer bg-ink/40 transition-opacity duration-[380ms] ease-[cubic-bezier(0.645,0.045,0.355,1)]",
          isVisible ? "opacity-100" : "opacity-0",
          /* Mobile full-bleed — backdrop ẩn (panel đã phủ cả viewport) */
          "md:block max-md:opacity-0 max-md:pointer-events-none",
        )}
      />

      <aside
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-bg",
          /* Mobile: lấp đầy như Joy Rush; desktop: panel bo góc + viền */
          "max-w-none rounded-none border-0",
          "md:max-w-[560px] md:rounded-[var(--radius-xl)] md:border md:border-ink md:shadow-xl",
          "transition-transform duration-[380ms] ease-[cubic-bezier(0.645,0.045,0.355,1)] will-change-transform",
          isVisible ? "translate-x-0" : "translate-x-full md:translate-x-[calc(100%+2rem)]",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink/25 px-7 py-7">
          <h2 className="text-[15px] font-bold uppercase tracking-[-0.01em] text-ink">
            {CART_DRAWER_TITLE}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng giỏ hàng"
            className="group flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-bg text-ink"
          >
            <X
              size={20}
              strokeWidth={2.2}
              className="transition-transform duration-[450ms] ease-[cubic-bezier(0.645,0.045,0.355,1)] group-hover:rotate-90"
            />
          </button>
        </div>

        <div className="border-b border-ink/25 px-7 pb-10 pt-5">
          <CartVoucherProgress progress={summary.voucherProgress} />
        </div>

        {isEmpty ? (
          <CartEmptyState onContinueShopping={continueShopping} />
        ) : (
          <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-7 py-8">
            {summary.lines.map((line) => (
              <CartLineItem
                key={line.variantId}
                product={productService.toCartProduct(detail, line.variantId)}
                quantity={line.quantity}
                lineSubtotal={line.lineSubtotal}
                onIncrement={() => {
                  void increment(line.variantId);
                }}
                onDecrement={() => {
                  void decrement(line.variantId);
                }}
                onRemove={() => {
                  void removeLine(line.variantId);
                }}
              />
            ))}
          </div>
        )}

        {!isEmpty && <CartTotals summary={summary} onCheckout={goCheckout} />}
      </aside>
    </div>
  );
}
