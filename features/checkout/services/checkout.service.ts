import "server-only";

import { after } from "next/server";
import {
  buildCartSummary,
  resolveCheckoutShippingFee,
} from "@/features/cart/pricing";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";
import { productService } from "@/features/product/services/product.service";
import { refreshProductCatalogServer } from "@/features/product/services/product-catalog.server";
import { SHIPPING_FEES_VND } from "../constants";
import type { CreateOrderRequest } from "../schemas/checkout.schema";
import type { CreateOrderResult, OrderStatus, RetryPaymentResult } from "../types";
import { couponValidationService } from "./coupon-validation.service";
import { buildOrderCode, orderRepository } from "./order.repository";
import { orderEmailService } from "./order-email.service";
import { payosService } from "./payos.service";

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
  paymentUrl?: string;
  payosOrderCode?: number;
  payosPaymentLinkId?: string;
}

/**
 * Gọi payOS (nếu cần) TRƯỚC khi ghi DB — nếu payOS lỗi, throw ngay, chưa có
 * gì để rollback (đơn chưa được tạo).
 */
async function resolvePayment(
  paymentMethod: CreateOrderRequest["paymentMethod"],
  context: {
    orderCode: string;
    amount: number;
    buyer: CreateOrderRequest["buyer"];
  },
): Promise<ResolvedPayment> {
  if (paymentMethod === "cod") {
    return { uiStatus: "pending" };
  }
  const link = await payosService.createPaymentLink({
    orderCode: context.orderCode,
    amount: context.amount,
    buyer: {
      fullName: context.buyer.fullName.trim(),
      email: context.buyer.email.trim().toLowerCase(),
      phone: context.buyer.phone.trim(),
    },
  });
  return {
    uiStatus: "awaiting_payment",
    paymentUrl: link.checkoutUrl,
    payosOrderCode: link.payosOrderCode,
    payosPaymentLinkId: link.payosPaymentLinkId,
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

    // Chặn đặt vượt tồn kho TRƯỚC khi gọi payOS/ghi DB — tránh tạo payment
    // link hoặc đơn orphan cho số lượng không thể giao. Chỉ fallback sang
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

    const { uiStatus, paymentUrl, payosOrderCode, payosPaymentLinkId } =
      await resolvePayment(input.paymentMethod, {
        orderCode,
        amount: total,
        buyer: input.buyer,
      });

    const note = input.note?.trim() ? input.note.trim() : undefined;
    const primaryUnitPrice = cartSummary.lines[0]?.unitPrice ?? 0;

    // F1 — Nếu ghi DB thất bại SAU khi payOS đã tạo link, phải huỷ link đó,
    // nếu không sẽ để lại payment link "mồ côi" mà khách vẫn trả được tiền
    // trong khi hệ thống không có đơn tương ứng. Đường COD không có
    // payosOrderCode nên không đi vào nhánh này (không thay đổi hành vi).
    let row;
    try {
      row = await orderRepository.create(
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
          payosOrderCode,
          payosPaymentLinkId,
        },
        couponResult
          ? {
              couponId: couponResult.couponId,
              couponCode: couponResult.code,
              couponDiscountAmount,
            }
          : undefined,
      );
    } catch (createError) {
      if (payosOrderCode) {
        try {
          await payosService.cancelPaymentLink(payosOrderCode, "order_create_failed");
        } catch (cancelError) {
          // Huỷ link thất bại không được che lỗi gốc — chỉ log.
          serviceLogger.error(
            { err: cancelError, orderCode, payosOrderCode },
            "Huỷ payOS payment link sau khi tạo đơn thất bại không thành công",
          );
        }
      }
      throw createError;
    }

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
      paymentUrl,
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

  /** Trang /checkout/success gọi khi quay lại từ payOS để đối soát trạng thái thật. */
  async getPaymentStatusForUser(
    userId: string,
    orderCode: string,
  ): Promise<{ paymentStatus: "UNPAID" | "PAID" }> {
    const order = await orderRepository.findByOrderCodeForUser(orderCode, userId);
    if (!order) {
      throw new NotFoundError("Đơn hàng");
    }
    if (
      order.payment_status === "PAID" ||
      order.payment_method !== "PAYOS" ||
      !order.payos_order_code
    ) {
      return { paymentStatus: order.payment_status };
    }
    return payosService.reconcileByPayosOrderCode(order.payos_order_code);
  },

  /**
   * Đơn payOS bị bỏ dở (thoát giữa chừng, không quét QR) — tạo lại payment
   * link. `updatePayosLink` là compare-and-swap: nếu thua race (2 tab bấm
   * cùng lúc), huỷ link vừa tạo và báo lỗi cho client thử lại thay vì âm
   * thầm ghi đè link mà khách có thể đang xem ở tab kia.
   */
  async retryPayment(userId: string, orderCode: string): Promise<RetryPaymentResult> {
    const order = await orderRepository.findByOrderCodeForUser(orderCode, userId);
    if (!order) {
      throw new NotFoundError("Đơn hàng");
    }
    if (order.payment_status === "PAID") {
      return { status: "already_paid" };
    }
    if (order.payment_method !== "PAYOS") {
      throw new BadRequestError("Đơn hàng này không dùng payOS.");
    }

    const previousPayosOrderCode = order.payos_order_code;
    if (previousPayosOrderCode) {
      const reconciled = await payosService.reconcileByPayosOrderCode(
        previousPayosOrderCode,
      );
      if (reconciled.paymentStatus === "PAID") {
        return { status: "already_paid" };
      }
      await payosService.cancelPaymentLink(previousPayosOrderCode, "customer_retry");
    }

    const address = order.shipping_address;
    const link = await payosService.createPaymentLink({
      orderCode,
      amount: Number(order.final_price),
      buyer: {
        fullName: address.fullName,
        email: address.email,
        phone: address.phone,
      },
    });

    const updated = await orderRepository.updatePayosLink(
      order.id,
      previousPayosOrderCode,
      link.payosOrderCode,
      link.payosPaymentLinkId,
    );

    if (!updated) {
      await payosService.cancelPaymentLink(link.payosOrderCode, "retry_race_lost");
      throw new ConflictError("Đơn đang được xử lý ở nơi khác — vui lòng thử lại.");
    }

    return { status: "created", paymentUrl: link.checkoutUrl };
  },
};
