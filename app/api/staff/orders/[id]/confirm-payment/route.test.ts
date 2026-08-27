// @vitest-environment node
// route.ts -> admin-orders.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  requireRole: vi.fn(),
  confirmPayment: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
  requireRole: mocks.requireRole,
}));

vi.mock("@/features/admin-orders/services/admin-orders.repository", () => ({
  adminOrdersRepository: { confirmPayment: mocks.confirmPayment },
}));

import { NextRequest } from "next/server";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/src/errors/app.error";
import { POST } from "./route";

const ORDER_ID = "11111111-1111-1111-1111-111111111111";

function request() {
  return new NextRequest(
    `http://localhost:3000/api/staff/orders/${ORDER_ID}/confirm-payment`,
    { method: "POST" },
  );
}

function call() {
  return POST(request(), { params: Promise.resolve({ id: ORDER_ID }) });
}

describe("POST /api/staff/orders/[id]/confirm-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({ userId: "staff-1", role: "STAFF" });
    mocks.requireRole.mockReturnValue(undefined);
  });

  it("STAFF + đơn BANK_TRANSFER UNPAID -> 200, payment status thành paid", async () => {
    mocks.confirmPayment.mockResolvedValue({
      id: ORDER_ID,
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "paid",
    });

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.paymentStatus).toBe("paid");
    expect(mocks.confirmPayment).toHaveBeenCalledWith(ORDER_ID, "staff-1");
  });

  it("không phải STAFF -> 403, không đụng repository", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new ForbiddenError("Không đủ quyền");
    });

    const response = await call();

    expect(response.status).toBe(403);
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it("đơn COD -> 400", async () => {
    mocks.confirmPayment.mockRejectedValue(
      new BadRequestError("Chỉ xác nhận được đơn chuyển khoản ngân hàng."),
    );

    const response = await call();
    expect(response.status).toBe(400);
  });

  it("đơn đã PAID -> 400", async () => {
    mocks.confirmPayment.mockRejectedValue(
      new BadRequestError("Đơn hàng đã được xác nhận thanh toán."),
    );

    const response = await call();
    expect(response.status).toBe(400);
  });

  it("đơn không tồn tại -> 404", async () => {
    mocks.confirmPayment.mockRejectedValue(new NotFoundError("Đơn hàng"));

    const response = await call();
    expect(response.status).toBe(404);
  });
});
