import "server-only";

import { adminCouponsRepository } from "@/features/admin-coupons/services/admin-coupons.repository";
import { BadRequestError } from "@/src/errors/app.error";
import { COUPON_MESSAGES, couponBelowMinOrderMessage } from "../constants";

export interface CouponValidationResult {
  couponId: string;
  code: string;
  discountAmount: number;
}

/**
 * Nguồn sự thật DUY NHẤT cho số tiền giảm của coupon — cả preview endpoint lẫn
 * `checkoutService.createOrder()` đều gọi hàm này, không ai tự tính lại.
 *
 * `subtotal` phải là tạm tính TRƯỚC giảm giá theo mốc voucher
 * (`cartSummary.subtotal`, không phải `.total`) — đúng cơ sở mà
 * `min_order_value` được đối chiếu.
 *
 * Đây là pre-validation ở tầng app, KHÔNG phải chốt chặn cuối: trigger DB
 * `validate_and_apply_coupon()` mới là nơi khoá row + tăng `used_count` atomic
 * lúc insert đơn, và vẫn là trọng tài cuối cùng khi có race.
 */
export const couponValidationService = {
  async validateAndComputeDiscount(params: {
    code: string;
    subtotal: number;
  }): Promise<CouponValidationResult> {
    const code = params.code.trim().toUpperCase();
    const coupon = await adminCouponsRepository.findByCode(code);

    if (!coupon) {
      throw new BadRequestError(COUPON_MESSAGES.notFound);
    }
    if (!coupon.isActive) {
      throw new BadRequestError(COUPON_MESSAGES.inactive);
    }
    if (coupon.expiresAt !== null && new Date(coupon.expiresAt).getTime() < Date.now()) {
      throw new BadRequestError(COUPON_MESSAGES.expired);
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestError(COUPON_MESSAGES.usageExhausted);
    }
    if (coupon.minOrderValue !== null && params.subtotal < coupon.minOrderValue) {
      throw new BadRequestError(couponBelowMinOrderMessage(coupon.minOrderValue));
    }

    const rawDiscount =
      coupon.discountType === "PERCENTAGE"
        ? params.subtotal * (coupon.discount / 100)
        : coupon.discount;

    // Clamp phòng thủ (M2): giảm giá không bao giờ được vượt tạm tính, nếu
    // không tổng đơn có thể âm. Độc lập với ràng buộc `.max(100)` ở schema admin
    // — kể cả khi dữ liệu coupon cũ/xấu lọt qua validation lúc tạo.
    const discountAmount = Math.max(0, Math.min(rawDiscount, params.subtotal));

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: Math.round(discountAmount),
    };
  },
};
