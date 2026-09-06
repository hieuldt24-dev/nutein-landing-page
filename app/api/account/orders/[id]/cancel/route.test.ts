// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getOwnedOrderDetail: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
  requireRole: vi.fn(),
}));

vi.mock("@/features/account/services/account-order.service", () => ({
  accountOrderService: { getOwnedOrderDetail: mocks.getOwnedOrderDetail },
}));

vi.mock("@/features/checkout/services/order.repository", () => ({
  orderRepository: { transition: mocks.transition },
}));

import { NextRequest } from "next/server";
import { NotFoundError } from "@/src/errors/app.error";
import { POST } from "./route";

const ORIGIN = "https://nutein.test";
const context = { params: Promise.resolve({ id: "order-1" }) };

function request(body: unknown = {}, origin: string | null = ORIGIN) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest(`${ORIGIN}/api/account/orders/order-1/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const openOrder = {
  id: "order-1",
  status: "pending",
  paymentStatus: "UNPAID",
  reviewState: "AWAITING_TRANSFER",
  stateVersion: 2,
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  savedEnv.APP_BASE_URL = process.env.APP_BASE_URL;
  savedEnv.CHECKOUT_PROTECTION_ENFORCED =
    process.env.CHECKOUT_PROTECTION_ENFORCED;
  process.env.APP_BASE_URL = ORIGIN;
  process.env.CHECKOUT_PROTECTION_ENFORCED = "true";
  mocks.authenticate.mockResolvedValue({ userId: "user-1", role: "USER" });
  mocks.getOwnedOrderDetail.mockResolvedValue(openOrder);
  mocks.transition.mockResolvedValue({
    orderId: "order-1",
    changed: true,
    status: "PENDING",
    paymentStatus: "UNPAID",
    reviewState: "CANCEL_REQUESTED",
    stateVersion: 3,
  });
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("POST cancel — AC06 yêu cầu hủy, không phải đã hủy", () => {
  it("gọi transition với action request_cancel", async () => {
    const res = await POST(request({ reason: "Đặt nhầm" }), context);
    expect(res.status).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "request_cancel",
        actorType: "CUSTOMER",
        reason: "Đặt nhầm",
      }),
    );
  });

  it("kết quả là CANCEL_REQUESTED — chưa release kho/coupon/slot", async () => {
    const body = await (await POST(request(), context)).json();
    expect(body.data.reviewState).toBe("CANCEL_REQUESTED");
    // Không có nhánh nào ở route gọi resolve_no_transfer (đường DUY NHẤT release).
    expect(mocks.transition.mock.calls[0][0].action).not.toBe(
      "resolve_no_transfer",
    );
  });

  it("bấm lại khi đã CANCEL_REQUESTED -> idempotent, KHÔNG gọi RPC lần hai", async () => {
    mocks.getOwnedOrderDetail.mockResolvedValue({
      ...openOrder,
      reviewState: "CANCEL_REQUESTED",
      stateVersion: 3,
    });
    const res = await POST(request(), context);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.changed).toBe(false);
    expect(body.data.stateVersion).toBe(3);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("đơn đã hủy hẳn -> vẫn 200 idempotent, không tăng state_version", async () => {
    mocks.getOwnedOrderDetail.mockResolvedValue({
      ...openOrder,
      status: "cancelled",
      reviewState: "RELEASED",
    });
    const res = await POST(request(), context);
    expect((await res.json()).data.changed).toBe(false);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});

describe("POST cancel — AC08 ownership + CSRF", () => {
  it("đơn của người khác -> 404, KHÔNG gọi transition", async () => {
    mocks.getOwnedOrderDetail.mockRejectedValue(new NotFoundError("Đơn hàng"));
    const res = await POST(request(), context);
    expect(res.status).toBe(404);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("Origin lạ -> 403", async () => {
    const res = await POST(request({}, "https://evil.example"), context);
    expect(res.status).toBe(403);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("field lạ -> 400", async () => {
    const res = await POST(request({ status: "CANCELLED" }), context);
    expect(res.status).toBe(400);
  });
});
