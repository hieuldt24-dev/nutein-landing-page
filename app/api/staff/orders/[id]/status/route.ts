import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminOrderStatusUpdateSchema } from "@/features/admin-orders/schemas/admin-orders.schema";
import { adminOrdersRepository } from "@/features/admin-orders/services/admin-orders.repository";

/**
 * PATCH /api/staff/orders/[id]/status
 * Chỉ Staff — Admin không kế thừa quyền vận hành đơn hàng (S3).
 */
export const PATCH = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const body = await req.json();
    const { status, note } = adminOrderStatusUpdateSchema.parse(body);

    const order = await adminOrdersRepository.updateStatus(id, status, user.userId, note);
    return successResponse(order);
  },
);
