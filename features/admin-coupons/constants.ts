export const ADMIN_COUPONS_SWR_KEY = "admin-coupons-list";

export function adminCouponDetailSwrKey(id: string): string {
  return `admin-coupon:${id}`;
}
