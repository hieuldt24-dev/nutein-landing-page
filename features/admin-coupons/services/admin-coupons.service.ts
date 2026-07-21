import { sleep } from "@/lib/utils";
import { ADMIN_COUPONS_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_COUPONS } from "../data/coupons.mock";
import type { AdminCoupon, AdminCouponInput } from "../types";

let store: AdminCoupon[] = structuredClone(MOCK_ADMIN_COUPONS);

export const adminCouponsService = {
  async list(): Promise<AdminCoupon[]> {
    await sleep(ADMIN_COUPONS_MOCK_LATENCY_MS);
    return [...store].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getById(id: string): Promise<AdminCoupon | null> {
    await sleep(ADMIN_COUPONS_MOCK_LATENCY_MS);
    return store.find((c) => c.id === id) ?? null;
  },

  async create(input: AdminCouponInput): Promise<AdminCoupon> {
    await sleep(ADMIN_COUPONS_MOCK_LATENCY_MS);
    const code = input.code.trim().toUpperCase();
    if (!code) throw new Error("Mã coupon bắt buộc.");
    if (store.some((c) => c.code === code)) throw new Error("Mã đã tồn tại.");
    const row: AdminCoupon = {
      id: `cpn-${Date.now()}`,
      code,
      discountType: input.discountType,
      discount: input.discount,
      minOrderValue: input.minOrderValue,
      usageLimit: input.usageLimit,
      usedCount: input.usedCount ?? 0,
      isActive: input.isActive,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
    };
    store = [row, ...store];
    return structuredClone(row);
  },

  async update(id: string, input: Partial<AdminCouponInput>): Promise<AdminCoupon> {
    await sleep(ADMIN_COUPONS_MOCK_LATENCY_MS);
    const idx = store.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error("Không tìm thấy coupon.");
    const current = store[idx];
    const nextCode = input.code?.trim().toUpperCase();
    if (nextCode && store.some((c) => c.code === nextCode && c.id !== id)) {
      throw new Error("Mã đã tồn tại.");
    }
    const updated: AdminCoupon = {
      ...current,
      ...input,
      code: nextCode ?? current.code,
    };
    store = [...store.slice(0, idx), updated, ...store.slice(idx + 1)];
    return structuredClone(updated);
  },

  async setActive(id: string, isActive: boolean): Promise<AdminCoupon> {
    return this.update(id, { isActive });
  },
};
