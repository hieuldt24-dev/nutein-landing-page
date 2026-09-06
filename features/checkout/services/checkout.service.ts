import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import {
  buildCartSummary,
  resolveCheckoutShippingFee,
} from "@/features/cart/pricing";
import { BadRequestError, ConflictError } from "@/src/errors/app.error";
import { buildVietQrImageUrl } from "@/lib/vietqr";
import { logger } from "@/src/logging/logger";
import { productService } from "@/features/product/services/product.service";
import { refreshProductCatalogServer } from "@/features/product/services/product-catalog.server";
import {
  resolveCheckoutProtectionPolicy,
  SHIPPING_FEES_VND,
} from "../constants";
import type { CreateOrderRequest } from "../schemas/checkout.schema";
import type { CreateOrderResult, OrderStatus } from "../types";
import { couponValidationService } from "./coupon-validation.service";
import { checkoutProtectionService } from "./checkout-protection.service";
import {
  buildOrderCode,
  orderRepository,
  type OrderReplaySnapshot,
} from "./order.repository";
import { orderEmailService } from "./order-email.service";

function estimatedDeliveryLabel(
  shippingMethod: CreateOrderRequest["shippingMethod"],
): string {
  return shippingMethod === "express"
    ? "Dự kiến giao trong 1–2 ngày làm việc"
    : "Dự kiến giao trong 3–5 ngày làm việc";
}

/** Tổng số hũ yêu cầu (packQuantity × units/gói) — cùng công thức orderRepository dùng khi ghi order_items. */
function totalRequestedUnits(
  lines: { variantId: string; quantity: number }[],
): number {
  const detail = productService.getProductDetail();
  return lines.reduce((sum, line) => {
    const variant = productService.resolveVariant(detail, line.variantId);
    return sum + line.quantity * variant.units;
  }, 0);
}

interface ResolvedPayment {
  uiStatus: OrderStatus;
  qrImageUrl?: string;
}

/**
 * Chuyển khoản ngân hàng = VietQR tự host: chỉ dựng URL ảnh QR (thuần string,
 * không gọi mạng, không gateway). Không có webhook/callback nào — đơn nằm
 * UNPAID tới khi nhân viên xác nhận thủ công.
 */
function resolvePayment(
  paymentMethod: CreateOrderRequest["paymentMethod"],
  context: {
    orderCode: string;
    amount: number;
  },
): ResolvedPayment {
  if (paymentMethod === "cod") {
    return { uiStatus: "pending" };
  }
  const qrImageUrl = buildVietQrImageUrl({
    amount: context.amount,
    addInfo: context.orderCode,
  });
  return {
    uiStatus: "awaiting_payment",
    ...(qrImageUrl ? { qrImageUrl } : {}),
  };
}

/** Map enum DB về giá trị contract của API. */
function toApiShippingMethod(
  value: string,
): CreateOrderRequest["shippingMethod"] {
  return value === "EXPRESS" ? "express" : "standard";
}

function toApiPaymentMethod(
  value: string,
): CreateOrderRequest["paymentMethod"] {
  return value === "BANK_TRANSFER" ? "bank_transfer" : "cod";
}

/**
 * Dựng lại response của một REPLAY hoàn toàn từ snapshot BẤT BIẾN của đơn cũ.
 *
 * KHÔNG chạy lại pricing, KHÔNG đọc catalog, KHÔNG gửi email. Khách bấm F5 hay
 * mất response rồi retry đều nhận lại đúng đơn cũ với đúng số tiền cũ, kể cả
 * khi staff đã đổi giá hoặc coupon đã hết lượt trong lúc đó.
 */
