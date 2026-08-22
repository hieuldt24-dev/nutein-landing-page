"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { formatCurrencyVnd } from "@/lib/utils";
import type { CheckoutCouponState } from "@/lib/useCheckoutCoupon";

interface CheckoutCouponFieldProps {
  coupon: CheckoutCouponState;
  disabled?: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/**
 * Ô nhập mã giảm giá — đặt ngay trước nút đặt hàng.
 * 3 trạng thái: trống / đã áp dụng (chip có nút "×" gỡ riêng) / bị từ chối
 * (hiện đúng lý do server trả về).
 */
export function CheckoutCouponField({
  coupon,
  disabled,
  onApply,
  onRemove,
}: CheckoutCouponFieldProps) {
  const [code, setCode] = useState("");
  const isChecking = coupon.status === "checking";
  const isApplied = coupon.status === "applied";

  const handleApply = () => {
    if (disabled || isChecking) return;
    onApply(code);
  };

  const handleRemove = () => {
    onRemove();
    setCode("");
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
        Mã giảm giá
      </h2>

      {isApplied ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-forest/30 bg-forest/5 px-4 py-3">
          <span className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-forest">
            {coupon.code}
          </span>
          <span className="text-[13px] font-semibold text-forest">
            −{formatCurrencyVnd(coupon.discountAmount ?? 0)}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label={`Gỡ mã giảm giá ${coupon.code}`}
            className="ml-auto flex size-7 cursor-pointer items-center justify-center rounded-full border border-forest/30 text-forest transition-colors hover:bg-forest/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Enter trong ô mã KHÔNG được submit cả form đặt hàng.
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
            disabled={disabled || isChecking}
            placeholder="Nhập mã giảm giá"
            aria-label="Mã giảm giá"
            aria-invalid={coupon.status === "rejected"}
            className="h-[46px] min-w-0 flex-1 rounded-[var(--radius-md)] border border-ink/15 bg-surface px-4 text-[14px] font-semibold text-ink uppercase placeholder:normal-case placeholder:font-normal placeholder:text-text-muted focus:border-ink/40 focus:outline-none disabled:opacity-60"
          />
          <FillButton
            type="button"
            variant="ink-solid"
            onClick={handleApply}
            disabled={disabled || isChecking || !code.trim()}
            className="h-[46px] shrink-0 justify-center px-5 text-[13px] font-bold uppercase"
          >
            {isChecking ? <Loader2 size={15} className="animate-spin" /> : "Áp dụng"}
          </FillButton>
        </div>
      )}

      {coupon.status === "rejected" && coupon.reason ? (
        <p role="alert" className="text-[13px] font-semibold text-red-600">
          {coupon.reason}
        </p>
      ) : null}
    </section>
  );
}
