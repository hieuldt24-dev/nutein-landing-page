"use client";

import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { CouponPreviewResponse } from "@/features/checkout/schemas/coupon-preview.schema";

export interface CheckoutCouponState {
  status: "idle" | "checking" | "applied" | "rejected";
  code?: string;
  discountAmount?: number;
  couponId?: string;
  reason?: string;
}

/**
 * State mã giảm giá trên trang checkout.
 *
 * CHỈ phục vụ hiển thị: `discountAmount` ở đây là số preview, khi submit chỉ
 * `code` được gửi lên — server tự tra lại và tự tính lại số tiền giảm từ DB.
 */
export function useCheckoutCoupon() {
  const [state, setState] = useState<CheckoutCouponState>({ status: "idle" });

  const apply = useCallback(async (rawCode: string, subtotal: number) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      setState({ status: "rejected", reason: "Vui lòng nhập mã giảm giá" });
      return;
    }

    setState({ status: "checking", code });
    try {
      const result = await apiRequest<CouponPreviewResponse>(
        "/api/checkout/coupon/validate",
        {
          method: "POST",
          body: JSON.stringify({ couponCode: code, subtotal }),
        },
      );

      if (result.valid) {
        setState({
          status: "applied",
          code: result.code,
          couponId: result.couponId,
          discountAmount: result.discountAmount,
        });
        return;
      }
      setState({ status: "rejected", code, reason: result.reason });
    } catch (err) {
      setState({
        status: "rejected",
        code,
        reason:
          err instanceof Error
            ? err.message
            : "Không kiểm tra được mã giảm giá — vui lòng thử lại",
      });
    }
  }, []);

  const remove = useCallback(() => setState({ status: "idle" }), []);

  return { coupon: state, apply, remove };
}
