export type AdminDiscountType = "FIXED" | "PERCENTAGE";

export interface AdminCoupon {
  id: string;
  code: string;
  discountType: AdminDiscountType;
  discount: number;
  minOrderValue: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export type AdminCouponInput = Omit<AdminCoupon, "id" | "usedCount" | "createdAt"> & {
  usedCount?: number;
};
