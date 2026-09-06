import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Redis from "ioredis";
import {
  CheckoutProtectionUnavailableError,
  CheckoutRateLimitedError,
  enforceCheckoutRateLimit,
} from "@/src/middlewares/checkout-rate-limit.middleware";

/**
 * Limiter checkout trên REDIS THẬT (AC02).
 *
 * Test đơn vị dùng Redis giả chỉ chứng minh nhánh code; nó KHÔNG chứng minh
 * script Lua chạy được trên Redis, INCR+PEXPIRE thực sự nằm trong một lệnh, hay
 * TTL thật sự được đặt. Đó là lý do file này tồn tại.
 *
 * Bắt buộc `TEST_REDIS_URL` — một Redis DÙNG RIÊNG CHO TEST. Thiếu biến này
 * thì toàn bộ suite tự skip (không fail) để máy không có Redis vẫn xanh, đúng
 * cách `checkout-protection.db.test.ts` xử lý `TEST_DATABASE_URL`.
 *
 * Chạy:
 *   docker run -d --name nutein-rfc3-redis -p 56379:6379 redis:7-alpine
 *   TEST_REDIS_URL=redis://localhost:56379 npm run test:integration
 */
const REDIS_URL = process.env.TEST_REDIS_URL;
const describeIfRedis = REDIS_URL ? describe : describe.skip;

/** Prefix riêng theo run để không đụng dữ liệu khác trên cùng instance. */
const RUN_ID = `rfc3-${Date.now()}`;

/**
 * Khẳng định promise BỊ TỪ CHỐI và trả về error đã được thu hẹp kiểu.
 * `.catch(e => e as X)` không dùng được: kiểu kết quả thành union với giá trị
 * resolve, nên `.retryAfterSeconds` không tồn tại khi type-check.
 */
async function expectRateLimited(
  promise: Promise<unknown>,
): Promise<CheckoutRateLimitedError> {
  let captured: unknown;
  let rejected = false;
  try {
    await promise;
  } catch (error) {
    rejected = true;
    captured = error;
  }
  if (!rejected) {
    throw new Error("Kỳ vọng bị rate-limit nhưng request đã được cho qua");
  }
  return captured as CheckoutRateLimitedError;
}

describeIfRedis("checkout limiter trên Redis thật — AC02", () => {
  let client: Redis;

  beforeAll(async () => {
    client = new Redis(REDIS_URL as string, { maxRetriesPerRequest: 2 });
    await client.ping();
  });

  afterAll(async () => {
    // Chỉ xoá key của chính run này — KHÔNG FLUSHALL.
    const keys = await client.keys(`checkout:rl:*:${RUN_ID}*`);
    if (keys.length > 0) await client.del(...keys);
    await client.quit();
  });

  let counter = 0;
  let identifier = "";
  beforeEach(() => {
    counter += 1;
    identifier = `${RUN_ID}-${counter}`;
  });

  function config(
    overrides: Partial<Parameters<typeof enforceCheckoutRateLimit>[0]> = {},
  ) {
    return {
      scope: "account" as const,
      identifier,
      max: 3,
      windowSeconds: 60,
      enforce: true,
      client,
      ...overrides,
    };
  }

  it("cho qua đúng max request rồi 429", async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(enforceCheckoutRateLimit(config())).resolves.toBe(i + 1);
    }
    const error = await enforceCheckoutRateLimit(config()).catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutRateLimitedError);
    expect(error.statusCode).toBe(429);
  });

  it("TTL được đặt NGAY ở request đầu — key không bao giờ sống vĩnh viễn", async () => {
    await enforceCheckoutRateLimit(config());
    const ttl = await client.pttl(`checkout:rl:account:${identifier}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  it("cửa sổ CỐ ĐỊNH: request bị chặn KHÔNG gia hạn TTL (không thành cấm vĩnh viễn)", async () => {
    await enforceCheckoutRateLimit(config({ max: 1 }));
    const key = `checkout:rl:account:${identifier}`;
    const first = await client.pttl(key);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await enforceCheckoutRateLimit(config({ max: 1 })).catch(() => undefined);
    const second = await client.pttl(key);

    expect(second).toBeLessThan(first);
  });

  it("Retry-After là số giây THẬT còn lại, giảm dần theo thời gian", async () => {
    await enforceCheckoutRateLimit(config({ max: 1, windowSeconds: 5 }));
    const a = await expectRateLimited(
      enforceCheckoutRateLimit(config({ max: 1, windowSeconds: 5 })),
    );
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const b = await expectRateLimited(
      enforceCheckoutRateLimit(config({ max: 1, windowSeconds: 5 })),
    );

    expect(a.retryAfterSeconds).toBeGreaterThan(0);
    expect(a.retryAfterSeconds).toBeLessThanOrEqual(5);
    expect(b.retryAfterSeconds).toBeLessThan(a.retryAfterSeconds);
  });

  it("hết cửa sổ -> bucket reset, khách không bị khoá mãi", async () => {
    await enforceCheckoutRateLimit(config({ max: 1, windowSeconds: 1 }));
    await expect(
      enforceCheckoutRateLimit(config({ max: 1, windowSeconds: 1 })),
    ).rejects.toBeInstanceOf(CheckoutRateLimitedError);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    await expect(
      enforceCheckoutRateLimit(config({ max: 1, windowSeconds: 1 })),
    ).resolves.toBe(1);
  });

  it("50 request song song đếm ĐÚNG 50 — INCR+PEXPIRE atomic, không mất hit", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        enforceCheckoutRateLimit(config({ max: 1000 })),
      ),
    );
    expect(new Set(results).size).toBe(50);
    expect(Math.max(...(results as number[]))).toBe(50);
  });

  it("account và ip là hai bucket độc lập trên Redis thật", async () => {
    await enforceCheckoutRateLimit(config({ max: 1 }));
    await expect(
      enforceCheckoutRateLimit(config({ scope: "ip", max: 1 })),
    ).resolves.toBe(1);
  });

  it("Redis không kết nối được -> 503 fail-CLOSED, không cho qua", async () => {
    const dead = new Redis("redis://127.0.0.1:1", {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });
    dead.on("error", () => undefined);

    const error = await enforceCheckoutRateLimit(
      config({ client: dead }),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutProtectionUnavailableError);
    expect(error.statusCode).toBe(503);
    dead.disconnect();
  });
});
