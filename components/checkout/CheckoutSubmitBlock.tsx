"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { CHECKOUT_SUBMIT_LABEL } from "@/features/checkout/constants";
import { FillButton } from "@/components/ui/FillButton";

interface CheckoutSubmitBlockProps {
  isSubmitting: boolean;
}

export function CheckoutSubmitBlock({ isSubmitting }: CheckoutSubmitBlockProps) {
  return (
    <div className="flex flex-col gap-4">
      <FillButton
        type="submit"
        variant="ink-solid"
        disabled={isSubmitting}
        className="h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Đang đặt hàng...
          </>
        ) : (
          CHECKOUT_SUBMIT_LABEL
        )}
      </FillButton>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-primary-deep">
        <Link href="/policies/doi-tra" className="underline-offset-2 hover:underline">
          Đổi trả
        </Link>
        <Link href="/policies/bao-mat" className="underline-offset-2 hover:underline">
          Bảo mật
        </Link>
        <Link href="/policies/dieu-khoan" className="underline-offset-2 hover:underline">
          Điều khoản
        </Link>
        <Link href="/policies/thanh-toan" className="underline-offset-2 hover:underline">
          Thanh toán
        </Link>
      </nav>
    </div>
  );
}

export function CheckoutSubmittingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/35"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-ink/10 bg-bg px-6 py-4 shadow-lg">
        <Loader2 size={22} className="animate-spin text-ink" />
        <p className="text-[14px] font-bold text-ink">Đang tạo đơn hàng…</p>
      </div>
    </div>
  );
}
