// @vitest-environment node
// order.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import { NUTEIN_PRODUCT_DB_ID } from "@/features/product/constants";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

/** Query builder giả — mọi method chain trả về chính nó, awaitable qua `then`. */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));

// next/server thật: after() throw nếu gọi ngoài request scope (Next quản lý
// qua AsyncLocalStorage) — không có request nào trong test. Chạy callback ngay.
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
}));

vi.mock("@/features/admin-audit/services/audit-log.repository", () => ({
  auditLogRepository: { record: vi.fn(async () => undefined) },
}));

import { orderRepository } from "./order.repository";
import { auditLogRepository } from "@/features/admin-audit/services/audit-log.repository";

const baseInput: CreateOrderRequest = {
  lines: [{ variantId: "pack-1", quantity: 1 }],
  buyer: {
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    email: "a@example.com",
  },
  address: {
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
  },
  shippingMethod: "standard",
  paymentMethod: "bank_transfer",
};

const baseMoney = {
  unitPrice: 199000,
  subtotal: 199000,
  discountAmount: 0,
  shippingFee: 25000,
  total: 224000,
};

const basePolicy = {
  protectionVersion: 1,
  bankActiveCap: 2,
  codActiveCap: null,
  dailyQuota: null,
  paymentTtlSeconds: 1800,
};

const rpcRow = {
  replayed: false,
  order_id: "order-1",
  order_code: "NT-20260906-AB12",
  status: "PENDING",
  payment_status: "UNPAID",
  payment_review_state: "AWAITING_TRANSFER",
  payment_expires_at: "2026-09-06T00:30:00.000Z",
  state_version: 0,
  created_at: "2026-09-06T00:00:00.000Z",
};

function callCreate(
  overrides: Partial<Parameters<typeof orderRepository.createAtomic>[0]> = {},
) {
  return orderRepository.createAtomic({
    userId: "user-1",
    input: baseInput,
    money: baseMoney,
    meta: {
      orderCode: "NT-20260906-AB12",
      status: "PENDING",
      paymentStatus: "UNPAID",
    },
    idempotency: { key: "key-1", requestHash: "hash-1", hashVersion: 1 },
    policy: basePolicy,
    ...overrides,
  });
}

describe("orderRepository.createAtomic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gọi ĐÚNG MỘT RPC atomic — không còn đường hai-write orders + order_items", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcRow, error: null });

    await callCreate();

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "checkout_create_order_atomic",
      expect.anything(),
    );
    // Không còn bất kỳ ghi trực tiếp nào vào orders/order_items -> không còn
    // compensating delete -> không còn rò rỉ lượt coupon.
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("map payment/shipping method và gửi items đã quy đổi số hũ", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcRow, error: null });

    await callCreate();

    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload.payment_method).toBe("BANK_TRANSFER");
    expect(payload.shipping_method).toBe("STANDARD");
    expect(payload.bank_active_cap).toBe(2);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].product_id).toBe(NUTEIN_PRODUCT_DB_ID);
    expect(payload.items[0].quantity).toBeGreaterThan(0);
  });

  it("KHÔNG gửi coupon_id lên DB — chỉ gửi code để RPC tự tra dưới lock", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcRow, error: null });

    await callCreate({
      coupon: {
        couponId: "coupon-1",
        couponCode: "SALE10",
        couponDiscountAmount: 20000,
      },
    });

    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload).not.toHaveProperty("coupon_id");
    expect(payload.coupon_code).toBe("SALE10");
    expect(payload.coupon_discount_amount).toBe(20000);
  });

  it("cod map sang COD", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...rpcRow, payment_review_state: null, payment_expires_at: null },
      error: null,
    });

    const result = await callCreate({
      input: { ...baseInput, paymentMethod: "cod" },
    });

    expect(mocks.rpc.mock.calls[0][1].p_payload.payment_method).toBe("COD");
    expect(result.reviewState).toBeNull();
    expect(result.paymentExpiresAt).toBeNull();
  });

  it("ghi audit CREATE cho đơn mới", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcRow, error: null });

    await callCreate();

    expect(auditLogRepository.record).toHaveBeenCalledTimes(1);
  });

  it("REPLAY: không ghi audit lần hai", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...rpcRow, replayed: true },
      error: null,
    });

    const result = await callCreate();

    expect(result.replayed).toBe(true);
    expect(auditLogRepository.record).not.toHaveBeenCalled();
  });

  // Bảng map SQLSTATE -> HTTP (features/checkout/constants.ts).
  it.each([
    ["NTCAP", 409, "UNPAID_ORDER_LIMIT"],
    ["NTIDM", 409, "IDEMPOTENCY_CONFLICT"],
    ["NTVER", 409, "PRICE_CHANGED"],
    ["NTQTA", 409, "CHECKOUT_QUOTA_EXCEEDED"],
    ["NTSTA", 409, "ORDER_STATE_CONFLICT"],
    ["NTCPN", 400, "BAD_REQUEST"],
    ["NTSTK", 400, "BAD_REQUEST"],
  ] as const)("SQLSTATE %s -> %i %s", async (code, statusCode, errorCode) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "Thông báo tiếng Việt cho khách" },
    });

    await expect(callCreate()).rejects.toMatchObject({
      statusCode,
      code: errorCode,
      message: "Thông báo tiếng Việt cho khách",
    });
  });

  it("unique violation trên checkout_requests -> 409 IDEMPOTENCY_CONFLICT", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "idx_checkout_requests_user_key" on checkout_requests',
      },
    });

    await expect(callCreate()).rejects.toMatchObject({
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("lỗi không map được -> bọc lỗi chung như cũ", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "connection reset" },
    });

    await expect(callCreate()).rejects.toThrow("Không tạo được đơn hàng");
  });

  // Fallback cửa sổ tương thích: migration RFC-2 chưa apply -> trigger coupon cũ
  // vẫn raise text tiếng Việt không kèm SQLSTATE riêng.
  it.each([
    "Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa",
    "Mã giảm giá đã hết hạn",
    "Mã giảm giá đã hết lượt sử dụng",
  ])(
    "text trigger legacy (%s) -> BadRequestError giữ nguyên text",
    async (message) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { message } });

      await expect(callCreate()).rejects.toMatchObject({
        statusCode: 400,
        message,
      });
    },
  );
});

