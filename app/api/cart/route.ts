import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import {
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
} from "@/features/cart/constants";
import { cartServerService } from "@/features/cart/services/cart.server.service";

const cartLineSchema = z.object({
  variantId: z.string().trim().min(1),
  quantity: z
    .number()
    .int()
    .min(MIN_CART_QUANTITY + 1)
    .max(MAX_CART_QUANTITY),
});

const cartStateSchema = z.object({
  lines: z.array(cartLineSchema).max(10),
});

/** GET /api/cart — giỏ multi-line theo gói của user đang đăng nhập. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const summary = await cartServerService.getSummary(user.userId);
  return successResponse(summary);
});

/** PUT /api/cart — ghi đè toàn bộ `lines`. */
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const body = await req.json();
  const state = cartStateSchema.parse(body);
  const summary = await cartServerService.setState(user.userId, state);
  return successResponse(summary);
});
