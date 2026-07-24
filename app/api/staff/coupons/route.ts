import { NextRequest } from "next/server";
import { createdResponse, successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminCouponInputSchema } from "@/features/admin-coupons/schemas/admin-coupons.schema";
import { adminCouponsRepository } from "@/features/admin-coupons/services/admin-coupons.repository";

/**
 * GET /api/staff/coupons — chỉ Staff.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const coupons = await adminCouponsRepository.list();
  return successResponse(coupons);
});

/**
 * POST /api/staff/coupons — tạo coupon mới.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const body = await req.json();
  const input = adminCouponInputSchema.parse(body);
  const coupon = await adminCouponsRepository.create(input, user.userId);
  return createdResponse(coupon);
});
