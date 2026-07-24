import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { payosStatusQuerySchema } from "@/features/checkout/schemas/payos.schema";
import { checkoutService } from "@/features/checkout/services/checkout.service";

/**
 * GET /api/checkout/payos/status?orderCode=NT-...
 * Trang /checkout/success gọi khi quay lại từ payOS — đối soát trạng thái
 * thanh toán thật (bù cho webhook cần public HTTPS URL, không chạy được ở
 * localhost nếu chưa tunnel).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const { orderCode } = payosStatusQuerySchema.parse({
    orderCode: req.nextUrl.searchParams.get("orderCode"),
  });
  const result = await checkoutService.getPaymentStatusForUser(user.userId, orderCode);
  return successResponse(result);
});
