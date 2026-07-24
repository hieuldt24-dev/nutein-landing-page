import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminOrderListQuerySchema } from "@/features/admin-orders/schemas/admin-orders.schema";
import { adminOrdersRepository } from "@/features/admin-orders/services/admin-orders.repository";

/**
 * GET /api/staff/orders?status=&from=&to=
 * Chỉ Staff — Admin không kế thừa quyền vận hành đơn hàng (S3).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const query = adminOrderListQuerySchema.parse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });

  const orders = await adminOrdersRepository.list(query);
  return successResponse(orders);
});
