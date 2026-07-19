/**
 * Cart state của Nutein — single-SKU: chỉ 1 dòng hàng (sản phẩm Nutein) +
 * quantity, KHÔNG phải danh sách nhiều sản phẩm (xem docs/state-management.md mục 7).
 */
export interface CartState {
  quantity: number;
}

/**
 * Snapshot tiền/voucher sẵn sàng render — shape giống response API sau này.
 * UI chỉ đọc field này, không tự tính % giảm.
 */
export interface CartSummary {
  quantity: number;
  unitPrice: number;
  /** Tổng trước giảm = quantity × unitPrice. */
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

/** Cấu hình 1 mốc ưu đãi theo tổng tiền (nghiệp vụ, không phụ thuộc UI). */
export interface VoucherTier {
  id: string;
  /** Ngưỡng tổng tiền (subtotal) cần đạt, đơn vị VND. */
  thresholdVnd: number;
  label: string;
  kind: VoucherTierKind;
  /** Chỉ có khi `kind === "discount"`. */
  discountPercent?: number;
}

/** 1 mốc ưu đãi kèm trạng thái đã tính toán theo subtotal hiện tại. */
export interface VoucherTierProgress extends VoucherTier {
  achieved: boolean;
  /**
   * Vị trí mốc trên progress bar, 0–100 — đều theo index
   * (Joy Rush: 10/30/50/70/90), không theo tỉ lệ threshold.
   */
  positionPercent: number;
}

/** Kết quả tính toán bar voucher theo subtotal hiện tại — dùng để render realtime. */
export interface VoucherProgress {
  tiers: VoucherTierProgress[];
  /** Mốc tiếp theo chưa đạt được, `null` nếu đã đạt mốc cao nhất. */
  nextTier: VoucherTierProgress | null;
  amountRemainingVnd: number;
  /** % lấp đầy của progress bar, 0-100. */
  progressPercent: number;
  isMaxTierAchieved: boolean;
}
