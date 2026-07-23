import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { getClientIp, getUserAgent } from "@/src/api/request-context";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_COOKIE_OPTIONS,
} from "@/features/auth/constants";
import { jwtService } from "@/features/auth/services/jwt.service";
import { refreshTokenService } from "@/features/auth/services/refresh-token.service";
import { auditLogService } from "@/features/auth/services/audit-log.service";

/**
 * POST /api/auth/logout
 * Thu hồi refresh token trong DB + xoá JWT cookies. Supabase signOut() gọi
 * riêng phía client.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await refreshTokenService.revoke(refreshToken);
    try {
      // Chữ ký/hạn JWT có thể đã hỏng (cookie cũ, hết hạn tự nhiên) — vẫn
      // cho logout qua bình thường (đã revoke theo hash ở trên rồi), chỉ
      // audit log LOGOUT nếu đọc được user_id từ token.
      const { sub } = jwtService.verifyRefreshToken(refreshToken);
      await auditLogService.log(sub, "LOGOUT", {
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
    } catch {
      // im lặng — xem docstring
    }
  }

  const response = successResponse(null);
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  return response;
});
