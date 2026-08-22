// @vitest-environment node
// checkout.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  findByOrderCodeForUser: vi.fn(),
  updatePayosLink: vi.fn(),
  getAvailableStock: vi.fn(),
  createPaymentLink: vi.fn(),
  reconcileByPayosOrderCode: vi.fn(),
  cancelPaymentLink: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  validateAndComputeDiscount: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
  refreshProductCatalogServer: vi.fn(),
}));

/**
 * next/server thật: after() throw nếu gọi ngoài request scope (Next quản lý
 * qua AsyncLocalStorage) — trong test không có request nào cả. Mock thu
 * thập callback, test nào cần assert side-effect bên trong after() thì tự
 * `await flushAfterCallbacks()` trước khi kiểm tra.
 */
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    mocks.afterCallbacks.push(fn);
  },
}));

async function flushAfterCallbacks() {
  const callbacks = mocks.afterCallbacks.splice(0);
  await Promise.all(callbacks.map((fn) => fn()));
}

vi.mock("./order.repository", () => ({
  buildOrderCode: () => "NT-20260722-AB12",
  orderRepository: {
    create: mocks.createOrder,
    findByOrderCodeForUser: mocks.findByOrderCodeForUser,
    updatePayosLink: mocks.updatePayosLink,
    getAvailableStock: mocks.getAvailableStock,
  },
}));

vi.mock("./payos.service", () => ({
  payosService: {
    createPaymentLink: mocks.createPaymentLink,
    reconcileByPayosOrderCode: mocks.reconcileByPayosOrderCode,
    cancelPaymentLink: mocks.cancelPaymentLink,
  },
}));

vi.mock("./coupon-validation.service", () => ({
  couponValidationService: {
    validateAndComputeDiscount: mocks.validateAndComputeDiscount,
  },
}));

vi.mock("./order-email.service", () => ({
  orderEmailService: {
    sendOrderConfirmation: mocks.sendOrderConfirmation,
  },
}));

// refreshProductCatalogServer gọi Supabase thật (getSupabaseClient) — stub thành
// no-op trong test, giữ nguyên toàn bộ hàm sync còn lại (resolveVariant,
// getProductDetail...) để totalRequestedUnits/buildCartSummary vẫn chạy
// đúng trên data mock có sẵn.
vi.mock("@/features/product/services/product-catalog.server", () => ({
  refreshProductCatalogServer: mocks.refreshProductCatalogServer,
}));

vi.mock("@/features/product/services/product.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/product/services/product.service")
  >();
  return {
    productService: {
      ...actual.productService,
    },
  };
});

