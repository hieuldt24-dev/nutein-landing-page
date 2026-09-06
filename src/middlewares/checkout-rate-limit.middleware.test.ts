// @vitest-environment node
// checkout-rate-limit.middleware.ts có `import "server-only"`, chặn ở jsdom.
import { describe, it, expect, vi } from "vitest";

vi.mock("@/src/cache/redis", () => ({ redis: null }));

import {
  CheckoutProtectionUnavailableError,
  CheckoutRateLimitedError,
  enforceCheckoutRateLimit,
  type RedisLike,
} from "./checkout-rate-limit.middleware";

/** Redis giả chạy đúng ngữ nghĩa của script: INCR + PEXPIRE ở hit đầu + PTTL. */
function fakeRedis(): RedisLike & { calls: number; store: Map<string, { hits: number; expiresAt: number }> } {
  const store = new Map<string, { hits: number; expiresAt: number }>();
  let calls = 0;
  const client = {
    get calls() {
      return calls;
    },
    store,
    async eval(_script: string, _numKeys: number, ...args: (string | number)[]) {
      calls += 1;
      const key = String(args[0]);
      const windowMs = Number(args[1]);
      const now = Date.now();
      const current = store.get(key);
      if (!current || current.expiresAt <= now) {
        store.set(key, { hits: 1, expiresAt: now + windowMs });
        return [1, windowMs];
      }
      current.hits += 1;
      return [current.hits, current.expiresAt - now];
    },
  };
  return client as RedisLike & {
    calls: number;
    store: Map<string, { hits: number; expiresAt: number }>;
  };
}

const base = {
  scope: "account" as const,
  identifier: "user-1",
  max: 3,
  windowSeconds: 600,
  enforce: true,
};

describe("enforceCheckoutRateLimit — AC02 fail-CLOSED", () => {
  it("Redis không cấu hình + enforcement BẬT -> 503 CHECKOUT_PROTECTION_UNAVAILABLE", async () => {
    const error = await enforceCheckoutRateLimit({ ...base, client: null }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(CheckoutProtectionUnavailableError);
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("CHECKOUT_PROTECTION_UNAVAILABLE");
  });

  it("Redis ném lỗi (outage) + enforcement BẬT -> 503, KHÔNG fail-open", async () => {
    const broken: RedisLike = {
      eval: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    const error = await enforceCheckoutRateLimit({ ...base, client: broken }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(CheckoutProtectionUnavailableError);
    expect(error.statusCode).toBe(503);
  });

  it("Redis trả reply lạ -> vẫn 503, không suy diễn là 'chưa vượt hạn mức'", async () => {
    const weird: RedisLike = { eval: async () => "OK" };
    const error = await enforceCheckoutRateLimit({ ...base, client: weird }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(CheckoutProtectionUnavailableError);
  });

  it("enforcement TẮT + Redis chết -> KHÔNG chặn (E2: chưa bật cho khách thật)", async () => {
    await expect(
      enforceCheckoutRateLimit({ ...base, enforce: false, client: null }),
    ).resolves.toBeNull();
  });
});

describe("enforceCheckoutRateLimit — AC02 hạn mức + Retry-After thật", () => {
  it("cho qua đúng `max` request rồi mới 429", async () => {
    const client = fakeRedis();
    for (let i = 0; i < 3; i += 1) {
      await expect(
        enforceCheckoutRateLimit({ ...base, client }),
      ).resolves.toBe(i + 1);
    }
    const error = await enforceCheckoutRateLimit({ ...base, client }).catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutRateLimitedError);
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("CHECKOUT_RATE_LIMITED");
  });

  it("Retry-After là giây THẬT còn lại của bucket, không phải hằng số ghi cứng", async () => {
    const client = fakeRedis();
    const shortWindow = { ...base, windowSeconds: 30, max: 1, client };
    await enforceCheckoutRateLimit(shortWindow);

    // Bucket đã tồn tại được ~1/3 cửa sổ -> Retry-After phải NHỎ HƠN cửa sổ đầy.
    const entry = client.store.get("checkout:rl:account:user-1")!;
    entry.expiresAt = Date.now() + 11_000;

    const error = await enforceCheckoutRateLimit(shortWindow).catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutRateLimitedError);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(11);
    expect(error.retryAfterSeconds).not.toBe(shortWindow.windowSeconds);
    expect(error.details).toMatchObject({ retryAfterSeconds: error.retryAfterSeconds });
  });

  it("account và ip là hai bucket ĐỘC LẬP", async () => {
    const client = fakeRedis();
    await enforceCheckoutRateLimit({ ...base, max: 1, client });
    // Cùng identifier nhưng scope khác -> key khác -> không bị tính chung.
    await expect(
      enforceCheckoutRateLimit({ ...base, scope: "ip", max: 1, client }),
    ).resolves.toBe(1);
    expect([...client.store.keys()]).toEqual([
      "checkout:rl:account:user-1",
      "checkout:rl:ip:user-1",
    ]);
  });

  it("một lần eval duy nhất cho mỗi request (INCR+TTL atomic, không hai round-trip)", async () => {
    const client = fakeRedis();
    await enforceCheckoutRateLimit({ ...base, client });
    await enforceCheckoutRateLimit({ ...base, client });
    expect(client.calls).toBe(2);
  });

  it("enforcement TẮT + vượt hạn mức -> vẫn cho qua, chỉ ghi nhận", async () => {
    const client = fakeRedis();
    const cfg = { ...base, max: 1, enforce: false, client };
    await enforceCheckoutRateLimit(cfg);
    await expect(enforceCheckoutRateLimit(cfg)).resolves.toBe(2);
  });
});
