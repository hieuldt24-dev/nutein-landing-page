// @vitest-environment node
// checkout.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  findByOrderCodeForUser: vi.fn(),
  updatePayosLink: vi.fn(),
  createPaymentLink: vi.fn(),
  reconcileByPayosOrderCode: vi.fn(),
  cancelPaymentLink: vi.fn(),
}));

vi.mock("./order.repository", () => ({
  buildOrderCode: () => "NT-20260722-AB12",
  orderRepository: {
    create: mocks.createOrder,
    findByOrderCodeForUser: mocks.findByOrderCodeForUser,
    updatePayosLink: mocks.updatePayosLink,
  },
}));

vi.mock("./payos.service", () => ({
  payosService: {
    createPaymentLink: mocks.createPaymentLink,
    reconcileByPayosOrderCode: mocks.reconcileByPayosOrderCode,
    cancelPaymentLink: mocks.cancelPaymentLink,
  },
}));

import { checkoutService } from "./checkout.service";

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
  paymentMethod: "cod",
};

const orderRow = {
  id: "order-1",
  order_code: "NT-20260722-AB12",
  status: "PENDING",
  payment_method: "COD",
  payment_status: "UNPAID",
  shipping_method: "STANDARD",
  total_price: 199000,
  shipping_fee: 25000,
  discount_amount: 0,
  final_price: 224000,
  shipping_address: {},
  note: null,
  created_at: "2026-07-22T00:00:00.000Z",
  payos_order_code: null,
  payos_payment_link_id: null,
};

describe("checkoutService.createOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cod: không gọi payosService, tạo đơn bình thường", async () => {
    mocks.createOrder.mockResolvedValue(orderRow);

    const result = await checkoutService.createOrder("user-1", baseInput);

    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
    expect(mocks.createOrder).toHaveBeenCalled();
    expect(result.paymentUrl).toBeUndefined();
    expect(result.status).toBe("pending");
  });

  it("bank_transfer: gọi payosService.createPaymentLink TRƯỚC orderRepository.create, trả paymentUrl", async () => {
    const callOrder: string[] = [];
    mocks.createPaymentLink.mockImplementation(async () => {
      callOrder.push("payos");
      return {
        checkoutUrl: "https://pay.payos.vn/web/abc",
        payosOrderCode: 1753142400000,
        payosPaymentLinkId: "link-1",
      };
    });
    mocks.createOrder.mockImplementation(async () => {
      callOrder.push("db");
      return {
        ...orderRow,
        payment_method: "PAYOS",
        payos_order_code: 1753142400000,
        payos_payment_link_id: "link-1",
      };
    });

    const result = await checkoutService.createOrder("user-1", {
      ...baseInput,
      paymentMethod: "bank_transfer",
    });

    expect(callOrder).toEqual(["payos", "db"]);
    expect(result.paymentUrl).toBe("https://pay.payos.vn/web/abc");

    const createOrderMetaArg = mocks.createOrder.mock.calls[0][3];
    expect(createOrderMetaArg).toMatchObject({
      payosOrderCode: 1753142400000,
      payosPaymentLinkId: "link-1",
    });
  });

  it("bank_transfer: payOS lỗi → orderRepository.create KHÔNG được gọi (không tạo đơn orphan)", async () => {
    mocks.createPaymentLink.mockRejectedValue(new Error("payOS down"));

    await expect(
      checkoutService.createOrder("user-1", { ...baseInput, paymentMethod: "bank_transfer" }),
    ).rejects.toThrow();

    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});

describe("checkoutService.getPaymentStatusForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi không tìm thấy đơn", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue(null);
    await expect(
      checkoutService.getPaymentStatusForUser("user-1", "NT-x"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("trả trực tiếp payment_status khi đã PAID, không gọi reconcile", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "PAID",
      payment_method: "PAYOS",
      payos_order_code: 123,
    });

    const result = await checkoutService.getPaymentStatusForUser("user-1", "NT-x");

    expect(result).toEqual({ paymentStatus: "PAID" });
    expect(mocks.reconcileByPayosOrderCode).not.toHaveBeenCalled();
  });

  it("gọi reconcile khi PAYOS còn UNPAID", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "PAYOS",
      payos_order_code: 123,
    });
    mocks.reconcileByPayosOrderCode.mockResolvedValue({ paymentStatus: "PAID" });

    const result = await checkoutService.getPaymentStatusForUser("user-1", "NT-x");

    expect(mocks.reconcileByPayosOrderCode).toHaveBeenCalledWith(123);
    expect(result).toEqual({ paymentStatus: "PAID" });
  });

  it("cod UNPAID: không gọi reconcile (không phải PAYOS)", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "COD",
      payos_order_code: null,
    });

    const result = await checkoutService.getPaymentStatusForUser("user-1", "NT-x");

    expect(mocks.reconcileByPayosOrderCode).not.toHaveBeenCalled();
    expect(result).toEqual({ paymentStatus: "UNPAID" });
  });
});

