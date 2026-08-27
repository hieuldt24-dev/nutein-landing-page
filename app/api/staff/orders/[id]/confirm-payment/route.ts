import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminOrdersRepository } from "@/features/admin-orders/services/admin-orders.repository";

/**
 * POST /api/staff/orders/[id]/confirm-payment
 * Xác nhận đã nhận tiền chuyển khoản (VietQR) — chỉ Staff, không nhận body
 * (id lấy từ URL param). Đây là con đường DUY NHẤT đặt payment_status = PAID
 * cho đơn BANK_TRANSFER.
 */
export const POST = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const order = await adminOrdersRepository.confirmPayment(id, user.userId);
    return successResponse(order);
  },
);
