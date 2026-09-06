import type { AccountOrderDetail } from "./types";

/**
 * Trình bày vòng đời chuyển khoản cho khách (RFC-4).
 *
 * Ba nguyên tắc bất di bất dịch ở file này, tất cả đều từ plan:
 *
 * 1. **Hạn thanh toán chỉ đến từ server** (`payment_expires_at`, đồng hồ DB).
 *    Không có hàm nào ở đây tự tính hạn từ `createdAt` + 30 phút. `null` nghĩa
 *    là KHÔNG có hạn (đơn COD, đơn legacy, enforcement chưa bật) — khi đó
 *    tuyệt đối không vẽ đồng hồ đếm ngược bịa ra.
 * 2. **Quá hạn chỉ ẨN QR**, không đổi trạng thái đơn. Không có worker hết hạn
 *    (known-gap của plan), nên client tự "hết hạn hoá" một đơn là nói dối.
 *    Trạng thái thật chỉ đổi ở server.
 * 3. **Claim là LỜI KHAI của khách**, không phải xác nhận thanh toán. Mọi
 *    label ở đây phải nói rõ nhân viên mới là người xác nhận.
 *
 * `now` luôn là tham số tường minh để test khẳng định được hành vi mà không
 * phụ thuộc đồng hồ máy chạy test.
 */

/** Nhãn tiếng Việt cho `orders.payment_review_state`. */
export const PAYMENT_REVIEW_STATE_LABEL: Record<string, string> = {
  AWAITING_TRANSFER: "Chờ bạn chuyển khoản",
  PAYMENT_CLAIMED: "Bạn đã báo chuyển khoản — chờ nhân viên đối soát",
  REVIEW_REQUIRED: "Đang chờ nhân viên đối soát",
  CANCEL_REQUESTED: "Đã gửi yêu cầu hủy — chờ nhân viên xử lý",
  RELEASED: "Đã hủy và hoàn lại hàng giữ chỗ",
  SETTLED: "Đã đối soát xong",
  LATE_TRANSFER_REVIEW: "Đang xử lý khoản chuyển đến muộn",
};

export function paymentReviewStateLabel(state: string | null): string | null {
  if (!state) return null;
  return PAYMENT_REVIEW_STATE_LABEL[state] ?? state;
}

/** Hạn đã qua chưa. `null` (không có hạn) -> KHÔNG bao giờ coi là quá hạn. */
export function isPaymentDeadlinePassed(
  paymentExpiresAt: string | null | undefined,
  now: Date,
): boolean {
  if (!paymentExpiresAt) return false;
  const deadline = new Date(paymentExpiresAt);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() <= now.getTime();
}

/**
 * Có hiển thị QR không.
 *
 * Điều kiện đủ: server còn trả `qrImageUrl` (server đã tự kiểm `canStillPay`)
 * VÀ hạn chưa qua theo giờ server. Hai lớp kiểm cùng chiều — client chỉ có thể
 * ẩn QR sớm hơn server, không bao giờ hiện QR mà server đã thu hồi.
 */
export function shouldShowPaymentQr(
  order: Pick<AccountOrderDetail, "qrImageUrl" | "paymentExpiresAt">,
  now: Date,
): boolean {
  if (!order.qrImageUrl) return false;
  return !isPaymentDeadlinePassed(order.paymentExpiresAt, now);
}

/** Chuỗi hạn thanh toán để hiển thị. `null` = không có hạn -> đừng vẽ gì cả. */
export function formatPaymentDeadline(
  paymentExpiresAt: string | null | undefined,
): string | null {
  if (!paymentExpiresAt) return null;
  const deadline = new Date(paymentExpiresAt);
  if (Number.isNaN(deadline.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(deadline);
  } catch {
    return paymentExpiresAt;
  }
}

export interface PaymentReviewPresentation {
  /** Câu tiêu đề trạng thái — luôn có, kể cả đơn legacy không có review state. */
  headline: string;
  /** Câu giải thích ngắn; luôn nói rõ ai là người xác nhận thanh toán. */
  detail: string;
  showQr: boolean;
  deadlineLabel: string | null;
  deadlinePassed: boolean;
}

/**
 * Gom toàn bộ quyết định hiển thị vào một hàm thuần — component chỉ vẽ.
 */
export function describePaymentReview(
  order: Pick<
    AccountOrderDetail,
    | "paymentMethod"
    | "paymentStatus"
    | "status"
    | "reviewState"
    | "paymentExpiresAt"
    | "qrImageUrl"
  >,
  now: Date,
): PaymentReviewPresentation {
  const deadlineLabel = formatPaymentDeadline(order.paymentExpiresAt);
  const deadlinePassed = isPaymentDeadlinePassed(order.paymentExpiresAt, now);
  const showQr = shouldShowPaymentQr(order, now);

  if (order.paymentStatus === "PAID") {
    return {
      headline: "Đã nhận thanh toán",
      detail: "Nhân viên đã đối soát và xác nhận nhận được tiền của bạn.",
      showQr: false,
      deadlineLabel,
      deadlinePassed,
    };
  }

  if (order.status === "cancelled") {
    return {
      headline: "Đơn đã hủy",
      detail:
        "Đơn này đã được đóng. Nếu bạn đã chuyển khoản, hãy liên hệ với chúng tôi để được đối soát.",
      showQr: false,
      deadlineLabel,
      deadlinePassed,
    };
  }

  if (order.paymentMethod !== "BANK_TRANSFER") {
    return {
      headline: "Thanh toán khi nhận hàng",
      detail: "Bạn thanh toán trực tiếp cho nhân viên giao hàng.",
      showQr: false,
      deadlineLabel: null,
      deadlinePassed: false,
    };
  }

  if (order.reviewState === "CANCEL_REQUESTED") {
    return {
      headline: "Đã gửi yêu cầu hủy",
      detail:
        "Đây là YÊU CẦU hủy, đơn chưa được hủy ngay. Nhân viên sẽ đối soát rồi phản hồi bạn.",
      showQr: false,
      deadlineLabel,
      deadlinePassed,
    };
  }

  if (order.reviewState === "PAYMENT_CLAIMED") {
    return {
      headline: "Bạn đã báo chuyển khoản",
      detail:
        "Đây là lời khai của bạn, CHƯA phải xác nhận thanh toán. Nhân viên sẽ đối chiếu sao kê ngân hàng rồi xác nhận.",
      showQr,
      deadlineLabel,
      deadlinePassed,
    };
  }

  if (deadlinePassed || order.reviewState === "REVIEW_REQUIRED") {
    return {
      headline: "Đang chờ nhân viên đối soát",
      detail:
        "Đã qua hạn chuyển khoản nên mã QR được tạm ẩn. Đơn của bạn CHƯA bị hủy — nhân viên sẽ kiểm tra sao kê rồi liên hệ với bạn.",
      showQr: false,
      deadlineLabel,
      deadlinePassed,
    };
  }

  return {
    headline: "Chờ chuyển khoản",
    detail:
      "Quét mã QR để chuyển khoản. Đơn được xác nhận thủ công sau khi nhân viên đối soát nhận được tiền.",
    showQr,
    deadlineLabel,
    deadlinePassed,
  };
}
