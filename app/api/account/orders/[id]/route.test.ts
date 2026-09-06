// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getOwnedOrderDetail: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
  requireRole: vi.fn(),
}));

vi.mock("@/features/account/services/account-order.service", () => ({
  accountOrderService: { getOwnedOrderDetail: mocks.getOwnedOrderDetail },
}));

import { NextRequest } from "next/server";
import { NotFoundError } from "@/src/errors/app.error";
import { GET } from "./route";

function request() {
  return new NextRequest("http://localhost:3000/api/account/orders/order-1");
}

const context = { params: Promise.resolve({ id: "order-1" }) };

describe("GET /api/account/orders/[id] — AC08 IDOR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({ userId: "user-1", role: "USER" });
  });

  it("luôn truy vấn theo userId của phiên, không theo giá trị client gửi", async () => {
    mocks.getOwnedOrderDetail.mockResolvedValue({
      id: "order-1",
      allowedActions: [],
    });
    await GET(request(), context);
    expect(mocks.getOwnedOrderDetail).toHaveBeenCalledWith("user-1", "order-1");
  });

  it("đơn của người khác -> 404 (KHÔNG phải 403 — không lộ sự tồn tại của đơn)", async () => {
    mocks.getOwnedOrderDetail.mockRejectedValue(new NotFoundError("Đơn hàng"));
    const res = await GET(request(), context);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("chưa đăng nhập -> 401, service không được gọi", async () => {
    const { AppError } = await import("@/src/errors/app.error");
    mocks.authenticate.mockRejectedValue(
      new AppError("Chưa đăng nhập", 401, "NO_TOKEN"),
    );
    const res = await GET(request(), context);
    expect(res.status).toBe(401);
    expect(mocks.getOwnedOrderDetail).not.toHaveBeenCalled();
  });

  it("trả no-store — QR và trạng thái thanh toán không được cache", async () => {
    mocks.getOwnedOrderDetail.mockResolvedValue({
      id: "order-1",
      allowedActions: [],
    });
    const res = await GET(request(), context);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