function buildReplayResult(snapshot: OrderReplaySnapshot): CreateOrderResult {
  const shippingMethod = toApiShippingMethod(snapshot.shippingMethod);
  const paymentMethod = toApiPaymentMethod(snapshot.paymentMethod);
  const address = snapshot.shippingAddress;
  const couponDiscountAmount = address.couponDiscountAmount ?? 0;
  const voucherDiscount = snapshot.discountAmount - couponDiscountAmount;

  // Đơn LEGACY (tạo trước RFC-2) không có `displaySummary`. Fallback suy ra từ
  // các cột tiền đã lưu — vẫn là dữ liệu bất biến của chính đơn đó, không phải
  // giá catalog hiện tại.
  const fallbackQuantity = (address.lines ?? []).reduce(
    (sum, line) => sum + line.packQuantity,
    0,
  );
  const display = address.displaySummary ?? {
    quantity: fallbackQuantity,
    unitPrice:
      fallbackQuantity > 0
        ? Math.round(snapshot.totalPrice / fallbackQuantity)
        : 0,
    discountPercent:
      snapshot.totalPrice > 0
        ? Math.round((voucherDiscount / snapshot.totalPrice) * 100)
        : 0,
  };

  const isExpired =
    snapshot.paymentExpiresAt !== null &&
    new Date(snapshot.paymentExpiresAt) <= new Date();
  const canStillPay =
    paymentMethod === "bank_transfer" &&
    snapshot.paymentStatus === "UNPAID" &&
    snapshot.status !== "CANCELLED" &&
    snapshot.status !== "RETURNED" &&
    !isExpired;
  const qrImageUrl = canStillPay
    ? buildVietQrImageUrl({
        amount: snapshot.finalPrice,
        addInfo: snapshot.orderCode,
      })
    : undefined;

  return {
    orderId: snapshot.orderId,
    orderCode: snapshot.orderCode,
    status: canStillPay ? "awaiting_payment" : "pending",
    estimatedDeliveryLabel: estimatedDeliveryLabel(shippingMethod),
    summary: {
      quantity: display.quantity,
      unitPrice: display.unitPrice,
      subtotal: snapshot.totalPrice,
      discountPercent: display.discountPercent,
      discountAmount: voucherDiscount,
      shippingFee: snapshot.shippingFee,
      shippingNote: "",
      total: snapshot.finalPrice,
      ...(address.couponCode
        ? { couponCode: address.couponCode, couponDiscountAmount }
        : {}),
    },
    buyer: {
      fullName: address.fullName,
      phone: address.phone,
      email: address.email,
    },
    address: {
      provinceCode: address.provinceCode,
      province: address.province,
      wardCode: address.wardCode,
      ward: address.ward,
      street: address.street,
    },
    ...(snapshot.note ? { note: snapshot.note } : {}),
    shippingMethod,
    paymentMethod,
    ...(qrImageUrl ? { qrImageUrl } : {}),
    replayed: true,
    paymentExpiresAt: snapshot.paymentExpiresAt,
    reviewState: snapshot.reviewState,
  };
}

/**
 * Tạo đơn thật. Yêu cầu migration E2E đã apply. Giỏ hàng sống client-side
 * (localStorage) — client tự xoá sau khi submit thành công, không có gì
 * để server clear ở đây.
 */
