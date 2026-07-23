import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { payosWebhookSchema } from "@/features/checkout/schemas/payos.schema";
import { payosService } from "@/features/checkout/services/payos.service";

/**
 * POST /api/checkout/payos/webhook
 * payOS gọi server-to-server (không cookie/JWT) — auth = signature qua
 * PAYOS_CHECKSUM_KEY (xem payosService.handleWebhook). Không dùng
 * `authenticate()`.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  // Chỉ validate shape để chặn payload rác — KHÔNG dùng kết quả .parse() để
  // verify signature, luôn truyền `body` gốc.
  payosWebhookSchema.parse(body);
  await payosService.handleWebhook(body);
  return successResponse({ received: true });
});
