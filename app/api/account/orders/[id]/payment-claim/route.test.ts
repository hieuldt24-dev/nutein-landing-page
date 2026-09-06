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
import { ConflictError, NotFoundError } from "@/src/errors/app.error";
import { POST } from "./route";

const ORIGIN = "https://nutein.test";
const context = { params: Promise.resolve({ id: "order-1" }) };

function request(body: unknown = {}, origin: string | null = ORIGIN) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest(`${ORIGIN}/api/account/orders/order-1/payment-claim`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  savedEnv.APP_BASE_URL = process.env.APP_BASE_URL;
  savedEnv.CHECKOUT_PROTECTION_ENFORCED =
    process.env.CHECKOUT_PROTECTION_ENFORCED;
  process.env.APP_BASE_URL = ORIGIN;
  process.env.CHECKOUT_PROTECTION_ENFORCED = "true";
  mocks.authenticate.mockResolvedValue({ userId: "user-1", role: "USER" });
  mocks.getOwnedOrderDetail.mockResolvedValue({
    id: "order-1",
    stateVersion: 3,
  });
  mocks.transition.mockResolvedValue({
    orderId: "order-1",
    changed: true,
    status: "PENDING",
    paymentStatus: "UNPAID",
    reviewState: "PAYMENT_CLAIMED",
    stateVersion: 4,
  });
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("POST payment-claim — AC05/AC06 claim chỉ là lời khai", () => {
  it("gọi transition với action claim_payment và actorType CUSTOMER", async () => {
    const res = await POST(
      request({ amount: 224000, reference: "NT-1" }),
      context,
    );
    expect(res.status).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        action: "claim_payment",
        actorId: "user-1",
        actorType: "CUSTOMER",
      }),
    );
  });

  it("route KHÔNG chứa nhánh nào đặt PAID, gia hạn deadline hay trả slot", async () => {
    await POST(request(), context);
    const payload = mocks.transition.mock.calls[0][0];
    // Chỉ đúng một action được gửi; không có field nào đụng tới thanh toán,
    // hạn chuyển khoản hay reservation.
    expect(payload.action).toBe("claim_payment");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("PAID");
    expect(serialized).not.toContain("payment_expires_at");
    expect(serialized).not.toContain("release");
  });

  it("response phản ánh đúng RPC: paymentStatus vẫn UNPAID sau claim", async () => {
    const res = await POST(request(), context);
    const body = await res.json();
    expect(body.data.paymentStatus).toBe("UNPAID");
    expect(body.data.reviewState).toBe("PAYMENT_CLAIMED");
  });

  it("claim lần hai -> 409 ORDER_STATE_CONFLICT (một claim/đơn)", async () => {
    mocks.transition.mockRejectedValue(
      new ConflictError(
        "Đơn đã được khai báo đã chuyển khoản",
        "ORDER_STATE_CONFLICT",
      ),
    );
    const res = await POST(request(), context);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ORDER_STATE_CONFLICT");
  });

  it("metadata lời khai đi vào reference, KHÔNG có số tài khoản/ảnh", async () => {
    await POST(request({ amount: 224000, reference: "CK NT-1" }), context);
    const { reference } = mocks.transition.mock.calls[0][0];
    expect(reference).toMatchObject({
      claimed_amount: 224000,
      claimed_reference: "CK NT-1",
      source: "customer_claim",
    });
  });
});

describe("POST payment-claim — AC08 ownership + CSRF", () => {
  it("đơn của người khác -> 404 và KHÔNG gọi transition", async () => {
    mocks.getOwnedOrderDetail.mockRejectedValue(new NotFoundError("Đơn hàng"));
    const res = await POST(request(), context);
    expect(res.status).toBe(404);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("Origin lạ -> 403, không xác thực và không gọi transition", async () => {
    const res = await POST(request({}, "https://evil.example"), context);
    expect(res.status).toBe(403);
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("thiếu Origin -> 403", async () => {
    const res = await POST(request({}, null), context);
    expect(res.status).toBe(403);
  });

  it("field lạ trong body -> 400 (schema strict, không cho nhét paid/userId)", async () => {
    const res = await POST(request({ paid: true }), context);
    expect(res.status).toBe(400);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
