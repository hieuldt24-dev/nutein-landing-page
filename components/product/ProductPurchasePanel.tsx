"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ProductBundleBar } from "@/components/product/ProductBundleBar";
import { FillButton } from "@/components/ui/FillButton";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { StarRating } from "@/components/ui/StarRating";
import { productService } from "@/features/product/services/product.service";
import type { ProductDetail } from "@/features/product/types";
import { useAddToCart } from "@/lib/useAddToCart";
import { cn, formatCurrencyVnd } from "@/lib/utils";

interface ProductPurchasePanelProps {
  product: ProductDetail;
  className?: string;
}

export function ProductPurchasePanel({ product, className }: ProductPurchasePanelProps) {
  const addToCart = useAddToCart();
  const [selectedVariantId, setSelectedVariantId] = useState(product.defaultVariantId);
  const [qty, setQty] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const variant = productService.resolveVariant(product, selectedVariantId);
  const safeQty = Math.max(1, qty);
  const lineTotal = productService.lineTotal(product, selectedVariantId, safeQty);
  const regularLineTotal = product.unitPrice * variant.units * safeQty;
  const hasBundleDiscount = lineTotal < regularLineTotal;

  const handleAdd = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      await addToCart(qty, variant.id);
    } finally {
      setIsAdding(false);
    }
  };

  const reviewLabel = `${product.rating.count} đánh giá`;

  return (
    <div className={cn("flex flex-col gap-5 md:gap-6", className)}>
      <div>
        <StarRating
          rating={product.rating.average}
          label={reviewLabel}
          size={18}
          interactive
          className="mb-3"
        />
        <h1 className="font-display text-[clamp(40px,5vw,56px)] font-bold leading-tight tracking-[-0.04em] text-ink">
          {product.name}
        </h1>
        <p className="mt-3 max-w-[36ch] text-[16px] leading-relaxed font-medium text-ink/80 md:text-[17px]">
          {product.tagline}
        </p>
      </div>

      <div>
        <p className="mb-3 text-[13px] font-bold uppercase tracking-[-0.01em] text-ink">
          Chọn gói
        </p>
        <div className="flex flex-wrap gap-2.5">
          {product.variants.map((pack) => {
            const active = pack.id === variant.id;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedVariantId(pack.id)}
                aria-pressed={active}
                className={cn(
                  "h-11 cursor-pointer rounded-full border-[1.5px] px-5 text-[14px] font-bold uppercase tracking-[-0.01em] transition-colors",
                  active
                    ? "border-ink bg-ink text-bg"
                    : "border-ink/30 bg-surface text-ink hover:border-ink"
                )}
              >
                {pack.label}
              </button>
            );
          })}
        </div>
      </div>

      <ProductBundleBar product={product} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[-0.01em] text-text-muted">
            Tổng
          </p>
          <div className="flex items-baseline gap-x-3">
            <p className="font-display text-[clamp(28px,3vw,36px)] font-bold leading-none tracking-[-0.04em] text-ink">
              {formatCurrencyVnd(lineTotal)}
            </p>
            {hasBundleDiscount && (
              <s className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.03em] text-text-muted">
                {formatCurrencyVnd(regularLineTotal)}
              </s>
            )}
          </div>
          <p className="mt-1.5 text-[13px] font-medium text-text-muted">
            {formatCurrencyVnd(variant.price ?? product.unitPrice * variant.units)} · {variant.label}
          </p>
        </div>
        <QuantityStepper
          value={qty}
          min={1}
          max={20}
          disabled={isAdding}
          onIncrement={() => setQty((n) => Math.min(20, n + 1))}
          onDecrement={() => setQty((n) => Math.max(1, n - 1))}
          className="h-12"
        />
      </div>

      <FillButton
        type="button"
        variant="ink-solid"
        disabled={isAdding}
        onClick={() => {
          void handleAdd();
        }}
        className="h-[54px] w-full justify-center px-6 text-[15px] font-bold leading-none uppercase tracking-[-0.01em]"
      >
        {isAdding ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden />
            Đang thêm…
          </>
        ) : (
          "Thêm vào giỏ"
        )}
      </FillButton>
    </div>
  );
}
