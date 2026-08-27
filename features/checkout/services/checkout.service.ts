import "server-only";

import { after } from "next/server";
import {
  buildCartSummary,
  resolveCheckoutShippingFee,
} from "@/features/cart/pricing";
import { BadRequestError } from "@/src/errors/app.error";
import { buildVietQrImageUrl } from "@/lib/vietqr";
import { logger } from "@/src/logging/logger";
import { productService } from "@/features/product/services/product.service";
import { refreshProductCatalogServer } from "@/features/product/services/product-catalog.server";
import { SHIPPING_FEES_VND } from "../constants";
import type { CreateOrderRequest } from "../schemas/checkout.schema";
import type { CreateOrderResult, OrderStatus } from "../types";
import { couponValidationService } from "./coupon-validation.service";
import { buildOrderCode, orderRepository } from "./order.repository";
import { orderEmailService } from "./order-email.service";

function estimatedDeliveryLabel(
  shippingMethod: CreateOrderRequest["shippingMethod"],
): string {
  return shippingMethod === "express"
    ? "Dự kiến giao trong 1–2 ngày làm việc"
    : "Dự kiến giao trong 3–5 ngày làm việc";
}

/** Tổng số hũ yêu cầu (packQuantity × units/gói) — cùng công thức orderRepository dùng khi ghi order_items. */
function totalRequestedUnits(lines: { variantId: string; quantity: number }[]): number {
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

/**
 * Tạo đơn thật. Yêu cầu migration E2E đã apply. Giỏ hàng sống client-side
 * (localStorage) — client tự xoá sau khi submit thành công, không có gì
 * để server clear ở đây.
 */
export const checkoutService = {
  async createOrder(
    userId: string,
    input: CreateOrderRequest,
  ): Promise<CreateOrderResult> {
    const serviceLogger = logger.child({
      service: "checkoutService",
      action: "createOrder",
    });

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

    // Không còn side-effect ngoài hệ thống nào xảy ra TRƯỚC khi ghi DB (VietQR
    // chỉ là 1 URL ảnh) — nên cũng không còn gì để rollback nếu insert lỗi.
    const row = await orderRepository.create(
      userId,
      input,
      {
        unitPrice: primaryUnitPrice,
        subtotal: cartSummary.subtotal,
        discountAmount: combinedDiscount,
        shippingFee,
        total,
      },
      {
        orderCode,
        status: "PENDING",
        paymentStatus: "UNPAID",
      },
      couponResult
        ? {
            couponId: couponResult.couponId,
            couponCode: couponResult.code,
            couponDiscountAmount,
          }
        : undefined,
    );

    const result: CreateOrderResult = {
      orderId: row.id,
      orderCode: row.order_code,
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
    after(async () => {
      await orderEmailService.sendOrderConfirmation(result);
    });

    return result;
  },
};
