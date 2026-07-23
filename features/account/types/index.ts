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
  | "pending"
  | "processing"
  | "shipping"
  | "completed"
  | "cancelled";

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
  /** true khi đơn dùng payOS và còn UNPAID — hiện nút "Thanh toán ngay". */
  canRetryPayment: boolean;
}
