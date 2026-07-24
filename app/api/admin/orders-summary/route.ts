import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminOrdersRepository } from "@/features/admin-orders/services/admin-orders.repository";

/**
 * GET /api/admin/orders-summary
 * Dữ liệu tổng hợp (status/total/createdAt) cho dashboard — KHÔNG chứa PII
 * khách hàng, nên cho cả STAFF lẫn ADMIN gọi. Khác `/api/staff/orders`
 * (chi tiết đầy đủ, chỉ STAFF — S3: Admin không kế thừa quyền vận hành
 * đơn hàng).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF", "ADMIN");

  const orders = await adminOrdersRepository.listSummary();
  return successResponse(orders);
});
