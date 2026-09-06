// @vitest-environment node
// account-order.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
          data: [
            {
              ...baseRow,
              payment_method: paymentMethod,
              payment_status: dbStatus,
            },
          ],
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

// ─── RFC-3: chi tiết đơn của chính user ──────────────────────────────────────

/** Builder có `maybeSingle` + ghi lại các cặp `.eq()` để khẳng định bộ lọc. */
function makeDetailBuilder(result: { data?: unknown; error?: unknown }) {
  const eqCalls: [string, unknown][] = [];
  const builder: Record<string, unknown> = {
    eqCalls,
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

const detailRow = {
  ...baseRow,
  payment_review_state: "AWAITING_TRANSFER",
  payment_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
  state_version: 2,
};

describe("accountOrderService.getOwnedOrderDetail — AC08 IDOR", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lọc theo id VÀ user_id trong CÙNG một query", async () => {
    const builder = makeDetailBuilder({ data: detailRow });
    mocks.from.mockReturnValue(builder);

    await accountOrderService.getOwnedOrderDetail("user-1", "order-1");

    // Đọc đơn trước rồi so chủ sở hữu sau sẽ phân biệt được "không tồn tại"
    // với "của người khác" — biến endpoint thành oracle liệt kê đơn.
    expect(builder.eqCalls).toEqual([
      ["id", "order-1"],
      ["user_id", "user-1"],
    ]);
  });

  it("không khớp chủ sở hữu -> 404 NOT_FOUND, không phải 403", async () => {
    mocks.from.mockReturnValue(makeDetailBuilder({ data: null }));
    await expect(
      accountOrderService.getOwnedOrderDetail("user-2", "order-1"),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });
});

describe("accountOrderService.getOwnedOrderDetail — AC05 QR theo hạn thanh toán", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VIETQR_BANK_ID", "970407");
    vi.stubEnv("VIETQR_ACCOUNT_NO", "19001234567");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("đơn chuyển khoản còn hạn -> có QR + đủ hai hành động", async () => {
    mocks.from.mockReturnValue(makeDetailBuilder({ data: detailRow }));
    const order = await accountOrderService.getOwnedOrderDetail(
      "user-1",
      "order-1",
    );
    expect(order.qrImageUrl).toContain("img.vietqr.io");
    expect(order.allowedActions).toEqual(["claim_payment", "request_cancel"]);
    expect(order.stateVersion).toBe(2);
  });

  it("quá hạn -> ẨN QR nhưng KHÔNG tự huỷ đơn", async () => {
    mocks.from.mockReturnValue(
      makeDetailBuilder({
        data: {
          ...detailRow,
          payment_expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      }),
    );
    const order = await accountOrderService.getOwnedOrderDetail(
      "user-1",
      "order-1",
    );
    expect(order.qrImageUrl).toBeUndefined();
    expect(order.status).toBe("pending");
    // Quá hạn = vào đối soát, không phải mất quyền thao tác.
    expect(order.allowedActions).toContain("request_cancel");
  });

  it("đã claim -> không cho claim lần hai", async () => {
    mocks.from.mockReturnValue(
      makeDetailBuilder({
        data: { ...detailRow, payment_review_state: "PAYMENT_CLAIMED" },
      }),
    );
    const order = await accountOrderService.getOwnedOrderDetail(
      "user-1",
      "order-1",
    );
    expect(order.allowedActions).not.toContain("claim_payment");
  });

  it("đã PAID -> không QR, không hành động nào", async () => {
    mocks.from.mockReturnValue(
      makeDetailBuilder({ data: { ...detailRow, payment_status: "PAID" } }),
    );
    const order = await accountOrderService.getOwnedOrderDetail(
      "user-1",
      "order-1",
    );
    expect(order.qrImageUrl).toBeUndefined();
    expect(order.allowedActions).toEqual([]);
  });

  it("AC12 — đơn legacy PAYOS vẫn đọc được, không QR, không vỡ mapper", async () => {
    mocks.from.mockReturnValue(
      makeDetailBuilder({
        data: {
          ...detailRow,
          payment_method: "PAYOS",
          payment_review_state: null,
          payment_expires_at: null,
          state_version: null,
        },
      }),
    );
    const order = await accountOrderService.getOwnedOrderDetail(
      "user-1",
      "order-1",
    );
    expect(order.paymentMethod).toBe("PAYOS");
    expect(order.qrImageUrl).toBeUndefined();
    expect(order.stateVersion).toBe(0);
    expect(order.reviewState).toBeNull();
  });

  it("cột RFC-2 chưa tồn tại (42703) -> fallback bản tối thiểu, không 500", async () => {
    mocks.from
      .mockReturnValueOnce(
        makeDetailBuilder({
          error: { code: "42703", message: "column does not exist" },
        }),
      )
      .mockReturnValueOnce(makeDetailBuilder({ data: baseRow }));

    const order = await accountOrderService.getOwnedOrderDetail(
      "user-1",
      "order-1",
    );
    expect(order.reviewState).toBeNull();
    expect(order.stateVersion).toBe(0);
  });
});