const shippingAddress = {
  fullName: "Nguyễn Văn A",
  phone: "0912345678",
  email: "a@example.com",
};

describe("checkoutService.retryPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi không tìm thấy đơn", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue(null);
    await expect(
      checkoutService.retryPayment("user-1", "NT-x"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("đã PAID → already_paid ngay, không gọi payOS", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "PAID",
      payment_method: "PAYOS",
      payos_order_code: 123,
      payos_payment_link_id: "link-1",
      final_price: "224000",
      shipping_address: shippingAddress,
    });

    const result = await checkoutService.retryPayment("user-1", "NT-x");

    expect(result).toEqual({ status: "already_paid" });
    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
  });

  it("payment_method khác PAYOS → BadRequestError", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "COD",
      payos_order_code: null,
      payos_payment_link_id: null,
      final_price: "224000",
      shipping_address: shippingAddress,
    });

    await expect(
      checkoutService.retryPayment("user-1", "NT-x"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("reconcile phát hiện đã trả (webhook chưa kịp tới) → already_paid, không tạo link mới", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "PAYOS",
      payos_order_code: 111,
      payos_payment_link_id: "link-old",
      final_price: "224000",
      shipping_address: shippingAddress,
    });
    mocks.reconcileByPayosOrderCode.mockResolvedValue({ paymentStatus: "PAID" });

    const result = await checkoutService.retryPayment("user-1", "NT-x");

    expect(result).toEqual({ status: "already_paid" });
    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
    expect(mocks.cancelPaymentLink).not.toHaveBeenCalled();
  });

  it("happy path: huỷ link cũ, tạo link mới, updatePayosLink nhận đúng code cũ/mới", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "PAYOS",
      payos_order_code: 111,
      payos_payment_link_id: "link-old",
      final_price: "224000",
      shipping_address: shippingAddress,
    });
    mocks.reconcileByPayosOrderCode.mockResolvedValue({ paymentStatus: "UNPAID" });
    mocks.createPaymentLink.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/new",
      payosOrderCode: 222,
      payosPaymentLinkId: "link-new",
    });
    mocks.updatePayosLink.mockResolvedValue(true);

    const result = await checkoutService.retryPayment("user-1", "NT-x");

    expect(mocks.cancelPaymentLink).toHaveBeenCalledWith(111, "customer_retry");
    expect(mocks.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ orderCode: "NT-x", amount: 224000 }),
    );
    expect(mocks.updatePayosLink).toHaveBeenCalledWith("order-1", 111, 222, "link-new");
    expect(result).toEqual({ status: "created", paymentUrl: "https://pay.payos.vn/web/new" });
  });

  it("chưa có payos_order_code cũ (null) → không gọi reconcile/cancel", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "PAYOS",
      payos_order_code: null,
      payos_payment_link_id: null,
      final_price: 224000,
      shipping_address: shippingAddress,
    });
    mocks.createPaymentLink.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/new",
      payosOrderCode: 222,
      payosPaymentLinkId: "link-new",
    });
    mocks.updatePayosLink.mockResolvedValue(true);

    await checkoutService.retryPayment("user-1", "NT-x");

    expect(mocks.reconcileByPayosOrderCode).not.toHaveBeenCalled();
    expect(mocks.cancelPaymentLink).not.toHaveBeenCalled();
    expect(mocks.updatePayosLink).toHaveBeenCalledWith("order-1", null, 222, "link-new");
  });

  it("thua race (updatePayosLink trả false) → huỷ link vừa tạo + throw 409", async () => {
    mocks.findByOrderCodeForUser.mockResolvedValue({
      id: "order-1",
      payment_status: "UNPAID",
      payment_method: "PAYOS",
      payos_order_code: 111,
      payos_payment_link_id: "link-old",
      final_price: "224000",
      shipping_address: shippingAddress,
    });
    mocks.reconcileByPayosOrderCode.mockResolvedValue({ paymentStatus: "UNPAID" });
    mocks.createPaymentLink.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/new",
      payosOrderCode: 222,
      payosPaymentLinkId: "link-new",
    });
    mocks.updatePayosLink.mockResolvedValue(false);

    await expect(
      checkoutService.retryPayment("user-1", "NT-x"),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.cancelPaymentLink).toHaveBeenCalledWith(222, "retry_race_lost");
  });
});
