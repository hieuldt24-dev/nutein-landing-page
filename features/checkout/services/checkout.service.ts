import "server-only";

import {
  buildCartSummary,
  resolveCheckoutShippingFee,
} from "@/features/cart/pricing";
import { cartServerService } from "@/features/cart/services/cart.server.service";
import { BadRequestError } from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";
import {
  BANK_TRANSFER_INSTRUCTIONS,
  EWALLET_INSTRUCTIONS,
  SHIPPING_FEES_VND,
} from "../constants";
import type { CreateOrderRequest } from "../schemas/checkout.schema";
import type {
  CreateOrderResult,
  OrderStatus,
  PaymentInstructions,
} from "../types";
import { buildOrderCode, orderRepository } from "./order.repository";

function estimatedDeliveryLabel(
  shippingMethod: CreateOrderRequest["shippingMethod"],
): string {
  return shippingMethod === "express"
    ? "Dự kiến giao trong 1–2 ngày làm việc"
    : "Dự kiến giao trong 3–5 ngày làm việc";
}

function resolvePayment(paymentMethod: CreateOrderRequest["paymentMethod"]): {
  uiStatus: OrderStatus;
  paymentInstructions?: PaymentInstructions;
} {
  if (paymentMethod === "cod") {
    return { uiStatus: "pending" };
  }
  if (paymentMethod === "bank_transfer") {
    return {
      uiStatus: "awaiting_payment",
      paymentInstructions: BANK_TRANSFER_INSTRUCTIONS,
    };
  }
  return {
    uiStatus: "awaiting_payment",
    paymentInstructions: EWALLET_INSTRUCTIONS,
  };
}

/**
 * Tạo đơn thật + clear giỏ DB. Yêu cầu migration E2E đã apply.
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

    const cartSummary = buildCartSummary({ lines: input.lines });
    if (cartSummary.isEmpty) {
      throw new BadRequestError("Giỏ hàng trống — không thể đặt hàng.");
    }

    const { shippingFee, shippingNote } = resolveCheckoutShippingFee(
      input.shippingMethod,
      cartSummary.voucherProgress,
      SHIPPING_FEES_VND,
    );

    const merchandiseTotal = cartSummary.total;
    const total = merchandiseTotal + shippingFee;
    const { uiStatus, paymentInstructions } = resolvePayment(input.paymentMethod);

    const note = input.note?.trim() ? input.note.trim() : undefined;
    const orderCode = buildOrderCode();
    const primaryUnitPrice = cartSummary.lines[0]?.unitPrice ?? 0;

    const row = await orderRepository.create(
      userId,
      input,
      {
        unitPrice: primaryUnitPrice,
        subtotal: cartSummary.subtotal,
        discountAmount: cartSummary.discountAmount,
        shippingFee,
        total,
      },
      {
        orderCode,
        status: "PENDING",
        paymentStatus: "UNPAID",
      },
    );

    await cartServerService.clear(userId);

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
      paymentInstructions,
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

    return result;
  },
};
