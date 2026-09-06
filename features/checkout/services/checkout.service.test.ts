// @vitest-environment node
// checkout.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  findReplay: vi.fn(),
  getAvailableStock: vi.fn(),
  buildVietQrImageUrl: vi.fn(),
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
    createAtomic: mocks.createOrder,
    findReplay: mocks.findReplay,
    getAvailableStock: mocks.getAvailableStock,
  },
}));

vi.mock("@/lib/vietqr", () => ({
  buildVietQrImageUrl: mocks.buildVietQrImageUrl,
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

vi.mock(
  "@/features/product/services/product.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/product/services/product.service")
      >();
    return {
      productService: {
        ...actual.productService,
      },
    };
  },
);

import { checkoutService } from "./checkout.service";
import { BadRequestError } from "@/src/errors/app.error";

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
  paymentMethod: "cod",
};

/** Kết quả RPC `checkout_create_order_atomic` cho một đơn MỚI. */
const orderRow = {
  replayed: false,
  orderId: "order-1",
  orderCode: "NT-20260722-AB12",
  status: "PENDING",
  paymentStatus: "UNPAID",
  reviewState: null,
  paymentExpiresAt: null,
  stateVersion: 0,
  createdAt: "2026-07-22T00:00:00.000Z",
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
    mocks.findReplay.mockResolvedValue(null);
    mocks.buildVietQrImageUrl.mockReturnValue(
      "https://img.vietqr.io/image/970407-19001234567890-compact2.png?amount=224000&addInfo=NT-20260722-AB12",
    );
  });

  it("cod: không dựng QR VietQR, tạo đơn bình thường, gửi email xác nhận", async () => {
    mocks.createOrder.mockResolvedValue(orderRow);

    const result = await checkoutService.createOrder("user-1", baseInput);
    await flushAfterCallbacks(); // sendOrderConfirmation giờ chạy trong after()

    expect(mocks.buildVietQrImageUrl).not.toHaveBeenCalled();
    expect(mocks.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ orderCode: "NT-20260722-AB12" }),
    );
    expect(mocks.createOrder).toHaveBeenCalled();
    expect(result.qrImageUrl).toBeUndefined();
    expect(result.status).toBe("pending");
  });

  // AC1/AC9 — nhánh bank_transfer thuần local: dựng URL QR từ tổng tiền + mã
  // đơn, KHÔNG gọi gateway nào (module payOS đã bị xoá khỏi repo).
  it("bank_transfer: trả uiStatus awaiting_payment + qrImageUrl dựng từ tổng tiền và mã đơn", async () => {
    mocks.createOrder.mockResolvedValue({
      ...orderRow,
      payment_method: "BANK_TRANSFER",
    });

    const result = await checkoutService.createOrder("user-1", {
      ...baseInput,
      paymentMethod: "bank_transfer",
    });

    // Số tiền trong QR phải là ĐÚNG tổng phải trả của đơn, mã đơn là nội dung CK.
    expect(mocks.buildVietQrImageUrl).toHaveBeenCalledWith({
      amount: result.summary.total,
      addInfo: "NT-20260722-AB12",
    });
    expect(result.status).toBe("awaiting_payment");
    expect(result.qrImageUrl).toContain("img.vietqr.io");

    // meta truyền xuống repository không còn field payOS nào.
    const createOrderMetaArg = mocks.createOrder.mock.calls[0][0].meta;
    expect(createOrderMetaArg).toEqual({
      orderCode: "NT-20260722-AB12",
      status: "PENDING",
      paymentStatus: "UNPAID",
    });
  });

  it("bank_transfer: chưa cấu hình env VietQR (null) → vẫn tạo đơn, qrImageUrl undefined", async () => {
    mocks.buildVietQrImageUrl.mockReturnValue(null);
    mocks.createOrder.mockResolvedValue({
      ...orderRow,
      payment_method: "BANK_TRANSFER",
    });

    const result = await checkoutService.createOrder("user-1", {
      ...baseInput,
      paymentMethod: "bank_transfer",
    });

    expect(mocks.createOrder).toHaveBeenCalled();
    expect(result.status).toBe("awaiting_payment");
    expect(result.qrImageUrl).toBeUndefined();
  });

  it("bank_transfer: create() lỗi → lỗi gốc nổi lên nguyên vẹn (không còn scaffold huỷ link)", async () => {
    const createError = new Error("DB insert failed");
    mocks.createOrder.mockRejectedValue(createError);

    await expect(
      checkoutService.createOrder("user-1", {
        ...baseInput,
        paymentMethod: "bank_transfer",
      }),
    ).rejects.toBe(createError);
  });

  it("vượt tồn kho → BadRequestError, không dựng QR lẫn gọi orderRepository.create", async () => {
    mocks.getAvailableStock.mockResolvedValue(0); // 1 gói pack-1 = 1 hũ > 0 còn lại

    await expect(
      checkoutService.createOrder("user-1", {
        ...baseInput,
        paymentMethod: "bank_transfer",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

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
      checkoutService.createOrder("user-1", {
        ...baseInput,
        paymentMethod: "bank_transfer",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.getAvailableStock).toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("refreshCatalogCache trả stock NaN + getAvailableStock lỗi DB → lỗi nổi lên (không âm thầm bỏ qua check)", async () => {
    mocks.refreshProductCatalogServer.mockResolvedValue({ stock: Number.NaN });
    const dbError = new Error("stock query failed");
    mocks.getAvailableStock.mockRejectedValue(dbError);

    await expect(checkoutService.createOrder("user-1", baseInput)).rejects.toBe(
      dbError,
    );

    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("refreshCatalogCache trả stock không đủ → BadRequestError, không cần gọi getAvailableStock riêng", async () => {
    mocks.refreshProductCatalogServer.mockResolvedValue({ stock: 0 });

    await expect(
      checkoutService.createOrder("user-1", {
        ...baseInput,
        paymentMethod: "bank_transfer",
      }),
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
    mocks.findReplay.mockResolvedValue(null);
    mocks.createOrder.mockResolvedValue(orderRow);
  });

  /** Nhiều gói để chắc chắn có giảm giá theo mốc voucher (discountAmount > 0). */
  const bundledInput: CreateOrderRequest = {
    ...baseInput,
    lines: [{ variantId: "pack-3", quantity: 2 }],
  };

  function moneyArg() {
    return mocks.createOrder.mock.calls[0][0].money as {
      subtotal: number;
      discountAmount: number;
      shippingFee: number;
      total: number;
    };
  }

  it("không gửi couponCode → không gọi service coupon, coupon param undefined", async () => {
    await checkoutService.createOrder("user-1", baseInput);

    expect(mocks.validateAndComputeDiscount).not.toHaveBeenCalled();
    expect(mocks.createOrder.mock.calls[0][0].coupon).toBeUndefined();
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
    expect(call.subtotal).toBeGreaterThan(
      moneyArg().subtotal - moneyArg().discountAmount,
    );
  });

  // AC1 + AC8 — cộng dồn, không cái nào ghi đè cái nào.
  it("cộng dồn giảm giá voucher + coupon, tổng đơn giảm đúng phần coupon", async () => {
    const noCoupon = await checkoutService.createOrder("user-1", bundledInput);
    const baselineMoney = moneyArg();
    vi.clearAllMocks();
    mocks.refreshProductCatalogServer.mockResolvedValue(null);
    mocks.getAvailableStock.mockResolvedValue(9999);
    mocks.sendOrderConfirmation.mockResolvedValue(undefined);
    mocks.findReplay.mockResolvedValue(null);
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
    expect(couponMoney.discountAmount).toBe(
      baselineMoney.discountAmount + 20_000,
    );
    expect(baselineMoney.discountAmount).toBeGreaterThan(0);
    // Tổng phải trả giảm đúng 20.000 so với khi không có coupon.
    expect(couponMoney.total).toBe(baselineMoney.total - 20_000);
    // Tạm tính không đổi.
    expect(couponMoney.subtotal).toBe(baselineMoney.subtotal);
    // final_price khớp công thức CHECK: subtotal − discount + ship.
    expect(couponMoney.total).toBe(
      couponMoney.subtotal -
        couponMoney.discountAmount +
        couponMoney.shippingFee,
    );

    // summary tách 2 dòng: giảm theo voucher giữ nguyên, coupon là dòng riêng.
    expect(withCoupon.summary.discountAmount).toBe(
      noCoupon.summary.discountAmount,
    );
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

    expect(mocks.createOrder.mock.calls[0][0].coupon).toEqual({
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
      checkoutService.createOrder("user-1", {
        ...bundledInput,
        couponCode: "SALE10",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("mã không tồn tại → throw, KHÔNG tạo đơn", async () => {
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
  });

  // AC10 — thua race ở trigger coupon: lỗi trigger phải nổi lên nguyên vẹn.
  it("trigger từ chối lúc insert (thua race) → lỗi trigger nổi lên nguyên vẹn", async () => {
    mocks.validateAndComputeDiscount.mockResolvedValue({
      couponId: "coupon-1",
      code: "SALE10",
      discountAmount: 20_000,
    });
    const triggerError = new BadRequestError("Mã giảm giá đã hết lượt sử dụng");
    mocks.createOrder.mockRejectedValue(triggerError);

    await expect(
      checkoutService.createOrder("user-1", {
        ...bundledInput,
        paymentMethod: "bank_transfer",
        couponCode: "SALE10",
      }),
    ).rejects.toBe(triggerError);
  });
});
