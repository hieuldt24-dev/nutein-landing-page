import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/src/cache/redis";
import { logger } from "@/src/logging/logger";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  code: string;
  message: string;
}

export const rateLimiter = async (
  req: NextRequest,
  config: RateLimitConfig,
): Promise<NextResponse | null> => {
  if (req.method === "OPTIONS") {
    return null;
  }

  if (!redis) {
    return null;
  }

  try {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip =
      (req as { ip?: string }).ip ||
      req.headers.get("x-real-ip") ||
      (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
      "127.0.0.1";
    const key = `ratelimit:${config.code}:${ip}`;

    const hits = await redis.incr(key);

    if (hits === 1) {
      await redis.expire(key, Math.ceil(config.windowMs / 1000));
    }

    if (hits > config.max) {
      return NextResponse.json(
        {
          success: false,
          message: config.message,
          error: {
            code: config.code,
          },
        },
        { status: 429 },
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Rate limiting error");
    // Fail-open: if Redis fails, allow the request to pass
  }

  return null;
};

export const globalLimiter = async (req: NextRequest) => {
  return rateLimiter(req, {
    windowMs: 15 * 60 * 1000,
    max: 1000,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests, please try again later",
  });
};

export const authLimiter = async (req: NextRequest) => {
  return rateLimiter(req, {
    windowMs: 15 * 60 * 1000,
    max: 20,
    code: "TOO_MANY_LOGIN_ATTEMPTS",
    message: "Too many login attempts, please try again after 15 minutes",
  });
};

export const sessionLimiter = async (req: NextRequest) => {
  return rateLimiter(req, {
    windowMs: 15 * 60 * 1000,
    max: 200,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests, please try again after 15 minutes",
  });
};

/**
 * `POST /api/checkout/coupon/validate` nhận mã tuỳ ý và trả tín hiệu hợp lệ /
 * không hợp lệ — về bản chất là oracle dò mã giảm giá nếu không giới hạn.
 * Không được dùng `globalLimiter`
 * (1000/15 phút — quá lỏng cho bề mặt này). 20 lần / 15 phút / IP: thoải mái
 * cho khách thật (gõ vài mã trong 1 lượt checkout) nhưng vô dụng để quét mã.
 */
export const couponPreviewLimiter = async (req: NextRequest) => {
  return rateLimiter(req, {
    windowMs: 15 * 60 * 1000,
    max: 20,
    code: "TOO_MANY_COUPON_CHECKS",
    message: "Bạn đã thử quá nhiều mã giảm giá, vui lòng thử lại sau 15 phút",
  });
};

export function withAuthRateLimit(
  handler: (request: NextRequest) => Promise<Response>,
  responseType: "redirect" | "json" = "redirect",
  limiter: (req: NextRequest) => Promise<NextResponse | null> = authLimiter,
) {
  return async (request: NextRequest) => {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) {
      if (responseType === "redirect") {
        const baseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
        return NextResponse.redirect(new URL("/login?error=too_many_requests", baseUrl));
      } else {
        return rateLimitResponse;
      }
    }
    return handler(request);
  };
}
