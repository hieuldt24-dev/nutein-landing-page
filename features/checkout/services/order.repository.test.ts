// @vitest-environment node
// order.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import { NUTEIN_PRODUCT_DB_ID } from "@/features/product/constants";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
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
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { orderRepository } from "./order.repository";

const baseInput: CreateOrderRequest = {
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
  paymentMethod: "bank_transfer",
};

const orderRow = {
  id: "order-1",
  order_code: "NT-20260722-AB12",
  status: "PENDING",
  payment_method: "PAYOS",
  payment_status: "UNPAID",
  shipping_method: "STANDARD",
  total_price: 199000,
  shipping_fee: 25000,
  discount_amount: 0,
  final_price: 224000,
  shipping_address: {},
  note: null,
  created_at: "2026-07-22T00:00:00.000Z",
  payos_order_code: 1753142400000,
  payos_payment_link_id: "link-1",
};

describe("orderRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map bank_transfer sang DB enum PAYOS và ghi payos_order_code/payment_link_id", async () => {
    const orderBuilder = makeBuilder({ data: orderRow, error: null });
    const itemsBuilder = makeBuilder({ data: null, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : itemsBuilder,
    );

    await orderRepository.create(
      "user-1",
      baseInput,
      { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
      {
        orderCode: "NT-20260722-AB12",
        status: "PENDING",
        paymentStatus: "UNPAID",
        payosOrderCode: 1753142400000,
        payosPaymentLinkId: "link-1",
      },
    );

    expect(orderBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method: "PAYOS",
        payos_order_code: 1753142400000,
        payos_payment_link_id: "link-1",
      }),
    );
  });

  it("cod không set payos_order_code (null)", async () => {
    const orderBuilder = makeBuilder({ data: { ...orderRow, payment_method: "COD" }, error: null });
    const itemsBuilder = makeBuilder({ data: null, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : itemsBuilder,
    );

    await orderRepository.create(
      "user-1",
      { ...baseInput, paymentMethod: "cod" },
      { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
      { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
    );

    expect(orderBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method: "COD",
        payos_order_code: null,
        payos_payment_link_id: null,
      }),
    );
  });

  it("rollback (xóa order) khi insert order_items lỗi", async () => {
    const orderBuilder = makeBuilder({ data: orderRow, error: null });
    const itemsBuilder = makeBuilder({ data: null, error: { message: "insert failed" } });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : itemsBuilder,
    );

    await expect(
      orderRepository.create(
        "user-1",
        baseInput,
        { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
        { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
      ),
    ).rejects.toThrow("Không lưu được dòng đơn");

    expect(orderBuilder.delete).toHaveBeenCalled();
  });

  it("thua race trừ kho (CHECK stock >= 0 — mã 23514) -> BadRequestError rõ ràng, vẫn rollback order", async () => {
    const orderBuilder = makeBuilder({ data: orderRow, error: null });
    const itemsBuilder = makeBuilder({
      data: null,
      error: {
        code: "23514",
        message:
          'new row for relation "products" violates check constraint "products_stock_check"',
      },
    });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : itemsBuilder,
    );

    await expect(
      orderRepository.create(
        "user-1",
        baseInput,
        { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
        { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(orderBuilder.delete).toHaveBeenCalled();
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
    await expect(orderRepository.getAvailableStock()).rejects.toThrow("db down");
  });
});

describe("orderRepository.findByOrderCodeForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trả null khi không tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    expect(
      await orderRepository.findByOrderCodeForUser("NT-x", "user-1"),
    ).toBeNull();
  });

  it("trả đúng field khi tìm thấy", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: { id: "order-1", payment_status: "UNPAID", payment_method: "PAYOS", payos_order_code: 123 },
        error: null,
      }),
    );
    const result = await orderRepository.findByOrderCodeForUser("NT-20260722-AB12", "user-1");
    expect(result).toEqual({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "PAYOS",
      payos_order_code: 123,
    });
  });
});

describe("orderRepository.markPaidByPayosOrderCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dùng .eq(payos_order_code).neq(payment_status) và trả orderId khi update thành công", async () => {
    const builder = makeBuilder({ data: { id: "order-1" }, error: null });
    mocks.from.mockReturnValue(builder);

    const result = await orderRepository.markPaidByPayosOrderCode(123);

    expect(builder.eq).toHaveBeenCalledWith("payos_order_code", 123);
    expect(builder.neq).toHaveBeenCalledWith("payment_status", "PAID");
    expect(result).toEqual({ orderId: "order-1" });
  });

  it("trả null (no-op) khi không match — idempotent với webhook gọi lại", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    expect(await orderRepository.markPaidByPayosOrderCode(123)).toBeNull();
  });
});

describe("orderRepository.updatePayosLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dùng .eq(payos_order_code, previous) khi previous khác null, trả true khi update thành công", async () => {
    const builder = makeBuilder({ data: [{ id: "order-1" }], error: null });
    mocks.from.mockReturnValue(builder);

    const result = await orderRepository.updatePayosLink("order-1", 111, 222, "link-new");

    expect(builder.update).toHaveBeenCalledWith({
      payos_order_code: 222,
      payos_payment_link_id: "link-new",
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "order-1");
    expect(builder.eq).toHaveBeenCalledWith("payos_order_code", 111);
    expect(builder.is).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("dùng .is(payos_order_code, null) khi previous = null", async () => {
    const builder = makeBuilder({ data: [{ id: "order-1" }], error: null });
    mocks.from.mockReturnValue(builder);

    await orderRepository.updatePayosLink("order-1", null, 222, "link-new");

    expect(builder.is).toHaveBeenCalledWith("payos_order_code", null);
  });

  it("trả false (thua race) khi 0 dòng khớp", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [], error: null }));
    const result = await orderRepository.updatePayosLink("order-1", 111, 222, "link-new");
    expect(result).toBe(false);
  });

  it("throw khi update lỗi", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );
    await expect(
      orderRepository.updatePayosLink("order-1", 111, 222, "link-new"),
    ).rejects.toThrow("db down");
  });
});
