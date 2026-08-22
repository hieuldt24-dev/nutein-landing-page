// @vitest-environment node
// coupon-validation.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AdminCoupon } from "@/features/admin-coupons/types";

const mocks = vi.hoisted(() => ({
  findByCode: vi.fn(),
}));

vi.mock("@/features/admin-coupons/services/admin-coupons.repository", () => ({
  adminCouponsRepository: { findByCode: mocks.findByCode },
}));

import { couponValidationService } from "./coupon-validation.service";
import { COUPON_MESSAGES } from "../constants";

function coupon(overrides: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    id: "coupon-1",
    code: "SALE10",
    discountType: "FIXED",
    discount: 10_000,
    minOrderValue: null,
    usageLimit: null,
    usedCount: 0,
    isActive: true,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("couponValidationService.validateAndComputeDiscount", () => {
  beforeEach(() => vi.clearAllMocks());

  // AC3
  it("mã không tồn tại → BadRequestError với message riêng của app layer", async () => {
    mocks.findByCode.mockResolvedValue(null);

    await expect(
      couponValidationService.validateAndComputeDiscount({
        code: "KHONGCO",
        subtotal: 500_000,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: COUPON_MESSAGES.notFound });
  });

  // AC5
  it("coupon is_active=false → từ chối bằng đúng text của trigger DB", async () => {
    mocks.findByCode.mockResolvedValue(coupon({ isActive: false }));

    await expect(
      couponValidationService.validateAndComputeDiscount({
        code: "SALE10",
        subtotal: 500_000,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: COUPON_MESSAGES.inactive });
  });

  // AC4
  it("coupon hết hạn (expires_at quá khứ) → 'Mã giảm giá đã hết hạn'", async () => {
    mocks.findByCode.mockResolvedValue(
      coupon({ expiresAt: "2020-01-01T00:00:00.000Z" }),
    );

    await expect(
      couponValidationService.validateAndComputeDiscount({
        code: "SALE10",
        subtotal: 500_000,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: COUPON_MESSAGES.expired });
  });

  it("coupon còn hạn (expires_at tương lai) → vẫn áp dụng bình thường", async () => {
    mocks.findByCode.mockResolvedValue(
      coupon({ expiresAt: "2999-01-01T00:00:00.000Z" }),
    );

    const result = await couponValidationService.validateAndComputeDiscount({
      code: "SALE10",
      subtotal: 500_000,
    });

    expect(result.discountAmount).toBe(10_000);
  });

  // AC6
  it("used_count >= usage_limit → 'Mã giảm giá đã hết lượt sử dụng'", async () => {
    mocks.findByCode.mockResolvedValue(coupon({ usageLimit: 5, usedCount: 5 }));

    await expect(
      couponValidationService.validateAndComputeDiscount({
        code: "SALE10",
        subtotal: 500_000,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COUPON_MESSAGES.usageExhausted,
    });
  });

  // AC7 — min_order_value đối chiếu với tạm tính TRƯỚC giảm giá voucher.
  it("tạm tính dưới min_order_value → báo mức tối thiểu cần đạt", async () => {
    mocks.findByCode.mockResolvedValue(coupon({ minOrderValue: 1_000_000 }));

    await expect(
      couponValidationService.validateAndComputeDiscount({
        code: "SALE10",
        subtotal: 999_999,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Đơn hàng cần tối thiểu"),
    });
  });

  it("tạm tính đúng bằng min_order_value → hợp lệ (biên >=)", async () => {
    mocks.findByCode.mockResolvedValue(coupon({ minOrderValue: 500_000 }));

    const result = await couponValidationService.validateAndComputeDiscount({
      code: "SALE10",
      subtotal: 500_000,
    });

    expect(result).toEqual({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 10_000,
    });
  });

  // AC1
  it("PERCENTAGE → tính theo % của tạm tính", async () => {
    mocks.findByCode.mockResolvedValue(
      coupon({ discountType: "PERCENTAGE", discount: 10 }),
    );

    const result = await couponValidationService.validateAndComputeDiscount({
      code: "SALE10",
      subtotal: 500_000,
    });

    expect(result.discountAmount).toBe(50_000);
  });

  it("chuẩn hoá mã: trim + upper-case trước khi tra DB", async () => {
    mocks.findByCode.mockResolvedValue(coupon());

    await couponValidationService.validateAndComputeDiscount({
      code: "  sale10  ",
      subtotal: 500_000,
    });

    expect(mocks.findByCode).toHaveBeenCalledWith("SALE10");
  });

  // Mitigation 2 — clamp phòng thủ, độc lập với ràng buộc .max(100) ở schema admin.
  it("FIXED vượt tạm tính → clamp về đúng tạm tính (tổng đơn không âm)", async () => {
    mocks.findByCode.mockResolvedValue(coupon({ discount: 900_000 }));

    const result = await couponValidationService.validateAndComputeDiscount({
      code: "SALE10",
      subtotal: 500_000,
    });

    expect(result.discountAmount).toBe(500_000);
  });

  it("PERCENTAGE > 100 (dữ liệu cũ lọt qua) → vẫn clamp về tạm tính", async () => {
    mocks.findByCode.mockResolvedValue(
      coupon({ discountType: "PERCENTAGE", discount: 250 }),
    );

    const result = await couponValidationService.validateAndComputeDiscount({
      code: "SALE10",
      subtotal: 500_000,
    });

    expect(result.discountAmount).toBe(500_000);
  });
});
