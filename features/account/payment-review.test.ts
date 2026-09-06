import { describe, it, expect } from "vitest";
import {
  describePaymentReview,
  formatPaymentDeadline,
  isPaymentDeadlinePassed,
  shouldShowPaymentQr,
} from "./payment-review";
import type { AccountOrderDetail } from "./types";

const NOW = new Date("2026-09-06T10:00:00.000Z");

function makeDetail(
  overrides: Partial<AccountOrderDetail> = {},
): AccountOrderDetail {
  return {
    id: "order-1",
    orderCode: "NT-20260906-AB12",
    status: "pending",
    createdAt: "2026-09-06T09:30:00.000Z",
    quantity: 1,
    variantLabel: "1 hộp",
    total: 224000,
    paymentStatus: "UNPAID",
    paymentMethod: "BANK_TRANSFER",
    paymentExpiresAt: "2026-09-06T10:30:00.000Z",
    reviewState: "AWAITING_TRANSFER",
    stateVersion: 3,
    qrImageUrl: "https://img.vietqr.io/image/x.png",
    allowedActions: ["claim_payment", "request_cancel"],
    ...overrides,
  };
}

describe("isPaymentDeadlinePassed — hạn CHỈ từ giờ server", () => {
  it("null (không có hạn) không bao giờ là quá hạn", () => {
    expect(isPaymentDeadlinePassed(null, NOW)).toBe(false);
    expect(isPaymentDeadlinePassed(undefined, NOW)).toBe(false);
  });

  it("chuỗi hạn hỏng cũng không bị coi là quá hạn", () => {
    expect(isPaymentDeadlinePassed("không-phải-ngày", NOW)).toBe(false);
  });

  it("so sánh đúng hai phía mốc thời gian", () => {
    expect(isPaymentDeadlinePassed("2026-09-06T10:30:00.000Z", NOW)).toBe(
      false,
    );
    expect(isPaymentDeadlinePassed("2026-09-06T09:59:59.000Z", NOW)).toBe(true);
    // Đúng bằng hạn -> coi là đã hết hạn.
    expect(isPaymentDeadlinePassed("2026-09-06T10:00:00.000Z", NOW)).toBe(true);
  });
});

describe("QR", () => {
  it("ẩn QR sau khi quá hạn dù server vẫn còn trả qrImageUrl", () => {
    const order = makeDetail({ paymentExpiresAt: "2026-09-06T09:00:00.000Z" });
    expect(order.qrImageUrl).toBeTruthy();
    expect(shouldShowPaymentQr(order, NOW)).toBe(false);
  });

  it("không có hạn (enforcement tắt / đơn legacy) thì vẫn hiện QR", () => {
    expect(
      shouldShowPaymentQr(makeDetail({ paymentExpiresAt: null }), NOW),
    ).toBe(true);
  });

  it("server không trả QR thì không tự dựng QR", () => {
    expect(
      shouldShowPaymentQr(makeDetail({ qrImageUrl: undefined }), NOW),
    ).toBe(false);
  });
});

describe("formatPaymentDeadline", () => {
  it("null -> null, để UI KHÔNG vẽ đồng hồ đếm ngược bịa ra", () => {
    expect(formatPaymentDeadline(null)).toBeNull();
    expect(formatPaymentDeadline(undefined)).toBeNull();
  });

  it("có hạn -> chuỗi hiển thị", () => {
    expect(formatPaymentDeadline("2026-09-06T10:30:00.000Z")).toBeTruthy();
  });
});

describe("describePaymentReview", () => {
  it("claim là LỜI KHAI, không phải xác nhận thanh toán", () => {
    const result = describePaymentReview(
      makeDetail({ reviewState: "PAYMENT_CLAIMED" }),
      NOW,
    );
    expect(result.headline).toMatch(/đã báo chuyển khoản/i);
    expect(result.detail).toMatch(/CHƯA phải xác nhận thanh toán/i);
    expect(result.detail).toMatch(/sao kê/i);
  });

  it("quá hạn -> trạng thái đối soát, ẩn QR, KHÔNG nói đơn đã bị hủy", () => {
    const result = describePaymentReview(
      makeDetail({ paymentExpiresAt: "2026-09-06T09:00:00.000Z" }),
      NOW,
    );
    expect(result.showQr).toBe(false);
    expect(result.deadlinePassed).toBe(true);
    expect(result.detail).toMatch(/CHƯA bị hủy/i);
  });

  it("yêu cầu hủy được mô tả là YÊU CẦU, không phải đã hủy", () => {
    const result = describePaymentReview(
      makeDetail({ reviewState: "CANCEL_REQUESTED" }),
      NOW,
    );
    expect(result.detail).toMatch(/chưa được hủy ngay/i);
    expect(result.showQr).toBe(false);
  });

  it("đơn đã trả tiền / đã hủy không còn QR", () => {
    expect(
      describePaymentReview(makeDetail({ paymentStatus: "PAID" }), NOW).showQr,
    ).toBe(false);
    expect(
      describePaymentReview(makeDetail({ status: "cancelled" }), NOW).showQr,
    ).toBe(false);
  });

  it("đơn COD không có hạn thanh toán nào được vẽ ra", () => {
    const result = describePaymentReview(
      makeDetail({ paymentMethod: "COD", paymentExpiresAt: null }),
      NOW,
    );
    expect(result.deadlineLabel).toBeNull();
    expect(result.showQr).toBe(false);
  });
});
