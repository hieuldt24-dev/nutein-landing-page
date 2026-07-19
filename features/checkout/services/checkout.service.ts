import "server-only";

import { buildCartSummary, resolveCheckoutShippingFee } from "@/features/cart/pricing";
import { BadRequestError } from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";
import {
  BANK_TRANSFER_INSTRUCTIONS,
  CHECKOUT_MOCK_LATENCY_MS,
  EWALLET_INSTRUCTIONS,
  SHIPPING_FEES_VND,
} from "../constants";
import type { CreateOrderRequest } from "../schemas/checkout.schema";
import type { CreateOrderResult, OrderStatus, PaymentInstructions } from "../types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildOrderCode(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NT-${y}${m}${d}-${suffix}`;
}

function estimatedDeliveryLabel(shippingMethod: CreateOrderRequest["shippingMethod"]): string {
  return shippingMethod === "express"
    ? "Dự kiến giao trong 1–2 ngày làm việc"
    : "Dự kiến giao trong 3–5 ngày làm việc";
}

function resolvePayment(
  paymentMethod: CreateOrderRequest["paymentMethod"]
): { status: OrderStatus; paymentInstructions?: PaymentInstructions } {
  if (paymentMethod === "cod") {
    return { status: "pending" };
  }
  if (paymentMethod === "bank_transfer") {
    return { status: "awaiting_payment", paymentInstructions: BANK_TRANSFER_INSTRUCTIONS };
  }
  return { status: "awaiting_payment", paymentInstructions: EWALLET_INSTRUCTIONS };
}

/**
 * Tạo đơn hàng — v1 mock (sinh mã, tính lại tiền).
 * Khi có backend: thêm nhánh remote, giữ chữ ký `createOrder`.
 */
export const checkoutService = {
  async createOrder(input: CreateOrderRequest): Promise<CreateOrderResult> {
    const serviceLogger = logger.child({ service: "checkoutService", action: "createOrder" });

    await delay(CHECKOUT_MOCK_LATENCY_MS);

    const cartSummary = buildCartSummary(input.quantity);
    if (cartSummary.isEmpty) {
      throw new BadRequestError("Giỏ hàng trống — không thể đặt hàng.");
    }

    const { shippingFee, shippingNote } = resolveCheckoutShippingFee(
      input.shippingMethod,
      cartSummary.voucherProgress,
      SHIPPING_FEES_VND
    );

    const merchandiseTotal = cartSummary.total;
    const total = merchandiseTotal + shippingFee;
    const { status, paymentInstructions } = resolvePayment(input.paymentMethod);

    const note = input.note?.trim() ? input.note.trim() : undefined;
    const orderId = crypto.randomUUID();
    const orderCode = buildOrderCode();

    const result: CreateOrderResult = {
      orderId,
      orderCode,
      status,
      estimatedDeliveryLabel: estimatedDeliveryLabel(input.shippingMethod),
      summary: {
        quantity: cartSummary.quantity,
        unitPrice: cartSummary.unitPrice,
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
        orderId,
        orderCode,
        quantity: result.summary.quantity,
        total: result.summary.total,
        paymentMethod: result.paymentMethod,
        mode: "mock",
      },
      "Mock order created"
    );

    return result;
  },
};
