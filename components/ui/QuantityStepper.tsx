"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  className?: string;
}

/** Bộ tăng giảm số lượng dạng pill — dùng chung cho Cart, buy box trang sản phẩm. */
export function QuantityStepper({
  value,
  min = 0,
  max = Infinity,
  disabled = false,
  onIncrement,
  onDecrement,
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center rounded-full border-[1.5px] border-ink bg-surface",
        disabled && "opacity-50",
        className
      )}
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled || value <= min}
        aria-label="Giảm số lượng"
        className="flex h-full w-8 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-primary-soft/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus size={13} strokeWidth={2.5} />
      </button>
      <span className="w-6 text-center text-[14px] font-bold tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled || value >= max}
        aria-label="Tăng số lượng"
        className="flex h-full w-8 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-primary-soft/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
