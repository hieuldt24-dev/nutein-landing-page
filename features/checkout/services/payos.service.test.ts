// @vitest-environment node
// payos.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  verify: vi.fn(),
  markPaidByPayosOrderCode: vi.fn(),
}));

vi.mock("@/lib/payos", () => ({
  payos: {
    paymentRequests: {
      create: mocks.create,
      get: mocks.get,
      cancel: mocks.cancel,
    },
    webhooks: { verify: mocks.verify },
  },
  appBaseUrl: "http://localhost:3000",
}));

vi.mock("./order.repository", () => ({
  orderRepository: { markPaidByPayosOrderCode: mocks.markPaidByPayosOrderCode },
}));

import { payosService } from "./payos.service";

beforeEach(() => vi.clearAllMocks());

describe("payosService.createPaymentLink", () => {
  it("gọi payos.paymentRequests.create với orderCode số, trả checkoutUrl", async () => {
    mocks.create.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/abc",
      orderCode: 1234567890,
      paymentLinkId: "link-1",
    });

    const result = await payosService.createPaymentLink({
      orderCode: "NT-20260722-AB12",
      amount: 199000,
      buyer: { fullName: "Nguyễn Văn A", email: "a@example.com", phone: "0912345678" },
    });

    expect(result).toEqual({
      checkoutUrl: "https://pay.payos.vn/web/abc",
      payosOrderCode: 1234567890,
      payosPaymentLinkId: "link-1",
    });

    const callArg = mocks.create.mock.calls[0][0];
    expect(typeof callArg.orderCode).toBe("number");
    expect(callArg.description).toBe("NT-20260722-AB12");
    expect(callArg.amount).toBe(199000);
  });

  it("throw BadRequestError khi payOS lỗi", async () => {
    mocks.create.mockRejectedValue(new Error("payOS down"));

    await expect(
      payosService.createPaymentLink({
        orderCode: "NT-20260722-AB12",
        amount: 199000,
        buyer: { fullName: "A", email: "a@example.com", phone: "0912345678" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("payosService.cancelPaymentLink", () => {
  it("không throw khi payOS lỗi (best-effort)", async () => {
    mocks.cancel.mockRejectedValue(new Error("payOS down"));
    await expect(
      payosService.cancelPaymentLink(123, "order_creation_failed"),
    ).resolves.toBeUndefined();
  });
});

describe("payosService.handleWebhook", () => {
  it("mark PAID khi code = '00'", async () => {
    mocks.verify.mockResolvedValue({ orderCode: 123, code: "00" });
    mocks.markPaidByPayosOrderCode.mockResolvedValue({ orderId: "order-1" });

    await payosService.handleWebhook({ code: "00", data: {} });

    expect(mocks.markPaidByPayosOrderCode).toHaveBeenCalledWith(123);
  });

  it("bỏ qua, không mark PAID khi code khác '00'", async () => {
    mocks.verify.mockResolvedValue({ orderCode: 123, code: "01" });

    await payosService.handleWebhook({ code: "01", data: {} });

    expect(mocks.markPaidByPayosOrderCode).not.toHaveBeenCalled();
  });

  it("throw UnauthorizedError khi sai signature", async () => {
    mocks.verify.mockRejectedValue(new Error("invalid signature"));

    await expect(
      payosService.handleWebhook({ code: "00", data: {} }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("idempotent: không tìm thấy đơn hoặc đã PAID trước đó → không throw", async () => {
    mocks.verify.mockResolvedValue({ orderCode: 123, code: "00" });
    mocks.markPaidByPayosOrderCode.mockResolvedValue(null);

    await expect(payosService.handleWebhook({ code: "00", data: {} })).resolves.toBeUndefined();
  });
});

describe("payosService.reconcileByPayosOrderCode", () => {
  it("trả PAID + mark DB khi payOS báo đã PAID", async () => {
    mocks.get.mockResolvedValue({ status: "PAID" });
    mocks.markPaidByPayosOrderCode.mockResolvedValue({ orderId: "order-1" });

    const result = await payosService.reconcileByPayosOrderCode(123);

    expect(result).toEqual({ paymentStatus: "PAID" });
    expect(mocks.markPaidByPayosOrderCode).toHaveBeenCalledWith(123);
  });

  it("trả UNPAID khi payOS báo chưa PAID", async () => {
    mocks.get.mockResolvedValue({ status: "PENDING" });

    const result = await payosService.reconcileByPayosOrderCode(123);

    expect(result).toEqual({ paymentStatus: "UNPAID" });
    expect(mocks.markPaidByPayosOrderCode).not.toHaveBeenCalled();
  });
});

// F6 / AC13 — khi thiếu credential payOS, message gửi client phải generic;
// chi tiết chẩn đoán (tên biến môi trường, file cấu hình) chỉ nằm trong `details`.
describe("requirePayosClient — F6 error leakage (AC13)", () => {
  const FORBIDDEN_IN_CLIENT_MESSAGE = [
    "PAYOS_CLIENT_ID",
    "PAYOS_API_KEY",
    "PAYOS_CHECKSUM_KEY",
    ".e" + "nv",
  ];

  afterEach(() => {
    vi.doUnmock("@/lib/payos");
    vi.resetModules();
  });

  it("không đưa tên biến môi trường PAYOS_* hay tên file cấu hình vào message gửi client", async () => {
    vi.resetModules();
    vi.doMock("@/lib/payos", () => ({ payos: null, appBaseUrl: "http://localhost:3000" }));
    vi.doMock("./order.repository", () => ({
      orderRepository: { markPaidByPayosOrderCode: vi.fn() },
    }));

    const { payosService: svc } = await import("./payos.service");

    let caught: unknown;
    try {
      await svc.createPaymentLink({
        orderCode: "NT-20260722-AB12",
        amount: 199000,
        buyer: { fullName: "Nguyễn Văn A", email: "a@example.com", phone: "0912345678" },
      });
    } catch (err) {
      caught = err;
    }

    const error = caught as { message: string; statusCode: number; details?: unknown };
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(500);

    for (const secret of FORBIDDEN_IN_CLIENT_MESSAGE) {
      expect(error.message).not.toContain(secret);
    }

    // Chi tiết chẩn đoán vẫn được giữ lại phía server qua `details`.
    expect(String(error.details)).toContain("PAYOS_CLIENT_ID");
  });
});
