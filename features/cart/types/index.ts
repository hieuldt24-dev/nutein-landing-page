/**
 * Cart Nutein — single-SKU, **nhiều dòng theo gói** (pack-1 / pack-3 / pack-6).
 * Mỗi dòng: variantId + quantity (**số gói**). Số hũ = quantity × variant.units
 * chỉ khi pricing chi tiết / ghi order_items.
 */

export interface CartLine {
  variantId: string;
  /** Số gói của variant này (không phải số hũ). */
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
}

/** Dòng đã gắn nhãn + giá — sẵn render UI. */
export interface CartLineSummary {
  variantId: string;
  label: string;
  quantity: number;
  /** Đơn giá / gói (VND). */
  unitPrice: number;
  /** quantity × unitPrice. */
  lineSubtotal: number;
}

/**
 * Snapshot tiền/voucher sẵn sàng render — shape giống response API.
 * UI chỉ đọc field này, không tự tính % giảm.
 */
export interface CartSummary {
  lines: CartLineSummary[];
  /** Tổng số gói mọi dòng — badge navbar / dock. */
  quantity: number;
  /** Tổng trước giảm = Σ lineSubtotal. */
  subtotal: number;
  /** % giảm đang áp dụng (0 nếu chưa đạt mốc discount). */
  discountPercent: number;
  discountAmount: number;
  /** Tổng sau giảm = subtotal − discountAmount. */
  total: number;
  shippingNote: string;
  voucherProgress: VoucherProgress;
  isEmpty: boolean;
}

export type VoucherTierKind = "discount" | "free_shipping";

export interface VoucherTier {
  id: string;
  thresholdVnd: number;
  label: string;
  kind: VoucherTierKind;
  discountPercent?: number;
}

export interface VoucherTierProgress extends VoucherTier {
  achieved: boolean;
  positionPercent: number;
}

export interface VoucherProgress {
  tiers: VoucherTierProgress[];
  nextTier: VoucherTierProgress | null;
  amountRemainingVnd: number;
  progressPercent: number;
  isMaxTierAchieved: boolean;
}
