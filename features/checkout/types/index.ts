import type { CreateOrderRequest } from "../schemas/checkout.schema";

export type ShippingMethod = "standard" | "express";
export type PaymentMethod = "cod" | "bank_transfer";
export type OrderStatus = "pending" | "awaiting_payment";

export interface OrderMoneySummary {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  shippingFee: number;
  shippingNote: string;
  /** Tổng phải trả = (subtotal − discount) + shippingFee. */
  total: number;
  /** Mã giảm giá đã áp dụng (nếu có) — hiển thị thành dòng riêng, KHÔNG gộp vào `discountAmount` hiển thị của mốc voucher. */
  couponCode?: string;
  /** Phần giảm do coupon, tách riêng khỏi phần giảm theo mốc voucher. */
  couponDiscountAmount?: number;
}

/** Response create order — UI success + snapshot. */
export interface CreateOrderResult {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  estimatedDeliveryLabel: string;
  summary: OrderMoneySummary;
  buyer: CreateOrderRequest["buyer"];
  address: CreateOrderRequest["address"];
  note?: string;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  /** URL redirect payOS (checkoutUrl) — chỉ có khi paymentMethod = bank_transfer. */
  paymentUrl?: string;
}

/** Kết quả thanh toán lại đơn payOS bị bỏ dở — xem checkoutService.retryPayment. */
export type RetryPaymentResult =
  | { status: "already_paid" }
  | { status: "created"; paymentUrl: string };

export type { CreateOrderRequest };
