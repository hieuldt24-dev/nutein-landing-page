import { NextRequest } from "next/server";
import { createdResponse, successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { enforceCheckoutRateLimit } from "@/src/middlewares/checkout-rate-limit.middleware";
import { assertTrustedOrigin } from "@/src/security/csrf";
import { resolveHashedClientIp } from "@/src/security/trusted-client-ip";
import { BadRequestError } from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";
import {
  createOrderRequestSchema,
  idempotencyKeySchema,
} from "@/features/checkout/schemas/checkout.schema";
import {
  CHECKOUT_RATE_LIMIT,
  isCheckoutEnforcementEnabled,
} from "@/features/checkout/constants";
import { checkoutService } from "@/features/checkout/services/checkout.service";

/** Plan §Chính sách: request body 32 KiB. Đơn 20 dòng chuẩn hoá còn xa mức này. */
const MAX_BODY_BYTES = 32 * 1024;

/**
 * POST /api/checkout
 * Bắt buộc đăng nhập (JWT app) — ghi `orders` + `order_items`.
 * 401 NO_TOKEN/TOKEN_EXPIRED → client remint rồi retry (lib/api-client).
 *
 * Thứ tự cố định (plan §Luồng tạo đơn 1–3):
 * Origin → giới hạn body → throttle IP → xác thực → throttle account →
 * đọc `Idempotency-Key` → parse schema → service.
 *
 * Throttle IP đứng TRƯỚC xác thực có chủ đích: chặn flood trước khi tốn chi phí
 * verify JWT. An toàn vì bucket IP có cardinality bị chặn (đã canonical hoá +
 * HMAC), khác với bucket theo id tuỳ ý client gửi.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const enforce = isCheckoutEnforcementEnabled();

  assertTrustedOrigin(req, { enforce, route: "POST /api/checkout" });

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new BadRequestError("Nội dung đơn hàng quá lớn.");
  }

  const { ipHash, trusted } = resolveHashedClientIp(req);
  if (ipHash) {
    await enforceCheckoutRateLimit({
      scope: "ip",
      identifier: ipHash,
      max: CHECKOUT_RATE_LIMIT.ipMax,
      windowSeconds: CHECKOUT_RATE_LIMIT.windowSeconds,
      // IP chưa đáng tin (chưa probe ingress ghi đè header — RFC-1 known-gap)
      // thì chỉ đo, không chặn: chặn theo header giả mạo được là chặn nhầm
      // khách thật trong khi bot chỉ cần đổi header.
      enforce: enforce && trusted,
    });
  } else if (enforce) {
    logger.warn(
      { route: "POST /api/checkout" },
      "Không xác định được IP đáng tin — bỏ qua bucket IP, chỉ còn throttle theo account",
    );
  }

  const user = await authenticate(req);

  await enforceCheckoutRateLimit({
    scope: "account",
    identifier: user.userId,
    max: CHECKOUT_RATE_LIMIT.accountMax,
    windowSeconds: CHECKOUT_RATE_LIMIT.windowSeconds,
    enforce,
  });

  // CỬA SỔ TƯƠNG THÍCH (execute-instruction E3): header được ĐỌC từ bây giờ,
  // nhưng THIẾU header KHÔNG phải lỗi — service chỉ cảnh báo + log. Chỉ bật
  // enforce 400/409 sau khi log cho thấy 0 request thiếu header trong ≥24h.
  // Giá trị CÓ mặt nhưng sai định dạng vẫn bị từ chối: đó là bug client, không
  // phải client cũ.
  const rawKey = req.headers.get("idempotency-key");
  const idempotencyKey = rawKey
    ? idempotencyKeySchema.parse(rawKey)
    : undefined;

  const body = await req.json();
  const validated = createOrderRequestSchema.parse(body);

  const result = await checkoutService.createOrder(
    user.userId,
    validated,
    idempotencyKey,
  );

  // Replay = đơn CŨ, không có gì được tạo -> 200, không phải 201.
  return result.replayed ? successResponse(result) : createdResponse(result);
});
