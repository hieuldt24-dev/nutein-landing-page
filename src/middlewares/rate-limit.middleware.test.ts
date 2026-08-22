// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * F4/F5 — file test đầu tiên cho rate-limit middleware.
 * Mock `@/src/cache/redis` ở biên module (đúng convention mock Supabase client
 * của các test repository, xem process/context/tests/all-tests.md).
 */
const mocks = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("@/src/cache/redis", () => ({
  redis: { incr: mocks.incr, expire: mocks.expire },
}));

import { emailStatusLimiter, authLimiter, rateLimiter } from "./rate-limit.middleware";

function request(ip = "1.2.3.4", method = "POST") {
  return new NextRequest("http://localhost:3000/api/auth/email-status", {
    method,
    headers: { "x-forwarded-for": ip },
  });
}

describe("emailStatusLimiter — F5 (AC12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.expire.mockResolvedValue(1);
  });

  it("ngưỡng chặt hơn authLimiter: cho qua 5 lần đầu, chặn lần thứ 6 với code riêng", async () => {
    for (let hits = 1; hits <= 5; hits++) {
      mocks.incr.mockResolvedValueOnce(hits);
      const passed = await emailStatusLimiter(request());
      expect(passed).toBeNull();
    }

    mocks.incr.mockResolvedValueOnce(6);
    const blocked = await emailStatusLimiter(request());

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    const body = await blocked!.json();
    expect(body.error.code).toBe("TOO_MANY_EMAIL_CHECKS");
  });

  it("ngưỡng thực sự chặt hơn authLimiter (max 20): ở hit thứ 6 email-status chặn nhưng authLimiter vẫn cho qua", async () => {
    mocks.incr.mockResolvedValueOnce(6);
    const emailBlocked = await emailStatusLimiter(request());

    mocks.incr.mockResolvedValueOnce(6);
    const authPassed = await authLimiter(request());

    expect(emailBlocked).not.toBeNull();
    expect(authPassed).toBeNull();
  });

  it("dùng key Redis riêng theo code, tách biệt khỏi limiter auth chung", async () => {
    mocks.incr.mockResolvedValue(1);
    await emailStatusLimiter(request("9.9.9.9"));

    expect(mocks.incr).toHaveBeenCalledWith("ratelimit:TOO_MANY_EMAIL_CHECKS:9.9.9.9");
  });

  it("request OPTIONS (preflight) không bị tính vào ngưỡng", async () => {
    const result = await emailStatusLimiter(request("1.2.3.4", "OPTIONS"));

    expect(result).toBeNull();
    expect(mocks.incr).not.toHaveBeenCalled();
  });
});

describe("rateLimiter fail-open — F4 (AC11)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Redis lỗi giữa request -> fail-open, cho request đi tiếp (không outage)", async () => {
    mocks.incr.mockRejectedValue(new Error("redis connection lost"));

    const result = await rateLimiter(request(), {
      windowMs: 1000,
      max: 1,
      code: "TEST",
      message: "too many",
    });

    expect(result).toBeNull();
  });

  it("Redis không được cấu hình (redis = null) -> fail-open, không throw", async () => {
    vi.resetModules();
    vi.doMock("@/src/cache/redis", () => ({ redis: null }));

    const mod = await import("./rate-limit.middleware");

    await expect(mod.emailStatusLimiter(request())).resolves.toBeNull();
    await expect(mod.authLimiter(request())).resolves.toBeNull();
    await expect(mod.sessionLimiter(request())).resolves.toBeNull();
    await expect(mod.globalLimiter(request())).resolves.toBeNull();
    await expect(
      mod.rateLimiter(request(), { windowMs: 1000, max: 1, code: "TEST", message: "too many" }),
    ).resolves.toBeNull();

    vi.doUnmock("@/src/cache/redis");
    vi.resetModules();
  });
});
