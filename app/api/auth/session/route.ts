import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { UnauthorizedError } from "@/src/errors/app.error";
import { getClientIp, getUserAgent } from "@/src/api/request-context";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_COOKIE_OPTIONS,
} from "@/features/auth/constants";
import {
  jwtService,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  type JwtPayload,
} from "@/features/auth/services/jwt.service";
import { refreshTokenService } from "@/features/auth/services/refresh-token.service";
import { auditLogService } from "@/features/auth/services/audit-log.service";

/**
 * POST /api/auth/session
 * Gọi ngay sau khi client đăng nhập/đăng ký thành công qua Supabase (session
 * cookie của Supabase đã có). Verify session đó, đọc role từ public.users,
 * rồi cấp cặp JWT access/refresh riêng (httpOnly cookie) để app/api/** xác
 * thực nhanh mà không cần gọi Supabase mỗi request.
 *
 * Body (optional) `{ rememberMe?: boolean }` — quyết định refresh-token
 * cookie có `maxAge` (còn sau khi đóng trình duyệt, 7 ngày) hay là session
 * cookie (mất khi đóng trình duyệt). Mặc định true (không đổi hành vi các
 * chỗ gọi không kèm body — signUp, AuthProvider restore session/OAuth).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { rememberMe?: boolean } | null;
  const remember = body?.rememberMe !== false;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new UnauthorizedError("Chưa đăng nhập hoặc phiên Supabase đã hết hạn");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: (profile?.role as JwtPayload["role"] | undefined) ?? "USER",
  };

  const accessToken = jwtService.signAccessToken(payload);
  const refreshToken = jwtService.signRefreshToken(payload, remember);
  await refreshTokenService.store(
    user.id,
    refreshToken,
    new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000)
  );
  await auditLogService.log(user.id, "LOGIN_SUCCESS", {
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  const response = successResponse({ expiresIn: ACCESS_TOKEN_MAX_AGE });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    // Không set maxAge khi remember=false -> session cookie (mất khi đóng
    // trình duyệt). Bản ghi refresh_tokens trong DB vẫn hết hạn sau 7 ngày
    // như bình thường, đây chỉ là kiểm soát việc trình duyệt giữ cookie bao lâu.
    ...(remember ? { maxAge: REFRESH_TOKEN_MAX_AGE } : {}),
  });

  return response;
});
