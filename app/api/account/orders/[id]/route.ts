import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { accountOrderService } from "@/features/account/services/account-order.service";

/**
 * GET /api/account/orders/[id]
 * Chi tiết đơn CỦA CHÍNH user đang đăng nhập. Đơn của người khác trả 404
 * (không phải 403) để không lộ sự tồn tại của đơn.
 *
 * `no-store`: trạng thái thanh toán, hạn chuyển khoản và QR đổi theo thời gian
 * thật và gắn với một người dùng cụ thể — cache dù chỉ ở proxy cũng có thể trả
 * đơn của người này cho người khác.
 */
export const GET = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    const { id } = await params;
    const order = await accountOrderService.getOwnedOrderDetail(
      user.userId,
      id,
    );

    const response = successResponse(order);
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate",
    );
    return response;
  },
);
