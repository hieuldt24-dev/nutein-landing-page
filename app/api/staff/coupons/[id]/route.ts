import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { NotFoundError } from "@/src/errors/app.error";
import { adminCouponUpdateSchema } from "@/features/admin-coupons/schemas/admin-coupons.schema";
import { adminCouponsRepository } from "@/features/admin-coupons/services/admin-coupons.repository";

/**
 * GET /api/staff/coupons/[id] — chỉ Staff.
 */
export const GET = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const coupon = await adminCouponsRepository.getById(id);
    if (!coupon) {
      throw new NotFoundError("Coupon");
    }
    return successResponse(coupon);
  },
);

/**
 * PATCH /api/staff/coupons/[id] — cập nhật một phần (bật/tắt, sửa giá trị...).
 */
export const PATCH = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const body = await req.json();
    const input = adminCouponUpdateSchema.parse(body);
    const coupon = await adminCouponsRepository.update(id, input, user.userId);
    return successResponse(coupon);
  },
);
