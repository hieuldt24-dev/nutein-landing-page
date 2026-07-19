import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { UnauthorizedError } from "@/src/errors/app.error";
import { getClientIp, getUserAgent } from "@/src/api/request-context";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_COOKIE_OPTIONS,
} from "@/features/auth/constants";
import {
  jwtService,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/features/auth/services/jwt.service";
import { refreshTokenService } from "@/features/auth/services/refresh-token.service";
import { auditLogService } from "@/features/auth/services/audit-log.service";

/**
 * POST /api/auth/refresh
 * Đọc refresh token cookie, verify chữ ký + hạn JWT, rồi kiểm tra thêm trong
 * DB (refresh_tokens) xem token đã bị thu hồi chưa (logout ở nơi khác, hoặc
 * đã bị rotate qua 1 lần refresh khác — dấu hiệu token bị đánh cắp dùng lại).
 * Nếu hợp lệ: rotate — thu hồi token cũ, cấp access + refresh token MỚI.
 * Refresh token hết hạn/không hợp lệ/đã bị thu hồi -> 401, client cần đăng
 * nhập lại (xem lib/swr-fetcher.ts — fetcher tự gọi endpoint này khi gặp 401
 * TOKEN_EXPIRED).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    throw new UnauthorizedError("Không tìm thấy refresh token");
  }

  let payload;
  try {
    payload = jwtService.verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Refresh token không hợp lệ hoặc đã hết hạn");
  }

  const isActive = await refreshTokenService.isActive(refreshToken);
  if (!isActive) {
    // Chữ ký + hạn JWT hợp lệ nhưng DB nói đã thu hồi -> gần như chắc chắn
    // là refresh token cũ bị dùng lại sau khi đã rotate (bị đánh cắp), vì
    // JWT hết hạn tự nhiên đã bị chặn ở verifyRefreshToken phía trên rồi.
    await auditLogService.log(payload.sub, "TOKEN_REUSE_DETECTED", {
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    throw new UnauthorizedError("Refresh token đã bị thu hồi hoặc không còn hiệu lực");
  }

  const newPayload = { sub: payload.sub, email: payload.email, role: payload.role };
  const accessToken = jwtService.signAccessToken(newPayload);
  // Giữ nguyên remember của lần login gốc — không "nâng cấp" 1 phiên
  // session-only (rememberMe=false) thành persistent chỉ vì trình duyệt vẫn
  // mở qua lần rotate này (route này chạy tự động mỗi khi access token hết hạn).
  const newRefreshToken = jwtService.signRefreshToken(newPayload, payload.remember);

  await refreshTokenService.rotate(
    payload.sub,
    refreshToken,
    newRefreshToken,
    new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000)
  );
  await auditLogService.log(payload.sub, "TOKEN_REFRESH", {
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  const response = successResponse({ expiresIn: ACCESS_TOKEN_MAX_AGE });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    ...(payload.remember ? { maxAge: REFRESH_TOKEN_MAX_AGE } : {}),
  });

  return response;
});
