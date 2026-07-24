import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { NotFoundError } from "@/src/errors/app.error";
import { adminOrdersRepository } from "@/features/admin-orders/services/admin-orders.repository";

/**
 * GET /api/staff/orders/[id]
 * Chỉ Staff — Admin không kế thừa quyền vận hành đơn hàng (S3).
 */
export const GET = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const order = await adminOrdersRepository.getById(id);
    if (!order) {
      throw new NotFoundError("Đơn hàng");
    }

    return successResponse(order);
  },
);
