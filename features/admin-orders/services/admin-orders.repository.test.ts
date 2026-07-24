// @vitest-environment node
// admin-orders.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

/** Query builder giả — mọi method chain trả về chính nó, awaitable qua `then`. */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    is: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { adminOrdersRepository } from "./admin-orders.repository";

const orderRow = {
  id: "order-1",
  order_code: "NT-20260722-AB12",
  status: "PENDING",
  payment_method: "COD",
  payment_status: "UNPAID",
  shipping_address: {
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    email: "a@example.com",
    street: "123 Đường ABC",
    ward: "Phúc Xá",
    province: "Hà Nội",
  },
  note: null,
  shipping_fee: 25000,
  discount_amount: 0,
  total_price: 199000,
  final_price: 224000,
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
  order_items: [{ product_name: "Nutein", variant_info: "1 hộp", price: 199000, quantity: 1 }],
};

const logRow = {
  id: "log-1",
  status: "PENDING",
  note: null,
  created_at: "2026-07-22T00:00:00.000Z",
  changed_by: { name: "Lê Đăng Trung Hiếu", email: "staff@example.com" },
};

describe("adminOrdersRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map đúng field, statusHistory rỗng ở list", async () => {
    const builder = makeBuilder({ data: [orderRow], error: null });
    mocks.from.mockReturnValue(builder);

    const result = await adminOrdersRepository.list();

    expect(result).toEqual([
      {
        id: "order-1",
        orderCode: "NT-20260722-AB12",
        status: "pending",
        createdAt: "2026-07-22T00:00:00.000Z",
        updatedAt: "2026-07-22T00:00:00.000Z",
        customerName: "Nguyễn Văn A",
        customerEmail: "a@example.com",
        customerPhone: "0912345678",
        shippingAddressLabel: "123 Đường ABC, Phúc Xá, Hà Nội",
        note: undefined,
        paymentMethodLabel: "COD — Thanh toán khi nhận hàng",
        paymentStatus: "unpaid",
        shippingFee: 25000,
        discountAmount: 0,
        subtotal: 199000,
        total: 224000,
        lines: [
          {
            productName: "Nutein",
            variantLabel: "1 hộp",
            quantity: 1,
            unitPrice: 199000,
            lineTotal: 199000,
          },
        ],
        statusHistory: [],
      },
    ]);
  });

  it("lọc theo status khác 'all' -> gọi .eq('status', DB enum)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminOrdersRepository.list({ status: "processing" });

    expect(builder.eq).toHaveBeenCalledWith("status", "PROCESSING");
  });

  it("status = 'all' -> không gọi .eq('status', ...)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminOrdersRepository.list({ status: "all" });

    expect(builder.eq).not.toHaveBeenCalled();
  });
});

describe("adminOrdersRepository.listSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map status/total/createdAt, không select shipping_address hay order_items (không PII)", async () => {
    const builder = makeBuilder({
      data: [{ status: "PENDING", final_price: 224000, created_at: "2026-07-24T00:00:00.000Z" }],
      error: null,
    });
    mocks.from.mockReturnValue(builder);

    const result = await adminOrdersRepository.listSummary();

    expect(builder.select).toHaveBeenCalledWith("status, final_price, created_at");
    expect(result).toEqual([
      { status: "pending", total: 224000, createdAt: "2026-07-24T00:00:00.000Z" },
    ]);
  });

  it("lỗi query -> throw", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: { message: "db down" } }));

    await expect(adminOrdersRepository.listSummary()).rejects.toThrow(
      "Không tải được tổng hợp đơn",
    );
  });
});

