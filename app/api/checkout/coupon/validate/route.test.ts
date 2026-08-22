// @vitest-environment node
// route.ts -> coupon-validation.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  couponPreviewLimiter: vi.fn(),
  authenticate: vi.fn(),
  validateAndComputeDiscount: vi.fn(),
}));

vi.mock("@/src/middlewares/rate-limit.middleware", () => ({
  couponPreviewLimiter: mocks.couponPreviewLimiter,
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("@/features/checkout/services/coupon-validation.service", () => ({
  couponValidationService: {
    validateAndComputeDiscount: mocks.validateAndComputeDiscount,
  },
}));

import { NextRequest, NextResponse } from "next/server";
import { BadRequestError, UnauthorizedError } from "@/src/errors/app.error";
import { POST } from "./route";

function previewRequest(body: unknown = { couponCode: "SALE10", subtotal: 500_000 }) {
  return new NextRequest("http://localhost:3000/api/checkout/coupon/validate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/checkout/coupon/validate — Mitigation 1 (auth + rate limit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.couponPreviewLimiter.mockResolvedValue(null);
    mocks.authenticate.mockResolvedValue({ userId: "user-1", role: "CUSTOMER" });
    mocks.validateAndComputeDiscount.mockResolvedValue({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 50_000,
    });
  });

  it("mã hợp lệ → 200 { valid: true, ... }", async () => {
    const response = await POST(previewRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      valid: true,
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 50_000,
    });
  });

  it("chưa đăng nhập → 401, KHÔNG tra coupon (không cho dò mã ẩn danh)", async () => {
    mocks.authenticate.mockRejectedValue(new UnauthorizedError("Chưa đăng nhập"));

    const response = await POST(previewRequest());

    expect(response.status).toBe(401);
    expect(mocks.validateAndComputeDiscount).not.toHaveBeenCalled();
  });

  it("vượt ngưỡng limiter → 429 và KHÔNG chạy authenticate lẫn tra coupon", async () => {
    mocks.couponPreviewLimiter.mockResolvedValue(
      NextResponse.json(
        { success: false, error: { code: "TOO_MANY_COUPON_CHECKS" } },
        { status: 429 },
      ),
    );

    const response = await POST(previewRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("TOO_MANY_COUPON_CHECKS");
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.validateAndComputeDiscount).not.toHaveBeenCalled();
  });

  it("limiter là guard-clause đầu tiên — chạy trước cả parse body", async () => {
    mocks.couponPreviewLimiter.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "TOO_MANY_COUPON_CHECKS" } }, { status: 429 }),
    );

    const badRequest = new NextRequest(
      "http://localhost:3000/api/checkout/coupon/validate",
      { method: "POST" },
    );
    const response = await POST(badRequest);

    expect(response.status).toBe(429);
  });

  it("mã không hợp lệ → 200 { valid: false, reason } (không phải lỗi server)", async () => {
    mocks.validateAndComputeDiscount.mockRejectedValue(
      new BadRequestError("Mã giảm giá đã hết hạn"),
    );

    const response = await POST(previewRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ valid: false, reason: "Mã giảm giá đã hết hạn" });
  });

  it("lỗi không phải BadRequestError vẫn nổi lên thành lỗi server (không nuốt)", async () => {
    mocks.validateAndComputeDiscount.mockRejectedValue(new Error("supabase down"));

    const response = await POST(previewRequest());

    expect(response.status).toBe(500);
  });

  it("body sai shape → 400 từ Zod", async () => {
    const response = await POST(previewRequest({ couponCode: "", subtotal: -1 }));

    expect(response.status).toBe(400);
    expect(mocks.validateAndComputeDiscount).not.toHaveBeenCalled();
  });
});