describe("orderRepository.findReplay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trả null khi key chưa dùng", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    expect(await orderRepository.findReplay("user-1", "key-1")).toBeNull();
  });

  it("trả null (KHÔNG throw) khi bảng chưa tồn tại — migration chưa apply", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: null,
        error: { code: "42P01", message: "relation does not exist" },
      }),
    );

    expect(await orderRepository.findReplay("user-1", "key-1")).toBeNull();
  });

  it("map snapshot đơn cũ kèm hash để service so khớp", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: {
          request_hash: "hash-1",
          hash_version: 1,
          orders: {
            id: "order-1",
            order_code: "NT-1",
            status: "PENDING",
            payment_method: "BANK_TRANSFER",
            payment_status: "UNPAID",
            shipping_method: "STANDARD",
            total_price: "199000",
            shipping_fee: "25000",
            discount_amount: "0",
            final_price: "224000",
            shipping_address: { lines: [] },
            note: null,
            payment_review_state: "AWAITING_TRANSFER",
            payment_expires_at: null,
            state_version: 0,
            created_at: "2026-09-06T00:00:00.000Z",
          },
        },
        error: null,
      }),
    );

    const snapshot = await orderRepository.findReplay("user-1", "key-1");

    expect(snapshot).toMatchObject({
      orderId: "order-1",
      requestHash: "hash-1",
      hashVersion: 1,
      finalPrice: 224000,
      reviewState: "AWAITING_TRANSFER",
    });
  });

  it("throw khi lỗi DB khác", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { code: "08006", message: "db down" } }),
    );

    await expect(orderRepository.findReplay("user-1", "key-1")).rejects.toThrow(
      "db down",
    );
  });
});

describe("orderRepository.transition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gửi expectedVersion và map kết quả", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "order-1",
        changed: true,
        status: "CANCELLED",
        payment_status: "UNPAID",
        payment_review_state: "RELEASED",
        state_version: 3,
      },
      error: null,
    });

    const result = await orderRepository.transition({
      orderId: "order-1",
      action: "resolve_no_transfer",
      actorId: "staff-1",
      actorType: "STAFF",
      expectedVersion: 2,
      reason: "Không thấy giao dịch trong sao kê",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("checkout_transition_order_state", {
      p_payload: expect.objectContaining({
        order_id: "order-1",
        action: "resolve_no_transfer",
        expected_version: 2,
        actor_type: "STAFF",
      }),
    });
    expect(result).toMatchObject({
      changed: true,
      stateVersion: 3,
      reviewState: "RELEASED",
    });
  });

  it("NTSTA -> 409 ORDER_STATE_CONFLICT", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "NTSTA",
        message: "Đơn hàng đã thay đổi, vui lòng tải lại",
      },
    });

    await expect(
      orderRepository.transition({
        orderId: "order-1",
        action: "confirm_payment",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "ORDER_STATE_CONFLICT" });
  });
});

describe("orderRepository.getAvailableStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trả về stock từ dòng products", async () => {
    const builder = makeBuilder({ data: { stock: 42 }, error: null });
    mocks.from.mockReturnValue(builder);

    const result = await orderRepository.getAvailableStock();

    expect(builder.eq).toHaveBeenCalledWith("id", NUTEIN_PRODUCT_DB_ID);
    expect(result).toBe(42);
  });

  it("throw khi query lỗi", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );
    await expect(orderRepository.getAvailableStock()).rejects.toThrow(
      "db down",
    );
  });
});
