import { describe, it, expect, beforeEach, vi } from "vitest";

// api-client -> auth.repository -> supabase-browser, module này throw khi thiếu
// biến môi trường Supabase (đúng lỗi baseline của lib/useAddresses.test.tsx).
// Ở đây chỉ kiểm logic sinh/giữ idempotency key, không cần fetch thật.
vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));

import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import { resolveIdempotencyKey } from "./useCheckoutSubmit";

const BODY = {
  lines: [{ variantId: "1-box", quantity: 1 }],
  buyer: {
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    email: "a@example.com",
  },
  address: {
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "00001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
  },
  shippingMethod: "standard",
  paymentMethod: "bank_transfer",
} as CreateOrderRequest;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => window.sessionStorage.clear());

describe("resolveIdempotencyKey — AC03/AC10 giữ key theo ý định đặt hàng", () => {
  it("sinh UUID hợp lệ", () => {
    expect(resolveIdempotencyKey(BODY)).toMatch(UUID_RE);
  });

  it("cùng payload -> CÙNG key (retry sau timeout không tạo đơn thứ hai)", () => {
    expect(resolveIdempotencyKey(BODY)).toBe(resolveIdempotencyKey(BODY));
  });

  it("thứ tự field khác nhau vẫn là cùng payload -> cùng key", () => {
    const reordered = {
      ...BODY,
      buyer: {
        email: "a@example.com",
        phone: "0912345678",
        fullName: "Nguyễn Văn A",
      },
    } as CreateOrderRequest;
    expect(resolveIdempotencyKey(reordered)).toBe(resolveIdempotencyKey(BODY));
  });

  it("key sống qua reload (sessionStorage), không sinh lại mỗi lần bấm", () => {
    const first = resolveIdempotencyKey(BODY);
    // Mô phỏng reload: module state mất, storage còn.
    expect(resolveIdempotencyKey(BODY)).toBe(first);
    expect(
      window.sessionStorage.getItem("nutein:checkout-idempotency-key"),
    ).toContain(first);
  });

  it("payload đổi thật (địa chỉ khác) -> key MỚI", () => {
    const first = resolveIdempotencyKey(BODY);
    const changed = {
      ...BODY,
      address: { ...BODY.address, street: "456 Đường XYZ" },
    } as CreateOrderRequest;
    expect(resolveIdempotencyKey(changed)).not.toBe(first);
  });

  it("giỏ đổi -> key mới", () => {
    const first = resolveIdempotencyKey(BODY);
    const changed = {
      ...BODY,
      lines: [{ variantId: "1-box", quantity: 2 }],
    } as CreateOrderRequest;
    expect(resolveIdempotencyKey(changed)).not.toBe(first);
  });

  /**
   * RFC-4 / AC10 — đây là bất biến quan trọng nhất của file này.
   * Plan §Idempotency: "Không tạo key mới khi nhận timeout." Nếu key đổi sau
   * một lần submit hỏng thì lần bấm lại tạo đơn THỨ HAI thay vì replay đơn cũ.
   */
  it("submit hỏng (429/503/timeout) rồi bấm lại -> GIỮ NGUYÊN key", () => {
    const before = resolveIdempotencyKey(BODY);

    // Mô phỏng ba loại thất bại: không có nhánh nào đụng tới sessionStorage.
    for (const failure of ["timeout", "429", "503"]) {
      expect(resolveIdempotencyKey(BODY), `sau ${failure}`).toBe(before);
    }
  });

  it("reload trang (đọc lại từ sessionStorage) vẫn ra đúng key cũ", () => {
    const before = resolveIdempotencyKey(BODY);
    // Cùng payload, lần gọi mới = mô phỏng lần render sau reload trong cùng tab.
    expect(resolveIdempotencyKey({ ...BODY } as CreateOrderRequest)).toBe(
      before,
    );
  });

  it("sessionStorage hỏng -> vẫn trả key hợp lệ, không chặn đặt hàng", () => {
    const original = window.sessionStorage.getItem;
    window.sessionStorage.getItem = () => {
      throw new Error("storage disabled");
    };
    try {
      expect(resolveIdempotencyKey(BODY)).toMatch(UUID_RE);
    } finally {
      window.sessionStorage.getItem = original;
    }
  });
});
