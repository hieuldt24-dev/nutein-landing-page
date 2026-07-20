import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { accountOrderService } from "@/features/account/services/account-order.service";

/**
 * GET /api/account/orders
 * Mock list — khi có auth session: đọc user từ cookie, không tin query.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const email = req.nextUrl.searchParams.get("email");
  const orders = await accountOrderService.listOrders(email);
  return successResponse(orders);
});