import { checkoutService } from "./checkout.service";
import { BadRequestError } from "@/src/errors/app.error";

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
  beforeEach(() => {
    vi.clearAllMocks();
    // Mặc định giả lập refresh "không có data kèm stock" (null) — buộc rơi
    // vào fallback getAvailableStock() như hành vi cũ, giữ nguyên các test
    // hiện có. Test riêng cho nhánh gộp-query tự override giá trị này.
    mocks.refreshProductCatalogServer.mockResolvedValue(null);
    mocks.getAvailableStock.mockResolvedValue(9999);
    mocks.sendOrderConfirmation.mockResolvedValue(undefined);
  });

  it("cod: không gọi payosService, tạo đơn bình thường, gửi email xác nhận", async () => {
    mocks.createOrder.mockResolvedValue(orderRow);

    const result = await checkoutService.createOrder("user-1", baseInput);
    await flushAfterCallbacks(); // sendOrderConfirmation giờ chạy trong after()

    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
    expect(mocks.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ orderCode: "NT-20260722-AB12" }),
    );
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

  // F1 / AC1 — link đã tạo xong rồi mới ghi DB thất bại → phải huỷ link.
  it("bank_transfer: create() lỗi SAU khi đã tạo link → cancelPaymentLink(code, \"order_create_failed\") + lỗi gốc vẫn nổi lên", async () => {
    mocks.createPaymentLink.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/abc",
      payosOrderCode: 1234567890,
      payosPaymentLinkId: "link-1",
    });
    const createError = new Error("DB insert failed");
    mocks.createOrder.mockRejectedValue(createError);
    mocks.cancelPaymentLink.mockResolvedValue(undefined);

    await expect(
      checkoutService.createOrder("user-1", { ...baseInput, paymentMethod: "bank_transfer" }),
    ).rejects.toBe(createError);

    expect(mocks.cancelPaymentLink).toHaveBeenCalledWith(1234567890, "order_create_failed");
  });

  // F1 / AC1 — huỷ link cũng lỗi thì KHÔNG được che lỗi gốc.
  it("bank_transfer: cancelPaymentLink cũng lỗi → lỗi gốc của create() mới là lỗi nổi lên", async () => {
    mocks.createPaymentLink.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/abc",
      payosOrderCode: 1234567890,
      payosPaymentLinkId: "link-1",
    });
    const createError = new Error("DB insert failed");
    mocks.createOrder.mockRejectedValue(createError);
    mocks.cancelPaymentLink.mockRejectedValueOnce(new Error("payOS cancel down"));

    await expect(
      checkoutService.createOrder("user-1", { ...baseInput, paymentMethod: "bank_transfer" }),
    ).rejects.toBe(createError);

    expect(mocks.cancelPaymentLink).toHaveBeenCalledTimes(1);
  });

  // F1 / AC2 — đường COD không có payosOrderCode → không được gọi cancel.
  it("cod: create() lỗi → KHÔNG gọi cancelPaymentLink (không có link nào để huỷ)", async () => {
    const createError = new Error("DB insert failed");
    mocks.createOrder.mockRejectedValue(createError);

    await expect(checkoutService.createOrder("user-1", baseInput)).rejects.toBe(createError);

    expect(mocks.cancelPaymentLink).not.toHaveBeenCalled();
    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
  });

  it("vượt tồn kho → BadRequestError, không gọi payOS lẫn orderRepository.create", async () => {
    mocks.getAvailableStock.mockResolvedValue(0); // 1 gói pack-1 = 1 hũ > 0 còn lại

    await expect(
      checkoutService.createOrder("user-1", { ...baseInput, paymentMethod: "bank_transfer" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("đủ tồn kho vừa khít (bằng số lượng đặt) → vẫn tạo đơn bình thường", async () => {
    mocks.getAvailableStock.mockResolvedValue(1); // baseInput đặt đúng 1 hũ (pack-1 × 1)
    mocks.createOrder.mockResolvedValue(orderRow);

    const result = await checkoutService.createOrder("user-1", baseInput);

    expect(result.status).toBe("pending");
  });

  it("refreshCatalogCache trả kèm stock → dùng luôn, KHÔNG gọi getAvailableStock riêng", async () => {
    mocks.refreshProductCatalogServer.mockResolvedValue({ stock: 9999 });
    mocks.createOrder.mockResolvedValue(orderRow);

    const result = await checkoutService.createOrder("user-1", baseInput);

    expect(mocks.getAvailableStock).not.toHaveBeenCalled();
    expect(result.status).toBe("pending");
  });

  // Item 1 — stock NaN (cột `stock` DB null/non-numeric → Number(null) = NaN)
  // KHÔNG được coi là hợp lệ: object truthy nhưng giá trị vô nghĩa, phải rơi
  // vào fallback getAvailableStock() y như trường hợp stockResult null.
  it("refreshCatalogCache trả stock NaN → fallback getAvailableStock(), vượt tồn kho vẫn bị chặn", async () => {
    mocks.refreshProductCatalogServer.mockResolvedValue({ stock: Number.NaN });
    mocks.getAvailableStock.mockResolvedValue(0);

    await expect(
      checkoutService.createOrder("user-1", { ...baseInput, paymentMethod: "bank_transfer" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.getAvailableStock).toHaveBeenCalled();
    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("refreshCatalogCache trả stock NaN + getAvailableStock lỗi DB → lỗi nổi lên (không âm thầm bỏ qua check)", async () => {
    mocks.refreshProductCatalogServer.mockResolvedValue({ stock: Number.NaN });
    const dbError = new Error("stock query failed");
    mocks.getAvailableStock.mockRejectedValue(dbError);

    await expect(checkoutService.createOrder("user-1", baseInput)).rejects.toBe(dbError);

    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("refreshCatalogCache trả stock không đủ → BadRequestError, không cần gọi getAvailableStock riêng", async () => {
    mocks.refreshProductCatalogServer.mockResolvedValue({ stock: 0 });

    await expect(
      checkoutService.createOrder("user-1", { ...baseInput, paymentMethod: "bank_transfer" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.getAvailableStock).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});

describe("checkoutService.createOrder — mã giảm giá", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshProductCatalogServer.mockResolvedValue(null);
    mocks.getAvailableStock.mockResolvedValue(9999);
    mocks.sendOrderConfirmation.mockResolvedValue(undefined);
    mocks.createOrder.mockResolvedValue(orderRow);
  });

  /** Nhiều gói để chắc chắn có giảm giá theo mốc voucher (discountAmount > 0). */
  const bundledInput: CreateOrderRequest = {
    ...baseInput,
    lines: [{ variantId: "pack-3", quantity: 2 }],
  };

  function moneyArg() {
    return mocks.createOrder.mock.calls[0][2] as {
      subtotal: number;
      discountAmount: number;
      shippingFee: number;
      total: number;
    };
  }

  it("không gửi couponCode → không gọi service coupon, coupon param undefined", async () => {
    await checkoutService.createOrder("user-1", baseInput);

    expect(mocks.validateAndComputeDiscount).not.toHaveBeenCalled();
    expect(mocks.createOrder.mock.calls[0][4]).toBeUndefined();
  });

  // AC2 / Mitigation 3 — luôn tra lại từ DB, không nhận số tiền giảm từ client.
  it("gửi couponCode → LUÔN tra lại từ DB với tạm tính TRƯỚC giảm giá voucher", async () => {
    mocks.validateAndComputeDiscount.mockResolvedValue({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 20_000,
    });

    await checkoutService.createOrder("user-1", {
      ...bundledInput,
      couponCode: "SALE10",
    });

    const call = mocks.validateAndComputeDiscount.mock.calls[0][0];
    expect(call.code).toBe("SALE10");
    // subtotal truyền vào phải khớp `subtotal` (tạm tính gốc), KHÔNG phải
    // `total` (đã trừ giảm giá theo mốc voucher).
    expect(call.subtotal).toBe(moneyArg().subtotal);
    expect(call.subtotal).toBeGreaterThan(moneyArg().subtotal - moneyArg().discountAmount);
  });

  // AC1 + AC8 — cộng dồn, không cái nào ghi đè cái nào.
  it("cộng dồn giảm giá voucher + coupon, tổng đơn giảm đúng phần coupon", async () => {
    const noCoupon = await checkoutService.createOrder("user-1", bundledInput);
    const baselineMoney = moneyArg();
    vi.clearAllMocks();
    mocks.refreshProductCatalogServer.mockResolvedValue(null);
    mocks.getAvailableStock.mockResolvedValue(9999);
    mocks.sendOrderConfirmation.mockResolvedValue(undefined);
    mocks.createOrder.mockResolvedValue(orderRow);
    mocks.validateAndComputeDiscount.mockResolvedValue({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 20_000,
    });

    const withCoupon = await checkoutService.createOrder("user-1", {
      ...bundledInput,
      couponCode: "SALE10",
    });
    const couponMoney = moneyArg();

    // discount_amount ghi DB = giảm voucher + giảm coupon (cộng dồn).
    expect(couponMoney.discountAmount).toBe(baselineMoney.discountAmount + 20_000);
    expect(baselineMoney.discountAmount).toBeGreaterThan(0);
    // Tổng phải trả giảm đúng 20.000 so với khi không có coupon.
    expect(couponMoney.total).toBe(baselineMoney.total - 20_000);
    // Tạm tính không đổi.
    expect(couponMoney.subtotal).toBe(baselineMoney.subtotal);
    // final_price khớp công thức CHECK: subtotal − discount + ship.
    expect(couponMoney.total).toBe(
      couponMoney.subtotal - couponMoney.discountAmount + couponMoney.shippingFee,
    );

    // summary tách 2 dòng: giảm theo voucher giữ nguyên, coupon là dòng riêng.
    expect(withCoupon.summary.discountAmount).toBe(noCoupon.summary.discountAmount);
    expect(withCoupon.summary.couponCode).toBe("SALE10");
    expect(withCoupon.summary.couponDiscountAmount).toBe(20_000);
    expect(noCoupon.summary.couponCode).toBeUndefined();
  });

  it("truyền couponId + snapshot xuống orderRepository.create", async () => {
    mocks.validateAndComputeDiscount.mockResolvedValue({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 20_000,
    });

    await checkoutService.createOrder("user-1", {
      ...bundledInput,
      couponCode: "SALE10",
    });

    expect(mocks.createOrder.mock.calls[0][4]).toEqual({
      couponId: "coupon-1",
      couponCode: "SALE10",
      couponDiscountAmount: 20_000,
    });
  });

  // AC2 / AC3 — coupon hợp lệ lúc preview nhưng đã hỏng lúc submit.
  it("coupon không còn hợp lệ lúc submit → throw, KHÔNG tạo đơn", async () => {
    mocks.validateAndComputeDiscount.mockRejectedValue(
      new BadRequestError("Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa"),
    );

    await expect(
      checkoutService.createOrder("user-1", { ...bundledInput, couponCode: "SALE10" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("mã không tồn tại → throw, KHÔNG tạo đơn và KHÔNG gọi payOS", async () => {
    mocks.validateAndComputeDiscount.mockRejectedValue(
      new BadRequestError("Mã giảm giá không tồn tại"),
    );

    await expect(
      checkoutService.createOrder("user-1", {
        ...bundledInput,
        paymentMethod: "bank_transfer",
        couponCode: "KHONGCO",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.createPaymentLink).not.toHaveBeenCalled();
  });

  // AC10 — thua race ở trigger: dùng LẠI đúng catch block huỷ link payOS sẵn có.
  it("trigger từ chối lúc insert (thua race) → huỷ link payOS qua đúng nhánh catch sẵn có", async () => {
    mocks.validateAndComputeDiscount.mockResolvedValue({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 20_000,
    });
    mocks.createPaymentLink.mockResolvedValue({
      checkoutUrl: "https://pay.payos.vn/web/abc",
      payosOrderCode: 1234567890,
      payosPaymentLinkId: "link-1",
    });
    const triggerError = new BadRequestError("Mã giảm giá đã hết lượt sử dụng");
    mocks.createOrder.mockRejectedValue(triggerError);
    mocks.cancelPaymentLink.mockResolvedValue(undefined);

    await expect(
      checkoutService.createOrder("user-1", {
        ...bundledInput,
        paymentMethod: "bank_transfer",
        couponCode: "SALE10",
      }),
    ).rejects.toBe(triggerError);

    expect(mocks.cancelPaymentLink).toHaveBeenCalledWith(1234567890, "order_create_failed");
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
