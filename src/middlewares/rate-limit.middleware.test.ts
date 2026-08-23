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

import { authLimiter, rateLimiter } from "./rate-limit.middleware";

function request(ip = "1.2.3.4", method = "POST") {
  return new NextRequest("http://localhost:3000/api/auth/session", {
    method,
    headers: { "x-forwarded-for": ip },
  });
}

describe("authLimiter — F4 (AC11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.expire.mockResolvedValue(1);
  });

  it("cho qua 20 lần đầu, chặn lần thứ 21 với code riêng", async () => {
    mocks.incr.mockResolvedValueOnce(20);
    const passed = await authLimiter(request());
    expect(passed).toBeNull();

    mocks.incr.mockResolvedValueOnce(21);
    const blocked = await authLimiter(request());

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    const body = await blocked!.json();
    expect(body.error.code).toBe("TOO_MANY_LOGIN_ATTEMPTS");
  });

  it("dùng key Redis riêng theo code + IP", async () => {
    mocks.incr.mockResolvedValue(1);
    await authLimiter(request("9.9.9.9"));

    expect(mocks.incr).toHaveBeenCalledWith("ratelimit:TOO_MANY_LOGIN_ATTEMPTS:9.9.9.9");
  });

  it("request OPTIONS (preflight) không bị tính vào ngưỡng", async () => {
    const result = await authLimiter(request("1.2.3.4", "OPTIONS"));

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
