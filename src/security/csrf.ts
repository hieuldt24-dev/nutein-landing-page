import "server-only";

import type { NextRequest } from "next/server";
import { AppError } from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";

/**
 * Kiểm Origin CHÍNH XÁC cho các mutation dùng cookie (plan §Security — "CSRF
 * qua cookie"). App xác thực bằng cookie httpOnly `nutein_access_token`, nên
 * một form/fetch từ site khác vẫn kèm cookie đi — Origin là hàng rào duy nhất.
 *
 * Allowlist = ĐÚNG `APP_BASE_URL`. Không so sánh substring, không cho phép
 * subdomain suy diễn, không nhận `Referer` thay thế (Referer bị cắt bởi nhiều
 * policy nên dùng nó sẽ tạo nhánh "thiếu Referer thì cho qua").
 *
 * Thiếu Origin cũng bị TỪ CHỐI: mọi browser hiện hành đều gửi Origin cho
 * cross-origin POST, và cùng-origin fetch cũng gửi. Request không có Origin
 * không phải là mutation từ browser hợp lệ.
 */

/** Origin được coi là hợp lệ, theo thứ tự ưu tiên. */
function allowedOrigins(req: NextRequest): string[] {
  const configured = [process.env.APP_BASE_URL, process.env.NEXT_PUBLIC_APP_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const origins = configured
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  // Chưa cấu hình env -> dùng origin của chính request. KHÔNG phải bảo vệ thật
  // (attacker không điều khiển được nó, nhưng nó cũng không chặn được gì ở
  // deployment nhiều host); chỉ để dev/test không gãy. RFC-1 đã đưa
  // `APP_BASE_URL` vào `.env.example` kèm gate xác nhận deployment.
  return origins.length > 0 ? origins : [req.nextUrl.origin];
}

export class CsrfOriginError extends AppError {
  constructor() {
    super(
      "Yêu cầu bị từ chối vì nguồn gửi không hợp lệ.",
      403,
      "CSRF_ORIGIN_REJECTED",
    );
    // AppError ép prototype về chính nó trong constructor -> phải sửa lại,
    // nếu không `instanceof CsrfOriginError` luôn false.
    Object.setPrototypeOf(this, CsrfOriginError.prototype);
  }
}

export interface AssertTrustedOriginOptions {
  /**
   * `false` -> chỉ log cảnh báo, không ném lỗi. Dùng trong cửa sổ trước khi
   * owner xác nhận `APP_BASE_URL` đã được set trên deployment (execute-
   * instruction E2: không bật enforcement khách hàng thấy được).
   */
  enforce: boolean;
  /** Nhãn để log — không chứa PII. */
  route: string;
}

export function assertTrustedOrigin(
  req: NextRequest,
  options: AssertTrustedOriginOptions,
): void {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return;
  }

  const origin = req.headers.get("origin");
  const allowed = allowedOrigins(req);
  const ok = origin !== null && allowed.includes(origin);
  if (ok) return;

  if (!options.enforce) {
    logger.warn(
      {
        route: options.route,
        hasOrigin: origin !== null,
        mode: "compat-window",
      },
      "Origin không nằm trong allowlist — CSRF check đang ở chế độ chỉ cảnh báo",
    );
    return;
  }

  logger.warn(
    { route: options.route, hasOrigin: origin !== null },
    "Từ chối mutation vì Origin không hợp lệ",
  );
  throw new CsrfOriginError();
}
