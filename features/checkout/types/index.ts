import type { CreateOrderRequest } from "../schemas/checkout.schema";

export type ShippingMethod = "standard" | "express";
export type PaymentMethod = "cod" | "bank_transfer" | "ewallet";
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
}

export interface PaymentInstructions {
  title: string;
  lines: string[];
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
  paymentInstructions?: PaymentInstructions;
}

export type { CreateOrderRequest };
