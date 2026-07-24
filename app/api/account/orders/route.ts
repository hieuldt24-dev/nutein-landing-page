import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { accountOrderService } from "@/features/account/services/account-order.service";

/**
 * GET /api/account/orders
 * Lịch sử đơn của user đang đăng nhập (JWT) — không tin query email.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const orders = await accountOrderService.listOrders(user.userId);
  return successResponse(orders);
});
