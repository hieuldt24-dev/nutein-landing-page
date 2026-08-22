import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));

import { adminCouponsService } from "./admin-coupons.service";

const couponInput = {
  code: "SALE10",
  discountType: "PERCENTAGE" as const,
  discount: 10,
  minOrderValue: null,
  usageLimit: null,
  isActive: true,
  expiresAt: null,
};

describe("adminCouponsService", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({});
  });

  it("list -> GET /api/staff/coupons", async () => {
    mocks.apiRequest.mockResolvedValue([]);
    await adminCouponsService.list();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/coupons");
  });

  it("getById -> GET /api/staff/coupons/:id", async () => {
    await adminCouponsService.getById("c1");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/coupons/c1");
  });

  it("create -> POST với body JSON", async () => {
    await adminCouponsService.create(couponInput);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/coupons", {
      method: "POST",
      body: JSON.stringify(couponInput),
    });
  });

  it("update -> PATCH /:id với body JSON", async () => {
    await adminCouponsService.update("c1", { discount: 20 });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/coupons/c1", {
      method: "PATCH",
      body: JSON.stringify({ discount: 20 }),
    });
  });

  it("setActive -> ủy quyền cho update với {isActive}", async () => {
    await adminCouponsService.setActive("c1", false);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/coupons/c1", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("boom");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminCouponsService.list()).rejects.toBe(err);
  });
});
