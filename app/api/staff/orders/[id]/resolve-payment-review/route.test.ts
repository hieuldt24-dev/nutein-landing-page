// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  requireRole: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
  requireRole: mocks.requireRole,
}));

vi.mock("@/features/checkout/services/order.repository", () => ({
  orderRepository: { transition: mocks.transition },
}));

import { NextRequest } from "next/server";
import { AppError, ConflictError } from "@/src/errors/app.error";
import { POST } from "./route";

const ORIGIN = "https://nutein.test";
const context = { params: Promise.resolve({ id: "order-1" }) };

function request(body: unknown, origin: string | null = ORIGIN) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest(
    `${ORIGIN}/api/staff/orders/order-1/resolve-payment-review`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
}

const VALID = {
  outcome: "no-transfer",
  reason: "Đã kiểm sao kê 06/09, không có giao dịch khớp",
  expectedVersion: 3,
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  savedEnv.APP_BASE_URL = process.env.APP_BASE_URL;
  savedEnv.CHECKOUT_PROTECTION_ENFORCED =
    process.env.CHECKOUT_PROTECTION_ENFORCED;
  process.env.APP_BASE_URL = ORIGIN;
  process.env.CHECKOUT_PROTECTION_ENFORCED = "true";
  mocks.authenticate.mockResolvedValue({ userId: "staff-1", role: "STAFF" });
  mocks.requireRole.mockReturnValue(undefined);
  mocks.transition.mockResolvedValue({
    orderId: "order-1",
    changed: true,
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    reviewState: "RELEASED",
    stateVersion: 4,
  });
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("POST resolve-payment-review — AC06 outcome mapping", () => {
  it("no-transfer -> resolve_no_transfer (đường DUY NHẤT release tài nguyên)", async () => {
    const res = await POST(request(VALID), context);
    expect(res.status).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "resolve_no_transfer",
        actorType: "STAFF",
        actorId: "staff-1",
        expectedVersion: 3,
      }),
    );
  });

  it("needs-investigation -> mark_review_required, KHÔNG release", async () => {
    await POST(request({ ...VALID, outcome: "needs-investigation" }), context);
    expect(mocks.transition.mock.calls[0][0].action).toBe(
      "mark_review_required",
    );
  });

  it("không nhánh nào đặt PAID — confirm là hành động khác", async () => {
    await POST(request(VALID), context);
    expect(mocks.transition.mock.calls[0][0].action).not.toBe(
      "confirm_payment",
    );
  });

  it("evidence metadata đi vào reference kèm staff đã kiểm", async () => {
    await POST(
      request({
        ...VALID,
        statementCheckedFrom: "2026-09-06T00:00:00.000Z",
        statementCheckedTo: "2026-09-06T12:00:00.000Z",
        reference: "TICKET-77",
      }),
      context,
    );
    expect(mocks.transition.mock.calls[0][0].reference).toMatchObject({
      outcome: "no-transfer",
      checked_by: "staff-1",
      statement_checked_from: "2026-09-06T00:00:00.000Z",
      business_reference: "TICKET-77",
    });
  });
});

describe("POST resolve-payment-review — AC08 quyền + input bounds", () => {
  it("không phải STAFF -> 403, transition không chạy", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new AppError("Không đủ quyền truy cập", 403, "FORBIDDEN");
    });
    const res = await POST(request(VALID), context);
    expect(res.status).toBe(403);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("Origin lạ -> 403 trước cả khi xác thực", async () => {
    const res = await POST(request(VALID, "https://evil.example"), context);
    expect(res.status).toBe(403);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("thiếu expectedVersion -> 400 (bắt buộc chống ghi đè kết luận)", async () => {
    const res = await POST(
      request({ outcome: "no-transfer", reason: "x" }),
      context,
    );
    expect(res.status).toBe(400);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("thiếu reason -> 400 (kết luận phải có lý do để đối soát lại)", async () => {
    const res = await POST(
      request({ outcome: "no-transfer", expectedVersion: 1 }),
      context,
    );
    expect(res.status).toBe(400);
  });

  it("outcome lạ -> 400", async () => {
    const res = await POST(
      request({ ...VALID, outcome: "mark-paid" }),
      context,
    );
    expect(res.status).toBe(400);
  });

  it("expectedVersion lệch (nhân viên khác đã xử lý) -> 409", async () => {
    mocks.transition.mockRejectedValue(
      new ConflictError(
        "Đơn hàng đã thay đổi, vui lòng tải lại",
        "ORDER_STATE_CONFLICT",
      ),
    );
    const res = await POST(request(VALID), context);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ORDER_STATE_CONFLICT");
  });
});
