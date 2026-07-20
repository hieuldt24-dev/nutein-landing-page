import "server-only";
import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

/** Payload nhúng trong access/refresh token — đủ để authenticate middleware xác thực mà không cần gọi lại Supabase. */
export interface JwtPayload {
  sub: string; // user id (khớp auth.users.id / public.users.id)
  email: string;
  role: "USER" | "STAFF" | "ADMIN";
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const EXPIRE_ACCESS_TOKEN = (process.env.EXPIRE_ACCESS_TOKEN ||
  "15m") as SignOptions["expiresIn"];
const EXPIRE_REFRESH_TOKEN = (process.env.EXPIRE_REFRESH_TOKEN ||
  "7d") as SignOptions["expiresIn"];

function requireSecret(secret: string | undefined, name: string): string {
  if (!secret) {
    throw new Error(`Thiếu biến môi trường ${name} — kiểm tra lại file .env`);
  }
  return secret;
}

const EXPIRY_UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** "15m" | "7d" | ... -> số giây, dùng cho maxAge cookie (khớp thời hạn JWT). */
export function expiryToSeconds(expiry: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(expiry.trim());
  if (!match) return fallbackSeconds;
  const [, amount, unit] = match;
  return Number(amount) * EXPIRY_UNIT_SECONDS[unit];
}

/** maxAge (giây) cho cookie — khớp đúng thời hạn ký trong JWT ở trên. */
export const ACCESS_TOKEN_MAX_AGE = expiryToSeconds(String(EXPIRE_ACCESS_TOKEN), 15 * 60);
export const REFRESH_TOKEN_MAX_AGE = expiryToSeconds(String(EXPIRE_REFRESH_TOKEN), 7 * 86400);

/**
 * Ký/verify JWT access + refresh token riêng của app, dùng để bảo vệ
 * app/api/** mà không phải gọi Supabase mỗi request. Supabase Auth vẫn là
 * nơi xác thực email/password thật (xem features/auth/services/auth.repository.ts)
 * — cặp token này chỉ cấp SAU KHI Supabase xác thực thành công (app/api/auth/session).
 */
export const jwtService = {
  signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, requireSecret(ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET"), {
      expiresIn: EXPIRE_ACCESS_TOKEN,
    });
  },

  // `remember` mặc định true để không đổi hành vi các chỗ gọi cũ (signUp,
  // AuthProvider restore session) — chỉ login bấm bỏ "Ghi nhớ đăng nhập" mới
  // truyền false. Nhúng vào payload để /api/auth/refresh biết mà giữ nguyên
  // ý định này khi rotate (không "nâng cấp" 1 phiên session-only thành
  // persistent chỉ vì trình duyệt còn mở qua lần refresh access token kế tiếp).
  signRefreshToken(payload: JwtPayload, remember: boolean = true): string {
    // jwtid ngẫu nhiên — refresh_tokens.token_hash có UNIQUE constraint, và
    // JWT ký cùng payload trong cùng giây (iat trùng) sẽ ra CHUỖI GIỐNG HỆT
    // nhau (HMAC deterministic) nếu không có jti, gây đụng UNIQUE khi rotate.
    return jwt.sign(
      { ...payload, remember },
      requireSecret(REFRESH_TOKEN_SECRET, "REFRESH_TOKEN_SECRET"),
      { expiresIn: EXPIRE_REFRESH_TOKEN, jwtid: randomUUID() }
    );
  },

  /** Throw jwt.JsonWebTokenError/TokenExpiredError nếu token sai hoặc hết hạn — caller tự bắt. */
  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(
      token,
      requireSecret(ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET")
    ) as JwtPayload;
  },

  verifyRefreshToken(token: string): JwtPayload & { remember: boolean } {
    return jwt.verify(token, requireSecret(REFRESH_TOKEN_SECRET, "REFRESH_TOKEN_SECRET")) as JwtPayload & {
      remember: boolean;
    };
  },
};
