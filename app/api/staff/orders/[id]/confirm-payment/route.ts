import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import {
  authenticate,
  requireRole,
} from "@/src/middlewares/authenticate.middlware";
import { adminOrdersRepository } from "@/features/admin-orders/services/admin-orders.repository";
import { confirmPaymentSchema } from "@/features/admin-orders/schemas/admin-orders.schema";
import { readOptionalJsonBody } from "@/src/api/read-json-body";

/**
 * POST /api/staff/orders/[id]/confirm-payment
 * Xác nhận đã nhận tiền chuyển khoản (VietQR) — chỉ Staff. Đây là con đường
 * DUY NHẤT đặt payment_status = PAID cho đơn BANK_TRANSFER.
 *
 * Body là TÙY CHỌN và chỉ chứa `expectedVersion` (RFC-4): client cũ gửi POST
 * rỗng vẫn chạy y như trước, client mới gửi version đang hiển thị để nhận 409
 * thay vì ghi đè khi đơn đã đổi.
 */
export const POST = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const body = confirmPaymentSchema.parse(await readOptionalJsonBody(req));
    const order = await adminOrdersRepository.confirmPayment(
      id,
      user.userId,
      body.expectedVersion ?? null,
    );
    return successResponse(order);
  },
);
