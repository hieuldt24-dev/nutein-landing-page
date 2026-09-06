// @vitest-environment node
// checkout-protection.service.ts có `import "server-only"`.
import { describe, it, expect } from "vitest";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import {
  buildCanonicalCheckoutPayload,
  buildCheckoutRequestHash,
} from "./checkout-protection.service";

const base: CreateOrderRequest = {
  lines: [
    { variantId: "pack-1", quantity: 1 },
    { variantId: "pack-3", quantity: 2 },
  ],
  buyer: {
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    email: "A@Example.com",
  },
  address: {
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
  },
  note: "Giao giờ hành chính",
  shippingMethod: "standard",
  paymentMethod: "bank_transfer",
  couponCode: "sale10",
};

const hash = (input: CreateOrderRequest) => buildCheckoutRequestHash(input);

describe("buildCheckoutRequestHash — cùng đơn về NGHIỆP VỤ thì cùng hash", () => {
  it("ổn định giữa hai lần gọi", () => {
    expect(hash(base)).toBe(hash(base));
  });

  it("đảo thứ tự dòng KHÔNG đổi hash", () => {
    expect(hash({ ...base, lines: [base.lines[1], base.lines[0]] })).toBe(
      hash(base),
    );
  });

  it("gộp dòng trùng variant: [a:1, a:2] ≡ [a:3]", () => {
    const split = hash({
      ...base,
      lines: [{ variantId: "pack-1", quantity: 3 }],
    });
    const merged = hash({
      ...base,
      lines: [
        { variantId: "pack-1", quantity: 1 },
        { variantId: "pack-1", quantity: 2 },
      ],
    });
    expect(merged).toBe(split);
  });

  it("email hoa/thường và khoảng trắng thừa KHÔNG đổi hash", () => {
    expect(
      hash({
        ...base,
        buyer: {
          ...base.buyer,
          email: "  a@example.com  ",
          fullName: "Nguyễn  Văn A",
        },
      }),
    ).toBe(hash(base));
  });

  it("+84 và 0 là CÙNG số điện thoại", () => {
    expect(
      hash({ ...base, buyer: { ...base.buyer, phone: "+84912345678" } }),
    ).toBe(hash(base));
  });

  it("coupon hoa/thường KHÔNG đổi hash", () => {
    expect(hash({ ...base, couponCode: "SALE10" })).toBe(hash(base));
  });
});

describe("buildCheckoutRequestHash — đơn KHÁC nghiệp vụ thì khác hash", () => {
  it.each([
    ["số lượng", { lines: [{ variantId: "pack-1", quantity: 9 }] }],
    ["địa chỉ", { address: { ...base.address, street: "456 Đường XYZ" } }],
    ["ghi chú", { note: "Giao buổi tối" }],
    ["phương thức giao", { shippingMethod: "express" as const }],
    ["phương thức thanh toán", { paymentMethod: "cod" as const }],
    ["coupon", { couponCode: "SALE20" }],
    ["người mua", { buyer: { ...base.buyer, phone: "0900000000" } }],
  ])("đổi %s -> hash khác", (_label, patch) => {
    expect(
      hash({ ...base, ...(patch as Partial<CreateOrderRequest>) }),
    ).not.toBe(hash(base));
  });

  it("bỏ coupon -> hash khác", () => {
    const withoutCoupon = { ...base };
    delete withoutCoupon.couponCode;
    expect(hash(withoutCoupon)).not.toBe(hash(base));
  });
});

describe("canonical payload — LOẠI TRỪ giá/thời gian/token", () => {
  it("chỉ chứa các field nghiệp vụ đã khai báo", () => {
    expect(Object.keys(buildCanonicalCheckoutPayload(base)).sort()).toEqual([
      "address",
      "buyer",
      "couponCode",
      "lines",
      "note",
      "paymentMethod",
      "shippingMethod",
      "v",
    ]);
  });

  it("không có field giá, tổng tiền, timestamp, token hay userId", () => {
    const serialized = JSON.stringify(buildCanonicalCheckoutPayload(base));
    for (const forbidden of [
      "price",
      "total",
      "amount",
      "token",
      "userId",
      "createdAt",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