describe("adminOrdersRepository.getById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trả null khi không tìm thấy — không query order_status_logs", async () => {
    const orderBuilder = makeBuilder({ data: null, error: null });
    mocks.from.mockReturnValue(orderBuilder);

    const result = await adminOrdersRepository.getById("missing");

    expect(result).toBeNull();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("map đủ order + statusHistory (changedByLabel từ join users)", async () => {
    const orderBuilder = makeBuilder({ data: orderRow, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : logsBuilder,
    );

    const result = await adminOrdersRepository.getById("order-1");

    expect(result?.customerName).toBe("Nguyễn Văn A");
    expect(result?.statusHistory).toEqual([
      {
        id: "log-1",
        status: "pending",
        note: undefined,
        changedByLabel: "Lê Đăng Trung Hiếu",
        createdAt: "2026-07-22T00:00:00.000Z",
      },
    ]);
  });
});

describe("adminOrdersRepository.updateStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi không tìm thấy đơn — không update gì", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      adminOrdersRepository.updateStatus("missing", "processing", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throw BadRequestError khi chuyển trạng thái không hợp lệ — không gọi update", async () => {
    const currentBuilder = makeBuilder({
      data: { status: "DELIVERED", payment_method: "COD", payment_status: "UNPAID" },
      error: null,
    });
    mocks.from.mockReturnValue(currentBuilder);

    await expect(
      adminOrdersRepository.updateStatus("order-1", "pending", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(currentBuilder.update).not.toHaveBeenCalled();
  });

  it("happy path không note: update status+handled_by trong 1 round trip (select trả order mới), bỏ qua bước patch note", async () => {
    const currentBuilder = makeBuilder({
      data: { status: "PENDING", payment_method: "COD", payment_status: "UNPAID" },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { ...orderRow, status: "PROCESSING" },
      error: null,
    });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      return logsBuilder;
    });

    const result = await adminOrdersRepository.updateStatus("order-1", "processing", "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "PROCESSING",
      handled_by: "staff-1",
    });
    expect(mocks.from).toHaveBeenCalledTimes(4); // current + update(+select) + audit_log insert + logs
    expect(result.status).toBe("processing");
  });

  it("happy path có note: patch note vào log vừa chèn", async () => {
    const currentBuilder = makeBuilder({
      data: { status: "PENDING", payment_method: "COD", payment_status: "UNPAID" },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { ...orderRow, status: "PROCESSING" },
      error: null,
    });
    const latestLogBuilder = makeBuilder({ data: { id: "log-new" }, error: null });
    const patchNoteBuilder = makeBuilder({ data: null, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    let logsCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      logsCall += 1;
      if (logsCall === 1) return latestLogBuilder;
      if (logsCall === 2) return patchNoteBuilder;
      return logsBuilder;
    });

    await adminOrdersRepository.updateStatus("order-1", "processing", "staff-1", "đã gọi khách");

    expect(patchNoteBuilder.update).toHaveBeenCalledWith({ note: "đã gọi khách" });
    expect(patchNoteBuilder.eq).toHaveBeenCalledWith("id", "log-new");
  });

  it("COD + chuyển sang delivered -> tự set payment_status PAID (không có webhook nào làm việc này cho COD)", async () => {
    const currentBuilder = makeBuilder({
      data: { status: "SHIPPED", payment_method: "COD", payment_status: "UNPAID" },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { ...orderRow, status: "DELIVERED", payment_status: "PAID" },
      error: null,
    });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      return logsBuilder;
    });

    const result = await adminOrdersRepository.updateStatus("order-1", "delivered", "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "DELIVERED",
      handled_by: "staff-1",
      payment_status: "PAID",
    });
    expect(result.paymentStatus).toBe("paid");
  });

  it("COD đã PAID sẵn + delivered -> không set lại payment_status (idempotent)", async () => {
    const currentBuilder = makeBuilder({
      data: { status: "SHIPPED", payment_method: "COD", payment_status: "PAID" },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { ...orderRow, status: "DELIVERED", payment_status: "PAID" },
      error: null,
    });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      return logsBuilder;
    });

    await adminOrdersRepository.updateStatus("order-1", "delivered", "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "DELIVERED",
      handled_by: "staff-1",
    });
  });

  it("payOS/bank_transfer + delivered -> KHÔNG đụng payment_status (webhook/reconcile payOS lo việc này)", async () => {
    const currentBuilder = makeBuilder({
      data: { status: "SHIPPED", payment_method: "PAYOS", payment_status: "UNPAID" },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { ...orderRow, status: "DELIVERED", payment_method: "PAYOS" },
      error: null,
    });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      return logsBuilder;
    });

    await adminOrdersRepository.updateStatus("order-1", "delivered", "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "DELIVERED",
      handled_by: "staff-1",
    });
  });
});
