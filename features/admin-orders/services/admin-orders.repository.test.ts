// @vitest-environment node
// admin-orders.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

/** Query builder giả — mọi method chain trả về chính nó, awaitable qua `then`. */
function makeBuilder(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const resolved = {
    ...result,
    count:
      result.count ??
      (Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0)),
  };
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    is: vi.fn(() => builder),
    single: vi.fn(async () => resolved),
    maybeSingle: vi.fn(async () => resolved),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
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

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
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
        paymentMethod: "COD",
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

  it("có limit -> gọi .range(offset, offset+limit-1)", async () => {
    const builder = makeBuilder({ data: [], error: null, count: 0 });
    mocks.from.mockReturnValue(builder);

    await adminOrdersRepository.list({ limit: 20, offset: 40 });

    expect(builder.range).toHaveBeenCalledWith(40, 59);
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

  // Đơn PAYOS lịch sử (đặt trước khi bỏ payOS) — vẫn không được auto-PAID khi
  // giao hàng; chỉ COD mới có nhánh auto-PAID đó.
  it("đơn PAYOS lịch sử + delivered -> KHÔNG đụng payment_status", async () => {
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

const bankTransferRow = {
  ...orderRow,
  id: "order-bt",
  payment_method: "BANK_TRANSFER",
  payment_status: "UNPAID",
};

describe("adminOrdersRepository.confirmPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  /** Builder chain cho happy path: current -> update(select) -> audit -> logs. */
  function wireConfirmChain(
    currentData: unknown,
    updateData: unknown,
  ): { currentBuilder: Record<string, unknown>; updateBuilder: Record<string, unknown> } {
    const currentBuilder = makeBuilder({ data: currentData, error: null });
    const updateBuilder = makeBuilder({ data: updateData, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      return logsBuilder;
    });
    return { currentBuilder, updateBuilder };
  }

  it("đơn BANK_TRANSFER UNPAID -> set payment_status=PAID, KHÔNG đụng status", async () => {
    const { updateBuilder } = wireConfirmChain(
      { status: "PENDING", payment_method: "BANK_TRANSFER", payment_status: "UNPAID" },
      { ...bankTransferRow, payment_status: "PAID" },
    );

    const result = await adminOrdersRepository.confirmPayment("order-bt", "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({ payment_status: "PAID" });
    expect(result.paymentStatus).toBe("paid");
    // status giữ nguyên — 2 state machine tách biệt (SPEC AC4).
    expect(result.status).toBe("pending");
  });

  it("UPDATE có điều kiện payment_status='UNPAID' — chống double-confirm race", async () => {
    const { updateBuilder } = wireConfirmChain(
      { status: "PENDING", payment_method: "BANK_TRANSFER", payment_status: "UNPAID" },
      { ...bankTransferRow, payment_status: "PAID" },
    );

    await adminOrdersRepository.confirmPayment("order-bt", "staff-1");

    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "order-bt");
    expect(updateBuilder.eq).toHaveBeenCalledWith("payment_status", "UNPAID");
  });

  it("thua race (0 dòng khớp sau UPDATE) -> 400, không âm thầm coi là thành công", async () => {
    wireConfirmChain(
      { status: "PENDING", payment_method: "BANK_TRANSFER", payment_status: "UNPAID" },
      null,
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-bt", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("đơn COD -> 400, không gọi update", async () => {
    const { currentBuilder } = wireConfirmChain(
      { status: "PENDING", payment_method: "COD", payment_status: "UNPAID" },
      null,
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-1", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(currentBuilder.update).not.toHaveBeenCalled();
  });

  it("đơn đã PAID -> 400, không gọi update", async () => {
    const { currentBuilder } = wireConfirmChain(
      { status: "PENDING", payment_method: "BANK_TRANSFER", payment_status: "PAID" },
      null,
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-bt", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(currentBuilder.update).not.toHaveBeenCalled();
  });

  it("đơn không tồn tại -> 404", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      adminOrdersRepository.confirmPayment("missing", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("AC4 — chuyển trạng thái đơn BANK_TRANSFER không bao giờ tự set PAID", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["processing", "shipped"] as const)(
    "updateStatus -> %s không set payment_status",
    async (nextStatus) => {
      const currentBuilder = makeBuilder({
        data: {
          status: nextStatus === "processing" ? "PENDING" : "PROCESSING",
          payment_method: "BANK_TRANSFER",
          payment_status: "UNPAID",
        },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: bankTransferRow, error: null });
      const logsBuilder = makeBuilder({ data: [logRow], error: null });

      let ordersCall = 0;
      mocks.from.mockImplementation((table: string) => {
        if (table === "orders") {
          ordersCall += 1;
          return ordersCall === 1 ? currentBuilder : updateBuilder;
        }
        return logsBuilder;
      });

      await adminOrdersRepository.updateStatus("order-bt", nextStatus, "staff-1");

      const payload = (updateBuilder.update as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("payment_status");
    },
  );

  it("updateStatus -> delivered KHÔNG set PAID cho BANK_TRANSFER (chỉ COD mới auto-PAID)", async () => {
    const currentBuilder = makeBuilder({
      data: {
        status: "SHIPPED",
        payment_method: "BANK_TRANSFER",
        payment_status: "UNPAID",
      },
      error: null,
    });
    const updateBuilder = makeBuilder({ data: bankTransferRow, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : updateBuilder;
      }
      return logsBuilder;
    });

    await adminOrdersRepository.updateStatus("order-bt", "delivered", "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "DELIVERED",
      handled_by: "staff-1",
    });
  });
});

describe("AC5 — list()/getById() lộ paymentMethod + paymentStatus cho đơn BANK_TRANSFER", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() trả paymentMethod thô + paymentStatus", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: [bankTransferRow], error: null, count: 1 }),
    );

    const result = await adminOrdersRepository.list({});

    expect(result.items[0].paymentMethod).toBe("BANK_TRANSFER");
    expect(result.items[0].paymentStatus).toBe("unpaid");
    expect(result.items[0].paymentMethodLabel).toBe("Chuyển khoản ngân hàng");
  });

  it("getById() trả paymentMethod thô + paymentStatus", async () => {
    const orderBuilder = makeBuilder({ data: bankTransferRow, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? orderBuilder : logsBuilder,
    );

    const result = await adminOrdersRepository.getById("order-bt");

    expect(result?.paymentMethod).toBe("BANK_TRANSFER");
    expect(result?.paymentStatus).toBe("unpaid");
  });
});
