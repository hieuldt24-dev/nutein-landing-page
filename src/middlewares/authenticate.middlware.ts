import { NextRequest } from "next/server";
import { AppError } from "@/src/errors/app.error";
import { jwtService } from "@/features/auth/services/jwt.service";
import { ACCESS_TOKEN_COOKIE } from "@/features/auth/constants";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: "USER" | "STAFF" | "ADMIN";
}

/**
 * Xác thực request vào app/api/** bằng JWT access token riêng của app (cookie
 * httpOnly, cấp ở app/api/auth/session) — KHÔNG gọi Supabase mỗi request.
 * Access token hết hạn -> trả 401 code "TOKEN_EXPIRED", client tự gọi
 * app/api/auth/refresh rồi retry (xem lib/swr-fetcher.ts).
 */
export const authenticate = async (req: NextRequest): Promise<AuthenticatedUser> => {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    throw new AppError("Chưa đăng nhập", 401, "NO_TOKEN");
  }

  try {
    const payload = jwtService.verifyAccessToken(token);
    return { userId: payload.sub, email: payload.email, role: payload.role };
  } catch (error) {
    const code =
      error instanceof Error && error.name === "TokenExpiredError"
        ? "TOKEN_EXPIRED"
        : "INVALID_TOKEN";
    throw new AppError("Token không hợp lệ hoặc đã hết hạn", 401, code);
  }
};

export const requireRole = (user: AuthenticatedUser, ...roles: AuthenticatedUser["role"][]) => {
  if (!roles.includes(user.role)) {
    throw new AppError("Không đủ quyền truy cập", 403, "FORBIDDEN");
  }
};
