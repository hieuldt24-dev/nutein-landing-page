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

// ─── Chống spam đơn chưa thanh toán (RFC-2) ─────────────────────────────────

/**
 * Ghi vào `orders.protection_version`. Đơn có giá trị NULL = đơn LEGACY tạo
 * trước cơ chế này, không phải "chưa set".
 */
export const CHECKOUT_PROTECTION_VERSION = 1;

/** Hạn chuyển khoản đề xuất: 30 phút kể từ `created_at` (đồng hồ DB). */
export const CHECKOUT_PAYMENT_TTL_SECONDS = 30 * 60;

/** Cap đơn BANK_TRANSFER đang giữ chỗ / user — giá trị ĐỀ XUẤT (plan §Chính sách). */
export const CHECKOUT_BANK_ACTIVE_CAP = 2;

/**
 * Cap "vô hiệu" dùng khi enforcement TẮT: RPC bắt buộc phải nhận một số nguyên
 * dương, nên không thể truyền NULL để tắt. Cơ chế atomic vẫn chạy đủ (và vẫn
 * kiểm chứng được bằng integration test truyền cap thật), nhưng không khách nào
 * bị chặn.
 */
const CHECKOUT_CAP_DISABLED = 1_000_000;

/**
 * Enforcement mặc định TẮT (execute-instruction E2 + Autonomous Goal Block):
 * cap/quota/deadline CHỈ được bật sau khi owner đã chạy database ACL probe và
 * chốt ngưỡng. Bật bằng `CHECKOUT_PROTECTION_ENFORCED=true`.
 *
 * COD cap, daily quota và trần reserve toàn cửa hàng vẫn là `null` kể cả khi
 * bật — chúng là quyết định của owner, agent KHÔNG được tự chốt.
 */
export function isCheckoutEnforcementEnabled(): boolean {
  return process.env.CHECKOUT_PROTECTION_ENFORCED === "true";
}

export interface CheckoutProtectionPolicy {
  protectionVersion: number;
  bankActiveCap: number;
  /** `null` = chưa chốt chính sách -> RPC bỏ qua cap COD. */
  codActiveCap: number | null;
  /** `null` = tắt quota/ngày. */
  dailyQuota: number | null;
  /** `null` = không đặt hạn thanh toán cho đơn mới. */
  paymentTtlSeconds: number | null;
}

export function resolveCheckoutProtectionPolicy(): CheckoutProtectionPolicy {
  const enforced = isCheckoutEnforcementEnabled();
  return {
    protectionVersion: CHECKOUT_PROTECTION_VERSION,
    bankActiveCap: enforced ? CHECKOUT_BANK_ACTIVE_CAP : CHECKOUT_CAP_DISABLED,
    codActiveCap: null,
    dailyQuota: null,
    paymentTtlSeconds: enforced ? CHECKOUT_PAYMENT_TTL_SECONDS : null,
  };
}

// ─── Throttle checkout (RFC-3) ──────────────────────────────────────────────

/**
 * Hạn mức POST /api/checkout (plan §Chính sách đề xuất). Đây là giá trị vận
 * hành, KHÔNG phải bốn ngưỡng đang chờ owner (COD cap / trần reserve toàn cửa
 * hàng / review SLA / audit retention).
 *
 * IP lỏng hơn account gấp 6 lần vì NAT: một quán cafe hay một nhà mạng di động
 * có thể có hàng chục khách thật sau cùng một IP. Account mới là cơ chế chính;
 * IP là tín hiệu phụ (plan: "IP là tín hiệu phụ vì NAT, VPN và IPv6 rotation").
 */
export const CHECKOUT_RATE_LIMIT = {
  windowSeconds: 10 * 60,
  accountMax: 10,
  ipMax: 60,
} as const;

/**
 * SQLSTATE tuỳ biến do RPC `checkout_create_order_atomic` /
 * `checkout_transition_order_state` raise. Postgres yêu cầu đúng 5 ký tự.
 * Map sang HTTP status + mã lỗi public của API (plan §Public Contracts).
 */
export const CHECKOUT_DB_ERROR_MAP: Record<
  string,
  { statusCode: 400 | 409; code: string }
> = {
  /** Vượt cap đơn giữ chỗ. */
  NTCAP: { statusCode: 409, code: "UNPAID_ORDER_LIMIT" },
  /** Cùng idempotency key nhưng payload khác. */
  NTIDM: { statusCode: 409, code: "IDEMPOTENCY_CONFLICT" },
  /** Số tiền client gửi không khớp công thức / vượt trần coupon. */
  NTVER: { statusCode: 409, code: "PRICE_CHANGED" },
  /** Coupon không hợp lệ/hết hạn/hết lượt/chưa đạt tối thiểu. */
  NTCPN: { statusCode: 400, code: "BAD_REQUEST" },
  /** Hết hàng hoặc không đủ số lượng. */
  NTSTK: { statusCode: 400, code: "BAD_REQUEST" },
  /** Vượt hạn mức tạo đơn/ngày. */
  NTQTA: { statusCode: 409, code: "CHECKOUT_QUOTA_EXCEEDED" },
  /** Chuyển trạng thái không hợp lệ / expectedVersion lệch. */
  NTSTA: { statusCode: 409, code: "ORDER_STATE_CONFLICT" },
} as const;

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
    description:
      "Quét mã QR và chuyển khoản — nhân viên sẽ xác nhận thủ công sau khi nhận được tiền.",
  },
];

export const CHECKOUT_SUBMIT_LABEL = "Đặt hàng ngay";
export const CHECKOUT_SHIPPING_GATE_MESSAGE =
  "Nhập địa chỉ giao hàng để xem phương thức vận chuyển.";