export const checkoutService = {
  async createOrder(
    userId: string,
    input: CreateOrderRequest,
    /**
     * Header `Idempotency-Key` do browser sinh. OPTIONAL trong RFC-2: cửa sổ
     * tương thích của RFC-3 yêu cầu client ship header TRƯỚC, server chỉ
     * cảnh báo + log khi thiếu. Thiếu key -> sinh key server-side để đường ghi
     * atomic vẫn chạy, nhưng request đó KHÔNG có bảo vệ replay.
     */
    idempotencyKey?: string,
  ): Promise<CreateOrderResult> {
    const serviceLogger = logger.child({
      service: "checkoutService",
      action: "createOrder",
    });

    const requestHash = checkoutProtectionService.buildRequestHash(input);
    const hashVersion = checkoutProtectionService.hashVersion;
    const effectiveKey = idempotencyKey ?? randomUUID();
    if (!idempotencyKey) {
      serviceLogger.warn(
        { userId, mode: "compat-window" },
        "Thiếu header Idempotency-Key — request này không có bảo vệ replay",
      );
    }

    // (1) REPLAY LOOKUP TRƯỚC PRICING. Đứng trước mọi thứ khác có chủ đích:
    // replay không được tiêu cap, không tiêu quota, không chạy lại định giá và
    // không gửi email lần hai.
    if (idempotencyKey) {
      const existing = await orderRepository.findReplay(userId, idempotencyKey);
      if (existing) {
        if (
          existing.requestHash !== requestHash ||
          existing.hashVersion !== hashVersion
        ) {
          throw new ConflictError(
            "Idempotency-Key này đã được dùng cho một đơn hàng khác — hãy bắt đầu đơn mới.",
            "IDEMPOTENCY_CONFLICT",
          );
        }
        serviceLogger.info(
          { userId, orderId: existing.orderId, replayed: true },
          "Order replay",
        );
        return buildReplayResult(existing);
      }
    }

    // Đảm bảo cartSummary tính theo GIÁ THẬT hiện tại (Staff sửa qua
    // /staff/products) — cache productService là module-level sync, nếu
    // không refresh ở đây sẽ tính theo giá lần refresh gần nhất (có thể cũ).
    // SELECT này kèm luôn `stock` (cùng 1 row products) — dùng lại bên dưới
    // thay vì bắn thêm 1 round-trip DB riêng cho getAvailableStock().
    const stockResult = await refreshProductCatalogServer();

    const cartSummary = buildCartSummary({ lines: input.lines });
    if (cartSummary.isEmpty) {
      throw new BadRequestError("Giỏ hàng trống — không thể đặt hàng.");
    }

    // Chặn đặt vượt tồn kho TRƯỚC khi ghi DB — tránh tạo đơn orphan cho số
    // lượng không thể giao. Chỉ fallback sang
    // query riêng khi refresh ở trên lỗi/thiếu data (best-effort trả null) —
    // không được phép bỏ qua check tồn kho trong trường hợp đó.
    // `stockResult` là object truthy kể cả khi `stock` là NaN (cột DB null/
    // non-numeric qua Number(row.stock)) — chỉ test truthiness thì
    // `requestedUnits > NaN` luôn false và guard tồn kho bị vô hiệu hoá. Vì
    // vậy phải kiểm tra tính hợp lệ của GIÁ TRỊ, không chỉ của object.
    const requestedUnits = totalRequestedUnits(cartSummary.lines);
    const availableStock =
      stockResult && Number.isFinite(stockResult.stock)
        ? stockResult.stock
        : await orderRepository.getAvailableStock();
    if (requestedUnits > availableStock) {
      throw new BadRequestError(
        availableStock > 0
          ? `Chỉ còn ${availableStock} hũ trong kho — vui lòng giảm số lượng.`
          : "Sản phẩm hiện đã hết hàng.",
      );
    }

    const { shippingFee, shippingNote } = resolveCheckoutShippingFee(
      input.shippingMethod,
      cartSummary.voucherProgress,
      SHIPPING_FEES_VND,
    );

    // Mitigation 3 — LUÔN tra + tính lại coupon từ DB sống tại thời điểm submit.
    // Kết quả của endpoint preview chỉ để hiển thị; client chỉ gửi lên đúng
    // chuỗi `couponCode`, số tiền giảm không bao giờ đi qua biên client.
    // `cartSummary.subtotal` = tạm tính TRƯỚC giảm giá theo mốc voucher — đúng
    // cơ sở đối chiếu `min_order_value`.
    const couponResult = input.couponCode
      ? await couponValidationService.validateAndComputeDiscount({
          code: input.couponCode,
          subtotal: cartSummary.subtotal,
        })
      : null;
    const couponDiscountAmount = couponResult?.discountAmount ?? 0;

    // CỘNG DỒN: giảm theo mốc voucher và giảm theo coupon luôn cộng vào nhau,
    // không cái nào thay thế/ghi đè cái nào.
    const combinedDiscount = cartSummary.discountAmount + couponDiscountAmount;
    const merchandiseTotal = cartSummary.total - couponDiscountAmount;
    const total = merchandiseTotal + shippingFee;
    const orderCode = buildOrderCode();

    const { uiStatus, qrImageUrl } = resolvePayment(input.paymentMethod, {
      orderCode,
      amount: total,
    });

    const note = input.note?.trim() ? input.note.trim() : undefined;
    const primaryUnitPrice = cartSummary.lines[0]?.unitPrice ?? 0;

    // (2) QUOTE SNAPSHOT BẤT BIẾN cho request này. Mọi con số gửi xuống RPC lấy
    // từ đây, không đọc lại `productService` (module-level cache có thể bị
    // refresh bởi request khác giữa chừng). DB vẫn kiểm lại công thức tiền,
    // trần coupon và tồn kho dưới lock — snapshot không phải nguồn tin cậy cuối.
    const quote = {
      unitPrice: primaryUnitPrice,
      subtotal: cartSummary.subtotal,
      discountAmount: combinedDiscount,
      shippingFee,
      total,
    } as const;

    // (3) MỘT lời gọi RPC duy nhất: order + items + stock + coupon + ledger +
    // idempotency key + audit event trong CÙNG một transaction. Không còn
    // đường `orders.delete()` bù trừ, nên không còn rò rỉ lượt coupon.
    const created = await orderRepository.createAtomic({
      userId,
      input,
      money: quote,
      meta: {
        orderCode,
        status: "PENDING",
        paymentStatus: "UNPAID",
      },
      idempotency: {
        key: effectiveKey,
        requestHash,
        hashVersion,
      },
      policy: resolveCheckoutProtectionPolicy(),
      ...(couponResult
        ? {
            coupon: {
              couponId: couponResult.couponId,
              couponCode: couponResult.code,
              couponDiscountAmount,
            },
          }
        : {}),
      displaySummary: {
        quantity: cartSummary.quantity,
        unitPrice: primaryUnitPrice,
        discountPercent: cartSummary.discountPercent,
      },
    });

    // Race: một request cùng key đã commit giữa bước (1) và (3). RPC trả replay
    // thay vì tạo đơn thứ hai — dựng lại response từ đơn cũ và KHÔNG gửi email.
    if (created.replayed) {
      const snapshot = await orderRepository.findReplay(userId, effectiveKey);
      if (snapshot) {
        serviceLogger.info(
          { userId, orderId: snapshot.orderId, replayed: true, race: true },
          "Order replay (concurrent same key)",
        );
        return buildReplayResult(snapshot);
      }
    }

    const result: CreateOrderResult = {
      orderId: created.orderId,
      orderCode: created.orderCode,
      status: uiStatus,
      estimatedDeliveryLabel: estimatedDeliveryLabel(input.shippingMethod),
      summary: {
        quantity: cartSummary.quantity,
        unitPrice: primaryUnitPrice,
        subtotal: cartSummary.subtotal,
        discountPercent: cartSummary.discountPercent,
        discountAmount: cartSummary.discountAmount,
        shippingFee,
        shippingNote,
        total,
        ...(couponResult
          ? { couponCode: couponResult.code, couponDiscountAmount }
          : {}),
      },
      buyer: {
        fullName: input.buyer.fullName.trim(),
        phone: input.buyer.phone.trim(),
        email: input.buyer.email.trim().toLowerCase(),
      },
      address: {
        provinceCode: input.address.provinceCode.trim(),
        province: input.address.province.trim(),
        wardCode: input.address.wardCode.trim(),
        ward: input.address.ward.trim(),
        street: input.address.street.trim(),
      },
      note,
      shippingMethod: input.shippingMethod,
      paymentMethod: input.paymentMethod,
      ...(qrImageUrl ? { qrImageUrl } : {}),
      replayed: false,
      paymentExpiresAt: created.paymentExpiresAt,
      reviewState: created.reviewState,
    };

    serviceLogger.info(
      {
        orderId: result.orderId,
        orderCode: result.orderCode,
        quantity: result.summary.quantity,
        lineCount: cartSummary.lines.length,
        total: result.summary.total,
        paymentMethod: result.paymentMethod,
        mode: "db",
      },
      "Order created",
    );

    // Best-effort — sendOrderConfirmation tự nuốt lỗi, không chặn response
    // đặt hàng (đơn đã tạo xong dù email gửi lỗi/thiếu cấu hình). Chạy sau
    // khi response đã gửi (after()) — khách không phải chờ cả lượt gọi
    // Resend API mới thấy trang "Đặt hàng thành công".
    //
    // CHỈ cho đơn MỚI: mọi nhánh replay ở trên đã return trước khi tới đây, nên
    // retry/F5 không bao giờ gửi email lần hai. Đây vẫn là best-effort, KHÔNG
    // phải exactly-once — crash sau commit vẫn có thể mất email (plan
    // §Idempotency: outbox bền vững là follow-up nếu owner yêu cầu).
    after(async () => {
      await orderEmailService.sendOrderConfirmation(result);
    });

    return result;
  },
};
