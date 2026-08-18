/**
 * Cart Nutein — single-SKU, **nhiều dòng theo gói**.
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
  /** Giá tham chiếu / gói (VND), trước khi phân bổ bundle discount. */
  unitPrice: number;
  /** Phần giá bundle cuối cùng được phân bổ cho dòng này. */
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
  /** Tổng giá niêm yết theo số hũ, trước bundle discount. */
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
  /** Copy/benefit for bundle offers, e.g. "Tặng 1 bình nước". */
  benefit?: string;
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
