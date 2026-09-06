// @vitest-environment node
// admin-orders.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  transition: vi.fn(),
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
      (Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0),
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
    not: vi.fn(() => builder),
    single: vi.fn(async () => resolved),
    maybeSingle: vi.fn(async () => resolved),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolved).then(resolve),
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

// order.repository thật vẫn được nạp (để lấy lớp lỗi CheckoutRpcUnavailableError
// nguyên bản), chỉ `transition` bị thay — không stub cả module để tránh test
// xanh với một lớp lỗi giả không bao giờ khớp `instanceof` ở code thật.
vi.mock(
  "@/features/checkout/services/order.repository",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/checkout/services/order.repository")
      >();
    return {
      ...actual,
      orderRepository: {
        ...actual.orderRepository,
        transition: mocks.transition,
      },
    };
  },
);

import { ConflictError } from "@/src/errors/app.error";
import { CheckoutRpcUnavailableError } from "@/features/checkout/services/order.repository";
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
  order_items: [
    {
      product_name: "Nutein",
      variant_info: "1 hộp",
      price: 199000,
      quantity: 1,
    },
  ],
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
      data: [
        {
          status: "PENDING",
          final_price: 224000,
          created_at: "2026-07-24T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(builder);

    const result = await adminOrdersRepository.listSummary();

    expect(builder.select).toHaveBeenCalledWith(
      "status, final_price, created_at",
    );
    expect(result).toEqual([
      {
        status: "pending",
        total: 224000,
        createdAt: "2026-07-24T00:00:00.000Z",
      },
    ]);
  });

  it("lỗi query -> throw", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );

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
      data: {
        status: "DELIVERED",
        payment_method: "COD",
        payment_status: "UNPAID",
      },
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
      data: {
        status: "PENDING",
        payment_method: "COD",
        payment_status: "UNPAID",
      },
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

    const result = await adminOrdersRepository.updateStatus(
      "order-1",
      "processing",
      "staff-1",
    );

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "PROCESSING",
      handled_by: "staff-1",
    });
    expect(mocks.from).toHaveBeenCalledTimes(4); // current + update(+select) + audit_log insert + logs
    expect(result.status).toBe("processing");
  });

  it("happy path có note: patch note vào log vừa chèn", async () => {
    const currentBuilder = makeBuilder({
      data: {
        status: "PENDING",
        payment_method: "COD",
        payment_status: "UNPAID",
      },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { ...orderRow, status: "PROCESSING" },
      error: null,
    });
    const latestLogBuilder = makeBuilder({
      data: { id: "log-new" },
      error: null,
    });
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

    await adminOrdersRepository.updateStatus(
      "order-1",
      "processing",
      "staff-1",
      "đã gọi khách",
    );

    expect(patchNoteBuilder.update).toHaveBeenCalledWith({
      note: "đã gọi khách",
    });
    expect(patchNoteBuilder.eq).toHaveBeenCalledWith("id", "log-new");
  });

  it("COD + chuyển sang delivered -> tự set payment_status PAID (không có webhook nào làm việc này cho COD)", async () => {
    const currentBuilder = makeBuilder({
      data: {
        status: "SHIPPED",
        payment_method: "COD",
        payment_status: "UNPAID",
      },
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

    const result = await adminOrdersRepository.updateStatus(
      "order-1",
      "delivered",
      "staff-1",
    );

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "DELIVERED",
      handled_by: "staff-1",
      payment_status: "PAID",
    });
    expect(result.paymentStatus).toBe("paid");
  });

  it("COD đã PAID sẵn + delivered -> không set lại payment_status (idempotent)", async () => {
    const currentBuilder = makeBuilder({
      data: {
        status: "SHIPPED",
        payment_method: "COD",
        payment_status: "PAID",
      },
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
      data: {
        status: "SHIPPED",
        payment_method: "PAYOS",
        payment_status: "UNPAID",
      },
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transition.mockResolvedValue({
      orderId: "order-bt",
      changed: true,
      status: "PENDING",
      paymentStatus: "PAID",
      reviewState: "SETTLED",
      stateVersion: 4,
    });
  });

  /**
   * Chain mới: đọc `current` -> transition (RPC) -> đọc lại đơn -> logs.
   * `secondData` là dòng đọc lại sau khi RPC đã đổi trạng thái.
   */
  function wireConfirmChain(
    currentData: unknown,
    secondData: unknown,
  ): {
    currentBuilder: Record<string, unknown>;
    secondBuilder: Record<string, unknown>;
  } {
    const currentBuilder = makeBuilder({ data: currentData, error: null });
    const secondBuilder = makeBuilder({ data: secondData, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1;
        return ordersCall === 1 ? currentBuilder : secondBuilder;
      }
      return logsBuilder;
    });
    return { currentBuilder, secondBuilder };
  }

  it("đơn BANK_TRANSFER UNPAID -> đi qua RPC transition, KHÔNG đụng status", async () => {
    wireConfirmChain(
      {
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        payment_status: "UNPAID",
        state_version: 3,
      },
      { ...bankTransferRow, payment_status: "PAID" },
    );

    const result = await adminOrdersRepository.confirmPayment(
      "order-bt",
      "staff-1",
    );

    expect(mocks.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-bt",
        action: "confirm_payment",
        actorType: "STAFF",
        actorId: "staff-1",
        // Optimistic concurrency thay cho `.eq("payment_status","UNPAID")` cũ.
        expectedVersion: 3,
      }),
    );
    expect(result.paymentStatus).toBe("paid");
    // status giữ nguyên — 2 state machine tách biệt (SPEC AC4).
    expect(result.status).toBe("pending");
  });

  it("đơn COD -> 400, không gọi RPC", async () => {
    wireConfirmChain(
      {
        status: "PENDING",
        payment_method: "COD",
        payment_status: "UNPAID",
        state_version: 1,
      },
      null,
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-1", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("đơn đã PAID -> 400, không gọi RPC", async () => {
    wireConfirmChain(
      {
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        payment_status: "PAID",
        state_version: 1,
      },
      null,
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-bt", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("đơn không tồn tại -> 404", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      adminOrdersRepository.confirmPayment("missing", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("RPC từ chối (version lệch) -> lỗi được ném lên, không âm thầm thành công", async () => {
    wireConfirmChain(
      {
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        payment_status: "UNPAID",
        state_version: 3,
      },
      null,
    );
    mocks.transition.mockRejectedValue(
      new ConflictError(
        "Đơn hàng đã thay đổi, vui lòng tải lại",
        "ORDER_STATE_CONFLICT",
      ),
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-bt", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 409, code: "ORDER_STATE_CONFLICT" });
  });
});

/**
 * AC09 — LỖI THẬT được RFC-3 sửa.
 *
 * Trước RFC-3, `confirmPayment()` chỉ kiểm `payment_method` và
 * `payment_status`. Một đơn ĐÃ HỦY vẫn giữ `payment_status = 'UNPAID'` (đó là
 * trạng thái đúng của mọi đơn chuyển khoản bị hủy), nên nó lọt qua toàn bộ
 * guard và bị đánh dấu PAID — hàng đã hoàn kho rồi lại được ghi nhận đã thu tiền.
 */
describe("AC09 — confirmPayment trên đơn CANCELLED", () => {
  const cancelledOrder = {
    status: "CANCELLED",
    payment_method: "BANK_TRANSFER",
    payment_status: "UNPAID",
    state_version: 5,
  };

  beforeEach(() => vi.clearAllMocks());

  it("[red-before] guard CŨ (chỉ method + payment_status) CHẤP NHẬN đơn CANCELLED", () => {
    // Tái hiện nguyên văn điều kiện của phiên bản trước RFC-3.
    function oldGuardWouldConfirm(order: typeof cancelledOrder): boolean {
      if (order.payment_method !== "BANK_TRANSFER") return false;
      if (order.payment_status === "PAID") return false;
      return true; // -> chạy UPDATE payment_status = 'PAID'
    }

    // Đây chính là lỗ hổng: nếu khẳng định này SAI thì test xanh bên dưới là rỗng.
    expect(oldGuardWouldConfirm(cancelledOrder)).toBe(true);
  });

  it("guard MỚI từ chối đơn CANCELLED -> 409 ORDER_STATE_CONFLICT, KHÔNG gọi RPC", async () => {
    const currentBuilder = makeBuilder({ data: cancelledOrder, error: null });
    mocks.from.mockReturnValue(currentBuilder);

    await expect(
      adminOrdersRepository.confirmPayment("order-cancelled", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 409, code: "ORDER_STATE_CONFLICT" });

    expect(mocks.transition).not.toHaveBeenCalled();
    expect(currentBuilder.update).not.toHaveBeenCalled();
  });

  it("đơn RETURNED cũng bị từ chối", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: { ...cancelledOrder, status: "RETURNED" },
        error: null,
      }),
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-returned", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("đường tương thích (RPC chưa tồn tại) VẪN có guard status ở mức atomic", async () => {
    const currentBuilder = makeBuilder({
      data: {
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        payment_status: "UNPAID",
        state_version: 1,
      },
      error: null,
    });
    const updateBuilder = makeBuilder({
      data: { id: "order-bt" },
      error: null,
    });
    const readBuilder = makeBuilder({ data: bankTransferRow, error: null });
    const logsBuilder = makeBuilder({ data: [logRow], error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table !== "orders") return logsBuilder;
      ordersCall += 1;
      if (ordersCall === 1) return currentBuilder;
      if (ordersCall === 2) return updateBuilder;
      return readBuilder;
    });
    mocks.transition.mockRejectedValue(
      new CheckoutRpcUnavailableError("checkout_transition_order_state"),
    );

    await adminOrdersRepository.confirmPayment("order-bt", "staff-1");

    // Đơn có thể bị hủy NGAY GIỮA lúc đọc và lúc ghi -> guard phải nằm trong
    // chính câu UPDATE, không chỉ ở pre-check.
    expect(updateBuilder.eq).toHaveBeenCalledWith("payment_status", "UNPAID");
    expect(updateBuilder.not).toHaveBeenCalledWith(
      "status",
      "in",
      "(CANCELLED,RETURNED)",
    );
  });

  it("đường tương thích: 0 dòng khớp -> 409, không âm thầm coi là thành công", async () => {
    const currentBuilder = makeBuilder({
      data: {
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        payment_status: "UNPAID",
        state_version: 1,
      },
      error: null,
    });
    const updateBuilder = makeBuilder({ data: null, error: null });

    let ordersCall = 0;
    mocks.from.mockImplementation(() => {
      ordersCall += 1;
      return ordersCall === 1 ? currentBuilder : updateBuilder;
    });
    mocks.transition.mockRejectedValue(
      new CheckoutRpcUnavailableError("checkout_transition_order_state"),
    );

    await expect(
      adminOrdersRepository.confirmPayment("order-bt", "staff-1"),
    ).rejects.toMatchObject({ statusCode: 409, code: "ORDER_STATE_CONFLICT" });
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

      await adminOrdersRepository.updateStatus(
        "order-bt",
        nextStatus,
        "staff-1",
      );

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

    await adminOrdersRepository.updateStatus(
      "order-bt",
      "delivered",
      "staff-1",
    );

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

  /**
   * RFC-4 — hàng đợi đối soát đọc thêm 4 cột RFC-2. Migration CHƯA được apply
   * trên database đang chạy, nên đường lui phải được chứng minh, không chỉ
   * được viết ra.
   */
  describe("RFC-4 — cột đối soát và đường lui trước cutover", () => {
    it("getById(): DB đã có cột -> DTO mang state_version/review state", async () => {
      const orderBuilder = makeBuilder({
        data: {
          ...bankTransferRow,
          payment_review_state: "PAYMENT_CLAIMED",
          payment_expires_at: "2026-09-06T10:30:00.000Z",
          review_due_at: "2026-09-06T14:00:00.000Z",
          state_version: 7,
        },
        error: null,
      });
      const logsBuilder = makeBuilder({ data: [logRow], error: null });
      mocks.from.mockImplementation((table: string) =>
        table === "orders" ? orderBuilder : logsBuilder,
      );

      const result = await adminOrdersRepository.getById("order-bt");

      expect(result?.stateVersion).toBe(7);
      expect(result?.paymentReviewState).toBe("PAYMENT_CLAIMED");
      expect(result?.reviewDueAt).toBe("2026-09-06T14:00:00.000Z");
    });

    it("getById(): DB CHƯA có cột (42703) -> đọc lại bằng select cũ, không ném lỗi", async () => {
      const missingColumn = makeBuilder({
        data: null,
        error: {
          code: "42703",
          message: 'column "state_version" does not exist',
        },
      });
      const fallback = makeBuilder({ data: bankTransferRow, error: null });
      const logsBuilder = makeBuilder({ data: [logRow], error: null });

      let ordersCall = 0;
      mocks.from.mockImplementation((table: string) => {
        if (table === "orders") {
          ordersCall += 1;
          return ordersCall === 1 ? missingColumn : fallback;
        }
        return logsBuilder;
      });

      const result = await adminOrdersRepository.getById("order-bt");

      expect(ordersCall).toBe(2);
      expect(result?.orderCode).toBe(bankTransferRow.order_code);
      // Không bịa ra version -> UI biết chức năng đối soát chưa khả dụng.
      expect(result?.stateVersion).toBeUndefined();
    });

    it("list(): 42703 -> fallback về ORDER_SELECT cũ, back-office không chết", async () => {
      const missingColumn = makeBuilder({
        data: null,
        error: {
          code: "42703",
          message: 'column "review_due_at" does not exist',
        },
      });
      const fallback = makeBuilder({
        data: [bankTransferRow],
        error: null,
        count: 1,
      });

      let ordersCall = 0;
      mocks.from.mockImplementation(() => {
        ordersCall += 1;
        return ordersCall === 1 ? missingColumn : fallback;
      });

      const result = await adminOrdersRepository.list({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].stateVersion).toBeUndefined();
    });

    it("list(): lỗi DB KHÁC 42703 vẫn ném lỗi (không nuốt lỗi thật)", async () => {
      mocks.from.mockReturnValue(
        makeBuilder({
          data: null,
          error: { code: "08006", message: "db down" },
        }),
      );
      await expect(adminOrdersRepository.list({})).rejects.toThrow(/db down/);
    });

    it("confirmPayment(): expectedVersion lệch -> 409 ORDER_STATE_CONFLICT, KHÔNG ghi đè", async () => {
      const currentBuilder = makeBuilder({
        data: {
          status: "PENDING",
          payment_method: "BANK_TRANSFER",
          payment_status: "UNPAID",
          state_version: 9,
        },
        error: null,
      });
      mocks.from.mockReturnValue(currentBuilder);

      // Nhân viên đang nhìn version 3, DB đã ở version 9.
      await expect(
        adminOrdersRepository.confirmPayment("order-bt", "staff-1", 3),
      ).rejects.toMatchObject({ code: "ORDER_STATE_CONFLICT" });

      // Bất biến quan trọng: KHÔNG có transition nào chạy.
      expect(mocks.transition).not.toHaveBeenCalled();
    });
  });
});
