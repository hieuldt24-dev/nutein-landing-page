// @vitest-environment node
// route.ts kéo theo các module có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createOrder: vi.fn(),
  redisEval: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
  requireRole: vi.fn(),
}));

vi.mock("@/features/checkout/services/checkout.service", () => ({
  checkoutService: { createOrder: mocks.createOrder },
}));

// Redis giả cấp module: route KHÔNG được tiêm client, nó dùng client dùng chung.
vi.mock("@/src/cache/redis", () => ({
  redis: { eval: (...args: unknown[]) => mocks.redisEval(...args) },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const VALID_BODY = {
  buyer: {
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    email: "a@example.com",
  },
  address: {
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "00001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
  },
  shippingMethod: "standard",
  paymentMethod: "bank_transfer",
  lines: [{ variantId: "1-box", quantity: 1 }],
};

const ORIGIN = "https://nutein.test";

function checkoutRequest(options?: {
  origin?: string | null;
  idempotencyKey?: string;
  body?: unknown;
  forwardedFor?: string;
}): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  const origin = options?.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers.set("origin", origin);
  if (options?.idempotencyKey)
    headers.set("idempotency-key", options.idempotencyKey);
  if (options?.forwardedFor)
    headers.set("x-forwarded-for", options.forwardedFor);

  return new NextRequest(`${ORIGIN}/api/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify(options?.body ?? VALID_BODY),
  });
}

const ENV_KEYS = [
  "CHECKOUT_PROTECTION_ENFORCED",
  "APP_BASE_URL",
  "TRUSTED_CLIENT_IP_HEADER",
  "CLIENT_IP_HASH_SECRET",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.APP_BASE_URL = ORIGIN;
  mocks.authenticate.mockResolvedValue({
    userId: "user-1",
    email: "a@example.com",
    role: "USER",
  });
  mocks.createOrder.mockResolvedValue({
    orderId: "order-1",
    orderCode: "NT-1",
    replayed: false,
  });
  // Mặc định: dưới hạn mức.
  mocks.redisEval.mockResolvedValue([1, 600_000]);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("POST /api/checkout — E3 cửa sổ tương thích Idempotency-Key", () => {
  it("THIẾU header -> vẫn 201, KHÔNG 400/409 (chưa enforce)", async () => {
    const res = await POST(checkoutRequest());
    expect(res.status).toBe(201);
    // Service nhận `undefined` và tự ghi log cảnh báo.
    expect(mocks.createOrder).toHaveBeenCalledWith(
      "user-1",
      expect.anything(),
      undefined,
    );
  });

  it("thiếu header vẫn không enforce KỂ CẢ khi enforcement đã bật", async () => {
    process.env.CHECKOUT_PROTECTION_ENFORCED = "true";
    const res = await POST(checkoutRequest());
    expect(res.status).toBe(201);
  });

  it("có header hợp lệ -> chuyển nguyên vẹn xuống service", async () => {
    const key = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    await POST(checkoutRequest({ idempotencyKey: key }));
    expect(mocks.createOrder).toHaveBeenCalledWith(
      "user-1",
      expect.anything(),
      key,
    );
  });

  it("header CÓ nhưng sai định dạng -> 400 (bug client, không phải client cũ)", async () => {
    const res = await POST(checkoutRequest({ idempotencyKey: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("replay -> 200 chứ không 201 (không có gì được tạo)", async () => {
    mocks.createOrder.mockResolvedValue({ orderId: "order-1", replayed: true });
    const res = await POST(
      checkoutRequest({
        idempotencyKey: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/checkout — AC08 CSRF Origin allowlist", () => {
  beforeEach(() => {
    process.env.CHECKOUT_PROTECTION_ENFORCED = "true";
  });

  it("Origin lạ -> 403 CSRF_ORIGIN_REJECTED, service KHÔNG được gọi", async () => {
    const res = await POST(checkoutRequest({ origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("CSRF_ORIGIN_REJECTED");
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("THIẾU Origin -> cũng bị từ chối (mutation từ browser luôn có Origin)", async () => {
    const res = await POST(checkoutRequest({ origin: null }));
    expect(res.status).toBe(403);
  });

  it("Origin trùng khớp CHÍNH XÁC APP_BASE_URL -> đi tiếp", async () => {
    const res = await POST(checkoutRequest());
    expect(res.status).toBe(201);
  });

  it("subdomain của origin hợp lệ KHÔNG được suy diễn là hợp lệ", async () => {
    const res = await POST(
      checkoutRequest({ origin: "https://evil.nutein.test" }),
    );
    expect(res.status).toBe(403);
  });

  it("enforcement TẮT -> Origin lạ chỉ cảnh báo, không chặn (E2)", async () => {
    delete process.env.CHECKOUT_PROTECTION_ENFORCED;
    const res = await POST(checkoutRequest({ origin: "https://evil.example" }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/checkout — AC02 throttle + Retry-After", () => {
  beforeEach(() => {
    process.env.CHECKOUT_PROTECTION_ENFORCED = "true";
  });

  it("vượt hạn mức account -> 429 kèm header Retry-After là số giây thật", async () => {
    mocks.redisEval.mockResolvedValue([999, 42_000]);
    const res = await POST(checkoutRequest());
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("CHECKOUT_RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("Redis chết -> 503 CHECKOUT_PROTECTION_UNAVAILABLE, KHÔNG tạo đơn", async () => {
    mocks.redisEval.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await POST(checkoutRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe(
      "CHECKOUT_PROTECTION_UNAVAILABLE",
    );
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("bucket IP chỉ được dùng khi header IP đã được khai là do ingress ghi đè", async () => {
    process.env.CLIENT_IP_HASH_SECRET = "secret";
    await POST(checkoutRequest({ forwardedFor: "203.0.113.7" }));
    const keys = mocks.redisEval.mock.calls.map((call) => String(call[2]));
    // Chưa cấu hình TRUSTED_CLIENT_IP_HEADER -> bucket IP vẫn được ĐO...
    expect(keys.some((key) => key.startsWith("checkout:rl:ip:"))).toBe(true);
    expect(keys).toContain("checkout:rl:account:user-1");
    // ...và không bao giờ chứa IP thô.
    expect(keys.join("|")).not.toContain("203.0.113.7");
  });

  it("throttle IP chạy TRƯỚC authenticate (chặn flood trước khi verify JWT)", async () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
    process.env.CLIENT_IP_HASH_SECRET = "secret";
    mocks.redisEval.mockResolvedValue([999, 10_000]);
    const res = await POST(checkoutRequest({ forwardedFor: "203.0.113.7" }));
    expect(res.status).toBe(429);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — giới hạn body", () => {
  it("content-length vượt 32 KiB -> 400, không đọc body", async () => {
    const req = checkoutRequest();
    req.headers.set("content-length", String(64 * 1024));
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});
