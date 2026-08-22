import { describe, it, expect } from "vitest";
import {
  adminCouponInputSchema,
  adminCouponUpdateSchema,
} from "./admin-coupons.schema";

function baseCoupon(overrides: Record<string, unknown> = {}) {
  return {
    code: "sale10",
    discountType: "PERCENTAGE",
    discount: 10,
    minOrderValue: null,
    usageLimit: null,
    isActive: true,
    expiresAt: null,
    ...overrides,
  };
}

describe("adminCouponInputSchema — trần giảm giá theo %", () => {
  it("PERCENTAGE > 100 -> reject, lỗi gắn vào field `discount`", () => {
    const result = adminCouponInputSchema.safeParse(
      baseCoupon({ discountType: "PERCENTAGE", discount: 101 }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["discount"]);
      expect(result.error.issues[0].message).toBe("Giảm theo % không vượt quá 100.");
    }
  });

  it("PERCENTAGE = 100 (biên) -> accept", () => {
    expect(
      adminCouponInputSchema.safeParse(
        baseCoupon({ discountType: "PERCENTAGE", discount: 100 }),
      ).success,
    ).toBe(true);
  });

  it("PERCENTAGE = 0 -> accept", () => {
    expect(
      adminCouponInputSchema.safeParse(
        baseCoupon({ discountType: "PERCENTAGE", discount: 0 }),
      ).success,
    ).toBe(true);
  });

  it("FIXED 500000 -> accept (trần % không áp cho FIXED)", () => {
    expect(
      adminCouponInputSchema.safeParse(
        baseCoupon({ discountType: "FIXED", discount: 500000 }),
      ).success,
    ).toBe(true);
  });

  it("giữ nguyên transform code -> UPPERCASE", () => {
    const result = adminCouponInputSchema.safeParse(baseCoupon());
    expect(result.success && result.data.code).toBe("SALE10");
  });
});

describe("adminCouponUpdateSchema — partial vẫn áp trần", () => {
  it("partial có đủ discountType + discount > 100 -> reject", () => {
    const result = adminCouponUpdateSchema.safeParse({
      discountType: "PERCENTAGE",
      discount: 101,
    });
    expect(result.success).toBe(false);
  });

  // Không đánh giá được nếu thiếu discountType — không chặn oan.
  it("partial chỉ có discount: 101 (không có discountType) -> vẫn parse được", () => {
    expect(adminCouponUpdateSchema.safeParse({ discount: 101 }).success).toBe(true);
  });

  it("partial rỗng -> parse được", () => {
    expect(adminCouponUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("partial FIXED discount lớn -> accept", () => {
    expect(
      adminCouponUpdateSchema.safeParse({ discountType: "FIXED", discount: 500000 })
        .success,
    ).toBe(true);
  });
});
