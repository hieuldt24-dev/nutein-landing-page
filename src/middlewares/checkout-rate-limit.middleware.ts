import "server-only";

import { redis as defaultRedis } from "@/src/cache/redis";
import { AppError } from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";

/**
 * Limiter RIÊNG cho checkout — cố ý KHÔNG dùng lại
 * `src/middlewares/rate-limit.middleware.ts`.
 *
 * Ba khác biệt bắt buộc (plan §Security — "Redis error/missing"):
 *
 * 1. FAIL-CLOSED. Limiter chung fail-open: Redis chết thì mọi request đi qua.
 *    Với checkout điều đó xoá sạch lớp chống spam đúng lúc cần nhất, nên ở đây
 *    Redis chết/không cấu hình -> 503 `CHECKOUT_PROTECTION_UNAVAILABLE` cho
 *    request TẠO ĐƠN MỚI. Hành vi fail-open của limiter chung KHÔNG bị đổi.
 * 2. INCR + PEXPIRE ATOMIC. Limiter chung gọi `INCR` rồi `EXPIRE` bằng hai
 *    round-trip; nếu process chết giữa hai lệnh, key sống vĩnh viễn và khách bị
 *    khoá mãi mãi. Ở đây một script Lua làm cả hai và trả về TTL thật.
 * 3. `Retry-After` là SỐ GIÂY THẬT của bucket (PTTL làm tròn lên), không phải
 *    hằng số ghi cứng.
 *
 * Bucket theo `userId` (đã xác thực) và theo IP đã HMAC — không bao giờ theo id
 * tuỳ ý do client gửi, để cardinality bị chặn.
 */

/**
 * KEYS[1] = bucket key. ARGV[1] = window (ms).
 * Trả {hits, pttl}. PEXPIRE chỉ chạy ở lần INCR đầu -> cửa sổ cố định, không bị
 * gia hạn vô hạn bởi request bị chặn (nếu không sẽ thành lệnh cấm vĩnh viễn).
 */
const CHECKOUT_LIMIT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end
return { hits, pttl }
`;

export class CheckoutProtectionUnavailableError extends AppError {
  constructor(reason: string) {
    super(
      "Hệ thống chống spam đơn hàng tạm thời không khả dụng, vui lòng thử lại sau ít phút.",
      503,
      "CHECKOUT_PROTECTION_UNAVAILABLE",
      { reason },
    );
    // AppError đặt lại prototype về AppError.prototype trong constructor của
    // nó, nên `instanceof` với lớp con sẽ SAI nếu không sửa lại ở đây.
    Object.setPrototypeOf(this, CheckoutProtectionUnavailableError.prototype);
  }
}

export class CheckoutRateLimitedError extends AppError {
  constructor(
    public readonly retryAfterSeconds: number,
    scope: CheckoutLimitScope,
  ) {
    super(
      "Bạn đã gửi quá nhiều yêu cầu đặt hàng, vui lòng thử lại sau.",
      429,
      "CHECKOUT_RATE_LIMITED",
      { retryAfterSeconds, scope },
    );
    Object.setPrototypeOf(this, CheckoutRateLimitedError.prototype);
  }
}

export type CheckoutLimitScope = "account" | "ip";

export interface CheckoutRateLimitInput {
  scope: CheckoutLimitScope;
  /** userId đã xác thực, hoặc IP ĐÃ HMAC. Không bao giờ là IP thô. */
  identifier: string;
  max: number;
  windowSeconds: number;
  /**
   * `false` -> chỉ đo và log, không chặn và không 503 (execute-instruction E2:
   * cơ chế được chứng minh bằng test, chưa bật cho khách thật).
   */
  enforce: boolean;
  /** Cho test tiêm client giả. Mặc định là client dùng chung của app. */
  client?: RedisLike | null;
}

/** Bề mặt tối thiểu cần từ ioredis — giữ hẹp để test không phải giả cả client. */
export interface RedisLike {
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

function parseScriptResult(
  raw: unknown,
): { hits: number; pttl: number } | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const hits = Number(raw[0]);
  const pttl = Number(raw[1]);
  if (!Number.isFinite(hits) || !Number.isFinite(pttl)) return null;
  return { hits, pttl };
}

/**
 * Ném `CheckoutRateLimitedError` (429) khi vượt hạn mức, hoặc
 * `CheckoutProtectionUnavailableError` (503) khi Redis không dùng được.
 * Trả về số hit hiện tại khi cho qua (dùng cho metrics/log).
 */
export async function enforceCheckoutRateLimit(
  input: CheckoutRateLimitInput,
): Promise<number | null> {
  const client =
    input.client === undefined
      ? (defaultRedis as RedisLike | null)
      : input.client;
  const key = `checkout:rl:${input.scope}:${input.identifier}`;
  const windowMs = input.windowSeconds * 1000;

  if (!client) {
    if (!input.enforce) {
      logger.warn(
        { scope: input.scope, mode: "compat-window" },
        "Không có Redis — checkout limiter bị bỏ qua (enforcement đang tắt)",
      );
      return null;
    }
    throw new CheckoutProtectionUnavailableError("redis-unavailable");
  }

  let parsed: { hits: number; pttl: number } | null = null;
  try {
    parsed = parseScriptResult(
      await client.eval(CHECKOUT_LIMIT_SCRIPT, 1, key, windowMs),
    );
  } catch (error) {
    logger.error(
      { err: error, scope: input.scope },
      "Checkout limiter lỗi Redis",
    );
    if (!input.enforce) return null;
    throw new CheckoutProtectionUnavailableError("redis-error");
  }

  if (!parsed) {
    if (!input.enforce) return null;
    throw new CheckoutProtectionUnavailableError("redis-bad-reply");
  }

  if (parsed.hits > input.max) {
    // `Retry-After` phải là giây THẬT còn lại của bucket. Làm tròn LÊN để
    // không mời client quay lại sớm hơn lúc bucket hết hạn.
    const retryAfterSeconds = Math.max(1, Math.ceil(parsed.pttl / 1000));
    if (!input.enforce) {
      logger.warn(
        {
          scope: input.scope,
          hits: parsed.hits,
          max: input.max,
          mode: "compat-window",
        },
        "Vượt hạn mức checkout — chỉ ghi log vì enforcement đang tắt",
      );
      return parsed.hits;
    }
    throw new CheckoutRateLimitedError(retryAfterSeconds, input.scope);
  }

  return parsed.hits;
}
