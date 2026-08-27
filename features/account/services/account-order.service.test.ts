// @vitest-environment node
// account-order.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(async () => result),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { accountOrderService } from "./account-order.service";

const baseRow = {
  id: "order-1",
  order_code: "NT-20260827-AB12",
  status: "PENDING",
  shipping_method: "STANDARD",
  final_price: 224000,
  created_at: "2026-08-27T00:00:00.000Z",
  payment_method: "BANK_TRANSFER",
  payment_status: "UNPAID",
  shipping_address: { variantLabel: "1 hộp" },
  order_items: [{ quantity: 1, variant_info: "1 hộp" }],
};

describe("accountOrderService.listOrders — AC7 payment status mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["BANK_TRANSFER", "UNPAID", "UNPAID"],
    ["BANK_TRANSFER", "PAID", "PAID"],
    ["COD", "UNPAID", "UNPAID"],
    ["COD", "PAID", "PAID"],
    // Đơn lịch sử đặt trước khi bỏ payOS vẫn map được, không làm vỡ mapper.
    ["PAYOS", "PAID", "PAID"],
  ] as const)(
    "%s + %s -> paymentStatus %s (không rẽ nhánh theo phương thức)",
    async (paymentMethod, dbStatus, expected) => {
      mocks.from.mockReturnValue(
        makeBuilder({
          data: [{ ...baseRow, payment_method: paymentMethod, payment_status: dbStatus }],
          error: null,
        }),
      );

      const [order] = await accountOrderService.listOrders("user-1");

      expect(order.paymentStatus).toBe(expected);
    },
  );

  it("không còn field canRetryPayment (nút thanh toán lại payOS đã bị gỡ)", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [baseRow], error: null }));

    const [order] = await accountOrderService.listOrders("user-1");

    expect(order).not.toHaveProperty("canRetryPayment");
    expect(order.orderCode).toBe("NT-20260827-AB12");
  });
});
