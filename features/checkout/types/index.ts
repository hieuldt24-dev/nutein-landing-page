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

/**
 * Trạng thái đối soát thanh toán — CỘT RIÊNG `orders.payment_review_state`,
 * KHÔNG phải giá trị mới của enum `OrderStatus`/`PaymentStatus`. Thêm giá trị
 * vào enum cũ sẽ phá mọi consumer đang exhaustive-switch, nên schema dùng
 * TEXT + CHECK. `null` = đơn legacy hoặc đơn COD.
 */
export type PaymentReviewState =
  | "AWAITING_TRANSFER"
  | "PAYMENT_CLAIMED"
  | "REVIEW_REQUIRED"
  | "CANCEL_REQUESTED"
  | "RELEASED"
  | "SETTLED"
  | "LATE_TRANSFER_REVIEW";

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
  /**
   * URL ảnh QR VietQR (chuyển khoản thủ công) — chỉ có khi
   * paymentMethod = bank_transfer VÀ đã cấu hình đủ env VIETQR_*.
   */
  qrImageUrl?: string;
  /**
   * `true` = request này là REPLAY của một idempotency key đã dùng; đơn KHÔNG
   * được tạo lại và KHÔNG side effect nào (email, audit) chạy lần hai.
   * Route dùng cờ này để trả 200 thay vì 201.
   *
   * OPTIONAL có chủ đích: contract cũ (snapshot sessionStorage, fixtures test,
   * email payload) không có field này — bắt buộc sẽ là breaking change cho mọi
   * consumer đang dựng `CreateOrderResult` bằng tay. `checkoutService` LUÔN set.
   */
  replayed?: boolean;
  /** Hạn chuyển khoản theo đồng hồ DB (ISO). `null` khi COD / enforcement tắt. */
  paymentExpiresAt?: string | null;
  /** Trạng thái đối soát hiện tại của đơn. `null` với COD / đơn legacy. */
  reviewState?: PaymentReviewState | null;
}

export type { CreateOrderRequest };
