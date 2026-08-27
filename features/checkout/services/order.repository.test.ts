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

// next/server thật: after() throw nếu gọi ngoài request scope (Next quản lý
// qua AsyncLocalStorage) — không có request nào trong test. Chạy callback
// ngay (không ai trong file này assert riêng nội dung audit log).
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
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
  payment_method: "BANK_TRANSFER",
  payment_status: "UNPAID",
  shipping_method: "STANDARD",
  total_price: 199000,
  shipping_fee: 25000,
  discount_amount: 0,
  final_price: 224000,
  shipping_address: {},
  note: null,
  created_at: "2026-07-22T00:00:00.000Z",
};

describe("orderRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map bank_transfer sang DB enum BANK_TRANSFER, không ghi cột payos_* nào", async () => {
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
      },
    );

    expect(orderBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "BANK_TRANSFER" }),
    );
    const insertPayload = (orderBuilder.insert as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(insertPayload).not.toHaveProperty("payos_order_code");
    expect(insertPayload).not.toHaveProperty("payos_payment_link_id");
  });

  it("cod map sang COD, cũng không ghi cột payos_* nào", async () => {
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
      expect.objectContaining({ payment_method: "COD" }),
    );
    const insertPayload = (orderBuilder.insert as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(insertPayload).not.toHaveProperty("payos_order_code");
    expect(insertPayload).not.toHaveProperty("payos_payment_link_id");
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

  it("không có coupon → coupon_id null, snapshot không kèm field coupon", async () => {
    const orderBuilder = makeBuilder({ data: orderRow, error: null });
    const itemsBuilder = makeBuilder({ data: null, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : itemsBuilder,
    );

    await orderRepository.create(
      "user-1",
      baseInput,
      { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
      { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
    );

    const payload = (orderBuilder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.coupon_id).toBeNull();
    expect(payload.shipping_address).not.toHaveProperty("couponCode");
    expect(payload.shipping_address).not.toHaveProperty("couponDiscountAmount");
  });

  it("có coupon → set coupon_id và lưu snapshot couponCode/couponDiscountAmount vào shipping_address", async () => {
    const orderBuilder = makeBuilder({ data: orderRow, error: null });
    const itemsBuilder = makeBuilder({ data: null, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : itemsBuilder,
    );

    await orderRepository.create(
      "user-1",
      baseInput,
      { unitPrice: 199000, subtotal: 199000, discountAmount: 30000, shippingFee: 25000, total: 194000 },
      { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
      { couponId: "coupon-1", couponCode: "SALE10", couponDiscountAmount: 20000 },
    );

    const payload = (orderBuilder.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.coupon_id).toBe("coupon-1");
    expect(payload.discount_amount).toBe(30000);
    expect(payload.shipping_address).toMatchObject({
      couponCode: "SALE10",
      couponDiscountAmount: 20000,
    });
  });

  // AC10 — thua race lượt cuối: trigger BEFORE INSERT raise đúng text tiếng Việt.
  it.each([
    "Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa",
    "Mã giảm giá đã hết hạn",
    "Mã giảm giá đã hết lượt sử dụng",
  ])("trigger coupon từ chối (%s) → BadRequestError giữ nguyên text của trigger", async (message) => {
    const orderBuilder = makeBuilder({
      data: null,
      error: { message: `${message}` },
    });
    mocks.from.mockReturnValue(orderBuilder);

    await expect(
      orderRepository.create(
        "user-1",
        baseInput,
        { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
        { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
        { couponId: "coupon-1", couponCode: "SALE10", couponDiscountAmount: 20000 },
      ),
    ).rejects.toMatchObject({ statusCode: 400, message });
  });

  it("lỗi insert order KHÔNG phải trigger coupon → vẫn bọc lỗi chung như cũ", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "connection reset" } }),
    );

    await expect(
      orderRepository.create(
        "user-1",
        baseInput,
        { unitPrice: 199000, subtotal: 199000, discountAmount: 0, shippingFee: 25000, total: 224000 },
        { orderCode: "NT-20260722-AB12", status: "PENDING", paymentStatus: "UNPAID" },
      ),
    ).rejects.toThrow("Không tạo được đơn hàng");
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
