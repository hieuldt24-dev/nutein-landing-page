import { describe, it, expect } from "vitest";
import { classifyCheckoutSubmitError } from "./checkout-error";
import type { FetchError } from "@/lib/api-client";

function makeFetchError(
  status: number,
  code: string,
  message = "lỗi",
): FetchError {
  const err = new Error(message) as FetchError;
  err.status = status;
  err.code = code;
  return err;
}

describe("classifyCheckoutSubmitError", () => {
  it("409 UNPAID_ORDER_LIMIT -> cap (không phải retryable)", () => {
    const result = classifyCheckoutSubmitError(
      makeFetchError(409, "UNPAID_ORDER_LIMIT"),
    );
    expect(result.kind).toBe("cap");
  });

  it("429 -> retryable, đọc được số giây khi server có nhắc tới", () => {
    const result = classifyCheckoutSubmitError(
      makeFetchError(429, "CHECKOUT_RATE_LIMITED", "Thử lại sau 42 giây."),
    );
    expect(result.kind).toBe("retryable");
    expect(result.retryAfterSeconds).toBe(42);
  });

  it("429 không nói số giây -> KHÔNG bịa ra con số", () => {
    const result = classifyCheckoutSubmitError(
      makeFetchError(429, "CHECKOUT_RATE_LIMITED", "Quá nhiều yêu cầu."),
    );
    expect(result.kind).toBe("retryable");
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it("503 CHECKOUT_PROTECTION_UNAVAILABLE -> retryable", () => {
    expect(
      classifyCheckoutSubmitError(
        makeFetchError(503, "CHECKOUT_PROTECTION_UNAVAILABLE"),
      ).kind,
    ).toBe("retryable");
  });

  it("mất mạng (không có status) -> retryable, nói rõ bấm lại không tạo đơn trùng", () => {
    const result = classifyCheckoutSubmitError(
      new TypeError("Failed to fetch"),
    );
    expect(result.kind).toBe("retryable");
    expect(result.code).toBe("NETWORK_ERROR");
    expect(result.message).toMatch(/không tạo đơn trùng/i);
  });

  it("lỗi nghiệp vụ khác giữ nguyên message của server", () => {
    const result = classifyCheckoutSubmitError(
      makeFetchError(400, "BAD_REQUEST", "Sản phẩm đã hết hàng"),
    );
    expect(result.kind).toBe("other");
    expect(result.message).toBe("Sản phẩm đã hết hàng");
  });

  it("409 khác cap (VD PRICE_CHANGED) KHÔNG bị coi là cap", () => {
    expect(
      classifyCheckoutSubmitError(makeFetchError(409, "PRICE_CHANGED")).kind,
    ).toBe("other");
  });
});
