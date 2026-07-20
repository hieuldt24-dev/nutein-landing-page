/**
 * Account domain DTOs — shape ổn định cho UI + API tương lai.
 * Session auth vẫn ở `features/auth` (email/fullName/phone).
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

/** Snapshot local (repository) theo 1 user email. */
export interface AccountData {
  profile: AccountProfile;
  addresses: ShippingAddress[];
}

/** Trạng thái đơn trên portal — khác checkout create (`pending` / `awaiting_payment`). */
export type AccountOrderStatus = "processing" | "shipping" | "completed";

export interface AccountOrder {
  id: string;
  orderCode: string;
  status: AccountOrderStatus;
  createdAt: string;
  quantity: number;
  variantLabel: string;
  total: number;
  estimatedDeliveryLabel?: string;
}
