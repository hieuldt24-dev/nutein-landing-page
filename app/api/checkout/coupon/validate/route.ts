import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { couponPreviewLimiter } from "@/src/middlewares/rate-limit.middleware";
import {
  couponPreviewRequestSchema,
  type CouponPreviewResponse,
} from "@/features/checkout/schemas/coupon-preview.schema";
import { couponValidationService } from "@/features/checkout/services/coupon-validation.service";
import { AppError } from "@/src/errors/app.error";

/**
 * POST /api/checkout/coupon/validate — preview mã giảm giá cho trang checkout.
 *
 * CHỈ phục vụ UX. `checkoutService.createOrder()` luôn tự tra + tự tính lại từ
 * DB lúc submit, không bao giờ tin số tiền giảm mà endpoint này trả về.
 *
 * Rate limit là guard-clause ĐẦU TIÊN (trước cả authenticate/parse) — endpoint
 * nhận mã tuỳ ý và trả tín hiệu hợp lệ/không, tức là oracle dò mã nếu để trần.
 * Bắt buộc đăng nhập, giống `POST /api/checkout`.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const limited = await couponPreviewLimiter(req);
  if (limited) return limited;

  await authenticate(req);

  const body = await req.json();
  const { couponCode, subtotal } = couponPreviewRequestSchema.parse(body);

  try {
    const result = await couponValidationService.validateAndComputeDiscount({
      code: couponCode,
      subtotal,
    });
    return successResponse<CouponPreviewResponse>({ valid: true, ...result });
  } catch (error) {
    // Mã sai / hết hạn / hết lượt / chưa đủ tối thiểu là kết quả UX bình thường,
    // không phải lỗi server — trả 200 kèm lý do để UI hiện inline.
    if (error instanceof AppError && error.statusCode === 400) {
      return successResponse<CouponPreviewResponse>({
        valid: false,
        reason: error.message,
      });
    }
    throw error;
  }
});
