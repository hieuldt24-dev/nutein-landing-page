import type { CheckoutFormValues } from "./schemas/checkout.schema";
import type { PaymentMethod, ShippingMethod } from "./types";

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
    label: "Chuyển khoản ngân hàng",
    description: "Chuyển khoản theo nội dung đơn — xác nhận sau khi nhận chuyển khoản.",
  },
  {
    value: "ewallet",
    label: "Ví điện tử",
    description: "Hướng dẫn thanh toán ví sẽ gửi kèm xác nhận đơn (demo).",
  },
];

/** Copy demo — không phải STK thật. */
export const BANK_TRANSFER_INSTRUCTIONS = {
  title: "Hướng dẫn chuyển khoản (demo)",
  lines: [
    "Ngân hàng: Nutein Demo Bank",
    "Số tài khoản: 0123456789",
    "Chủ tài khoản: CONG TY NUTEIN DEMO",
    "Nội dung: NT-<mã đơn> <SĐT>",
  ],
};

export const EWALLET_INSTRUCTIONS = {
  title: "Hướng dẫn ví điện tử (demo)",
  lines: [
    "Sau khi đặt hàng, chúng tôi gửi link/QR thanh toán demo qua email hoặc Zalo.",
    "Môi trường hiện tại chưa kết nối cổng thanh toán thật — không trừ tiền.",
  ],
};

export const CHECKOUT_SUBMIT_LABEL = "Đặt hàng ngay";
export const CHECKOUT_SHIPPING_GATE_MESSAGE =
  "Nhập địa chỉ giao hàng để xem phương thức vận chuyển.";
