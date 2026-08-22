import { describe, it, expect } from "vitest";
import { createOrderRequestSchema } from "./checkout.schema";

const validBody = {
  lines: [{ variantId: "pack-1", quantity: 1 }],
  buyer: { fullName: "Nguyễn Văn A", phone: "0912345678", email: "a@example.com" },
  address: {
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
};

// AC9 — shape của request khoá "mỗi đơn tối đa 1 coupon" ngay ở tầng schema.
describe("createOrderRequestSchema — couponCode", () => {
  it("bỏ trống couponCode vẫn hợp lệ (optional)", () => {
    const parsed = createOrderRequestSchema.parse(validBody);
    expect(parsed.couponCode).toBeUndefined();
  });

  it("nhận đúng 1 chuỗi mã, tự trim", () => {
    const parsed = createOrderRequestSchema.parse({
      ...validBody,
      couponCode: "  SALE10  ",
    });
    expect(parsed.couponCode).toBe("SALE10");
  });

  it("từ chối mảng nhiều mã — không có cách nào gửi 2 coupon", () => {
    const result = createOrderRequestSchema.safeParse({
      ...validBody,
      couponCode: ["SALE10", "SALE20"],
    });
    expect(result.success).toBe(false);
  });

  it("từ chối chuỗi rỗng và mã dài quá 50 ký tự", () => {
    expect(
      createOrderRequestSchema.safeParse({ ...validBody, couponCode: "" }).success,
    ).toBe(false);
    expect(
      createOrderRequestSchema.safeParse({
        ...validBody,
        couponCode: "A".repeat(51),
      }).success,
    ).toBe(false);
  });
});
