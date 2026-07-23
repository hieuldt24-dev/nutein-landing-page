import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { payosRetryRequestSchema } from "@/features/checkout/schemas/payos.schema";
import { checkoutService } from "@/features/checkout/services/checkout.service";

/**
 * POST /api/checkout/payos/retry
 * Đơn payOS bị bỏ dở (payment_status = UNPAID) — tạo lại payment link.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const body = await req.json();
  const { orderCode } = payosRetryRequestSchema.parse(body);
  const result = await checkoutService.retryPayment(user.userId, orderCode);
  return successResponse(result);
});
