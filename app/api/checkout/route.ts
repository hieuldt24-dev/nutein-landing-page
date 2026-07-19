import { NextRequest } from "next/server";
import { createdResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { createOrderRequestSchema } from "@/features/checkout/schemas/checkout.schema";
import { checkoutService } from "@/features/checkout/services/checkout.service";

/**
 * POST /api/checkout
 * Validate → tạo đơn (mock service) → 201 + CreateOrderResult.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const validated = createOrderRequestSchema.parse(body);
  const result = await checkoutService.createOrder(validated);
  return createdResponse(result);
});
