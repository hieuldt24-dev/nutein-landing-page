"use client";

import Image from "next/image";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatCurrencyVnd } from "@/lib/utils";
import { MAX_CART_QUANTITY, MIN_CART_QUANTITY } from "@/features/cart/constants";
import type { Product } from "@/features/product/types";

interface CartLineItemProps {
  product: Product;
  quantity: number;
  lineSubtotal: number;
  disabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

/**
 * Dòng hàng duy nhất trong giỏ — layout tham chiếu Joy Rush
 * (ảnh tint + title/price + qty/remove), màu dùng token Nutein.
 */
export function CartLineItem({
  product,
  quantity,
  lineSubtotal,
  disabled = false,
  onIncrement,
  onDecrement,
  onRemove,
}: CartLineItemProps) {
  return (
    <div className="flex gap-4 md:gap-5">
      <div className="group flex aspect-square w-[26%] max-w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-primary-soft">
        <Image
          src={product.image}
          alt={product.imageAlt}
          width={104}
          height={104}
          className="h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
        />
      </div>

      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="mb-2 font-display text-[20px] font-bold uppercase leading-tight tracking-[-0.06em] text-ink">
            {product.name}
          </h3>
          <p className="mb-3 text-[13px] font-bold uppercase tracking-[-0.01em] text-text-muted">
            {product.unitLabel}
          </p>
          <QuantityStepper
            value={quantity}
            min={MIN_CART_QUANTITY}
            max={MAX_CART_QUANTITY}
            disabled={disabled}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            className="h-[34px] max-w-[88px] border-ink"
          />
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between">
          <span className="text-[16px] font-bold tracking-[-0.04em] text-ink">
            {formatCurrencyVnd(lineSubtotal)}
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="cursor-pointer text-[14px] font-bold uppercase tracking-[-0.01em] text-ink transition-colors hover:text-primary-deep disabled:pointer-events-none disabled:opacity-40"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}
