/**
 * Account domain DTOs — shape ổn định cho UI + API.
 * Session auth vẫn ở `features/auth`; hồ sơ đọc từ `public.users`.
 */

export interface AccountProfile {
  email: string;
  fullName?: string;
  phone?: string;
}

export interface ShippingAddress {
  id: string;
  label?: string;
  provinceCode: string;
  province: string;
  wardCode: string;
  ward: string;
  street: string;
  isDefault: boolean;
}

/** @deprecated Giữ type cho chỗ còn bọc `{ profile }` — ưu tiên dùng AccountProfile trực tiếp. */
export interface AccountData {
  profile: AccountProfile;
}

/**
 * Trạng thái đơn trên portal account — map từ enum DB `OrderStatus`
 * (PENDING / PROCESSING / SHIPPED / DELIVERED / CANCELLED / RETURNED).
 */
export type AccountOrderStatus =
  "pending" | "processing" | "shipping" | "completed" | "cancelled";

/** Lọc danh sách đơn trên /account/orders. */
export type AccountOrderStatusFilter = AccountOrderStatus | "all";

export interface AccountOrder {
  id: string;
  orderCode: string;
  status: AccountOrderStatus;
  createdAt: string;
  quantity: number;
  variantLabel: string;
  total: number;
  estimatedDeliveryLabel?: string;
  /** Trạng thái thanh toán thật (khác `status` — vòng đời xử lý đơn). */
  paymentStatus: "UNPAID" | "PAID";
  /**
   * Mã giảm giá đã dùng — đọc từ snapshot `orders.shipping_address` lúc đặt
   * hàng, KHÔNG tra bảng `coupons` sống (coupon có thể đã bị sửa/xoá sau đó).
   */
  couponCode?: string;
  /** Phần giảm do coupon, tách riêng khỏi phần giảm theo mốc voucher. */
  couponDiscountAmount?: number;
}

/** Hành động khách được phép làm trên chính đơn của mình (RFC-3). */
export type AccountOrderAction = "claim_payment" | "request_cancel";

/**
 * Chi tiết một đơn của chính user — DTO TỐI THIỂU (plan §Public Contracts:
 * "DTO tối thiểu + QR khi còn được thanh toán"). Không trả thông tin người
 * nhận đầy đủ, không trả dữ liệu nội bộ (staff note, audit, số tài khoản người
 * gửi) để một IDOR sót lại cũng không lộ thêm gì.
 */
export interface AccountOrderDetail extends AccountOrder {
  paymentMethod: "COD" | "BANK_TRANSFER" | "MOMO" | "VNPAY" | "PAYOS";
  /** `null` với COD, đơn legacy, hoặc khi enforcement chưa bật. */
  paymentExpiresAt: string | null;
  /** Cột `orders.payment_review_state`. `null` = COD / legacy. */
  reviewState: string | null;
  /** Dùng làm `expectedVersion` cho claim/cancel — chống ghi đè khi đơn đã đổi. */
  stateVersion: number;
  /** Chỉ có khi đơn CÒN thanh toán được (chưa trả, chưa huỷ, chưa quá hạn). */
  qrImageUrl?: string;
  allowedActions: AccountOrderAction[];
}
