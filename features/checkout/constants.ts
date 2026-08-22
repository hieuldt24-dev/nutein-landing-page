import { formatCurrencyVnd } from "@/lib/utils";
import type { CheckoutFormValues } from "./schemas/checkout.schema";
import type { PaymentMethod, ShippingMethod } from "./types";

/**
 * Copy từ chối mã giảm giá — DÙNG CHUNG cho preview endpoint và
 * `checkoutService.createOrder()`. 3 chuỗi đầu là text NGUYÊN VĂN của trigger DB
 * `validate_and_apply_coupon()` (migration 20260718000000, Fix #8) — copy đúng
 * từng ký tự để text lúc preview và text lúc insert bị trigger chặn không lệch
 * nhau. 2 chuỗi cuối là case trigger KHÔNG kiểm (không tồn tại mã,
 * `min_order_value`) — chỉ app layer check, viết theo cùng văn phong.
 */
export const COUPON_MESSAGES = {
  /** App-layer only — trigger không phân biệt "không tồn tại" với "vô hiệu hoá". */
  notFound: "Mã giảm giá không tồn tại",
  /** Nguyên văn trigger. */
  inactive: "Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa",
  /** Nguyên văn trigger. */
  expired: "Mã giảm giá đã hết hạn",
  /** Nguyên văn trigger. */
  usageExhausted: "Mã giảm giá đã hết lượt sử dụng",
} as const;

/** App-layer only — trigger DB không kiểm `min_order_value`. */
export function couponBelowMinOrderMessage(minOrderValue: number): string {
  return `Đơn hàng cần tối thiểu ${formatCurrencyVnd(minOrderValue)} để dùng mã này`;
}

/** 3 text trigger DB có thể raise lúc INSERT — dùng để map lỗi Postgres về BadRequestError. */
export const COUPON_TRIGGER_MESSAGES: readonly string[] = [
  COUPON_MESSAGES.inactive,
  COUPON_MESSAGES.expired,
  COUPON_MESSAGES.usageExhausted,
];

/** Default values form checkout (RHF). */
export const CHECKOUT_FORM_DEFAULT_VALUES: CheckoutFormValues = {
  buyer: { fullName: "", phone: "", email: "" },
  address: {
    provinceCode: "",
    province: "",
    wardCode: "",
    ward: "",
    street: "",
  },
  note: "",
  shippingMethod: "standard",
  paymentMethod: "cod",
  saveInfo: false,
};

/** sessionStorage — snapshot đơn sau submit (chưa có GET /orders). */
export const CHECKOUT_ORDER_SNAPSHOT_KEY = "nutein:checkout-order-snapshot";

/** Phí ship ước tính v1 (VND) — freeship voucher ghi đè về 0. */
export const SHIPPING_FEES_VND: Record<ShippingMethod, number> = {
  standard: 25_000,
  express: 45_000,
};

export const SHIPPING_OPTIONS: {
  value: ShippingMethod;
  label: string;
  description: string;
  feeVnd: number;
}[] = [
  {
    value: "standard",
    label: "Tiêu chuẩn",
    description: "Giao trong 3–5 ngày làm việc",
    feeVnd: SHIPPING_FEES_VND.standard,
  },
  {
    value: "express",
    label: "Nhanh",
    description: "Giao trong 1–2 ngày làm việc",
    feeVnd: SHIPPING_FEES_VND.express,
  },
];

export const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "cod",
    label: "COD — Thanh toán khi nhận hàng",
    description: "Thanh toán bằng tiền mặt hoặc quẹt thẻ cho shipper.",
  },
  {
    value: "bank_transfer",
    label: "Chuyển khoản ngân hàng (payOS)",
    description: "Quét mã QR hoặc chuyển khoản qua payOS — xác nhận tự động.",
  },
];

export const CHECKOUT_SUBMIT_LABEL = "Đặt hàng ngay";
export const CHECKOUT_SHIPPING_GATE_MESSAGE =
  "Nhập địa chỉ giao hàng để xem phương thức vận chuyển.";
