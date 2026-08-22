import { z } from "zod";

/**
 * Request preview mã giảm giá (`POST /api/checkout/coupon/validate`).
 * `subtotal` = tạm tính TRƯỚC giảm giá theo mốc voucher — cùng cơ sở mà server
 * dùng lại lúc submit để đối chiếu `min_order_value`.
 *
 * Chỉ phục vụ UX: kết quả endpoint này KHÔNG bao giờ được `createOrder()` tin
 * dùng, số tiền giảm thật luôn được tính lại từ DB lúc tạo đơn.
 */
export const couponPreviewRequestSchema = z.object({
  couponCode: z.string().trim().min(1, "Vui lòng nhập mã giảm giá").max(50),
  subtotal: z.number().min(0),
});

export type CouponPreviewRequest = z.infer<typeof couponPreviewRequestSchema>;

export type CouponPreviewResponse =
  | { valid: true; couponId: string; code: string; discountAmount: number }
  | { valid: false; reason: string };
