import { NextRequest } from "next/server";
import { createdResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { createOrderRequestSchema } from "@/features/checkout/schemas/checkout.schema";
import { checkoutService } from "@/features/checkout/services/checkout.service";

/**
 * POST /api/checkout
 * Bắt buộc đăng nhập (JWT app) — ghi `orders` + `order_items`.
 * 401 NO_TOKEN/TOKEN_EXPIRED → client remint rồi retry (lib/api-client).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const body = await req.json();
  const validated = createOrderRequestSchema.parse(body);
  const result = await checkoutService.createOrder(user.userId, validated);
  return createdResponse(result);
});
