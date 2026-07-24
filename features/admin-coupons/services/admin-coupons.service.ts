import { apiRequest } from "@/lib/api-client";
import type { AdminCoupon, AdminCouponInput } from "../types";

const BASE_PATH = "/api/staff/coupons";

/**
 * Admin coupons domain (S5) — client fetch wrapper gọi `app/api/staff/coupons/**`.
 * Business logic/DB thật nằm ở `admin-coupons.repository.ts` (server-only).
 */
export const adminCouponsService = {
  async list(): Promise<AdminCoupon[]> {
    return apiRequest<AdminCoupon[]>(BASE_PATH);
  },

  async getById(id: string): Promise<AdminCoupon | null> {
    return apiRequest<AdminCoupon>(`${BASE_PATH}/${id}`);
  },

  async create(input: AdminCouponInput): Promise<AdminCoupon> {
    return apiRequest<AdminCoupon>(BASE_PATH, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: Partial<AdminCouponInput>): Promise<AdminCoupon> {
    return apiRequest<AdminCoupon>(`${BASE_PATH}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async setActive(id: string, isActive: boolean): Promise<AdminCoupon> {
    return this.update(id, { isActive });
  },
};
