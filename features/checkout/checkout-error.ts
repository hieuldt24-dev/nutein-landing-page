import type { FetchError } from "@/lib/api-client";

/**
 * Phân loại lỗi submit checkout cho UI (RFC-4).
 *
 * Ba nhóm có cách xử lý KHÁC HẲN nhau, nên không được gộp thành một toast:
 *
 * - `cap`     — 409 `UNPAID_ORDER_LIMIT`: khách đã giữ đủ số đơn cho phép.
 *               Bấm lại KHÔNG bao giờ thành công, nên UI tuyệt đối không mời
 *               thử lại; phải dẫn khách về xử lý các đơn cũ.
 * - `retryable` — 429 / 503 / timeout mạng: request có thể đã tới server rồi
 *               response mới mất. Giữ giỏ VÀ giữ nguyên idempotency key để lần
 *               bấm sau là REPLAY chứ không tạo đơn thứ hai
 *               (plan §Idempotency: "Không tạo key mới khi nhận timeout").
 * - `other`   — lỗi nghiệp vụ thường (hết hàng, coupon sai, giá đổi): hiển thị
 *               nguyên message của server.
 *
 * Giỏ hàng KHÔNG bị xoá ở bất kỳ nhánh nào — `CheckoutForm` chỉ xoá giỏ sau
 * khi đã có đơn thật.
 */

export type CheckoutSubmitErrorKind = "cap" | "retryable" | "other";

export interface CheckoutSubmitError {
  kind: CheckoutSubmitErrorKind;
  code: string;
  message: string;
  /** Số giây nên chờ trước khi thử lại — chỉ có với 429 có `Retry-After`. */
  retryAfterSeconds?: number;
}

const RETRYABLE_CODES = new Set([
  "CHECKOUT_RATE_LIMITED",
  "CHECKOUT_PROTECTION_UNAVAILABLE",
]);

/**
 * `Retry-After` được server trả ở HEADER, còn `apiRequest` chỉ dựng lại
 * message/code từ body. Vớt số giây từ message nếu server có nhắc tới, nhưng
 * không bịa ra giá trị khi không có — UI phải nói "thử lại sau ít phút" thay
 * vì hiển thị một con số sai.
 */
function parseRetryAfterSeconds(message: string): number | undefined {
  const match = /(\d+)\s*giây/.exec(message);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export function classifyCheckoutSubmitError(
  error: unknown,
): CheckoutSubmitError {
  const fetchError = error as FetchError | undefined;
  const status = fetchError?.status;
  const code = fetchError?.code ?? "NETWORK_ERROR";
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Đặt hàng thất bại — vui lòng thử lại";

  if (status === 409 && code === "UNPAID_ORDER_LIMIT") {
    return { kind: "cap", code, message };
  }

  // Không có `status` = request chưa bao giờ nhận được response HTTP (mất
  // mạng, timeout). Đây CHÍNH LÀ trường hợp idempotency tồn tại để xử lý.
  const isNetworkFailure = status === undefined;
  if (
    isNetworkFailure ||
    status === 429 ||
    status === 503 ||
    RETRYABLE_CODES.has(code)
  ) {
    return {
      kind: "retryable",
      code: isNetworkFailure ? "NETWORK_ERROR" : code,
      message: isNetworkFailure
        ? "Mất kết nối khi đang gửi đơn. Đơn có thể đã được tạo — bấm lại để kiểm tra, hệ thống sẽ không tạo đơn trùng."
        : message,
      ...(status === 429
        ? { retryAfterSeconds: parseRetryAfterSeconds(message) }
        : {}),
    };
  }

  return { kind: "other", code, message };
}
