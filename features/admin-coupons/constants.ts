export const ADMIN_COUPONS_SWR_KEY = "admin-coupons-list";
export const ADMIN_COUPONS_MOCK_LATENCY_MS = 260;

export function adminCouponDetailSwrKey(id: string): string {
  return `admin-coupon:${id}`;
}
