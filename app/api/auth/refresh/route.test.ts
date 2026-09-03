// @vitest-environment node
// route.ts -> jwt.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  isActive: vi.fn(),
  rotate: vi.fn(),
  auditLog: vi.fn(),
  revokeAllForUser: vi.fn(),
  authLimiter: vi.fn(),
  maybeSingle: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/features/auth/services/refresh-token.service", () => ({
  refreshTokenService: {
    isActive: mocks.isActive,
    rotate: mocks.rotate,
    revokeAllForUser: mocks.revokeAllForUser,
  },
}));

vi.mock("@/src/middlewares/rate-limit.middleware", () => ({
  authLimiter: mocks.authLimiter,
}));

// Route đọc cờ is_deleted qua service-role client (không có session context).
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}));

vi.mock("@/features/auth/services/audit-log.service", () => ({
  auditLogService: { log: mocks.auditLog },
}));

import { NextRequest, NextResponse } from "next/server";
import { jwtService, type JwtPayload } from "@/features/auth/services/jwt.service";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/constants";
import { POST } from "./route";

const payload: JwtPayload = { sub: "user-1", email: "user@example.com", role: "USER" };

/** Query-builder giả cho `.from("users").select(...).eq(...).maybeSingle()`. */
function setLockedFlag(isDeleted: boolean | null, role: string = "USER") {
  mocks.maybeSingle.mockResolvedValue({
    data: isDeleted === null ? null : { is_deleted: isDeleted, role },
    error: null,
  });
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: mocks.maybeSingle,
  };
  mocks.from.mockReturnValue(builder);
}

function requestWithCookie(cookieHeader: string) {
  return new NextRequest("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: { cookie: cookieHeader },
  });
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isActive.mockResolvedValue(true);
    mocks.authLimiter.mockResolvedValue(null);
    mocks.revokeAllForUser.mockResolvedValue(undefined);
    // Mặc định: user tồn tại và KHÔNG bị khóa.
    setLockedFlag(false);
  });

  it("thiếu refresh token cookie -> 401", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("refresh token không hợp lệ (sai chữ ký) -> 401, không đụng DB", async () => {
    const request = requestWithCookie(`${REFRESH_TOKEN_COOKIE}=not-a-real-jwt`);
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mocks.isActive).not.toHaveBeenCalled();
  });

  it("refresh token hợp lệ + còn active trong DB -> 200, rotate, set cả 2 cookie mới", async () => {
    const refreshToken = jwtService.signRefreshToken(payload);
    const request = requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`);

    const response = await POST(request);
    expect(response.status).toBe(200);

    const newAccessToken = response.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const newRefreshToken = response.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    expect(newAccessToken).toBeTruthy();
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(refreshToken); // đã rotate, không phải token cũ

    expect(jwtService.verifyAccessToken(newAccessToken!)).toMatchObject(payload);
    expect(mocks.rotate).toHaveBeenCalledWith(
      payload.sub,
      refreshToken,
      newRefreshToken,
      expect.any(Date)
    );
    expect(mocks.auditLog).toHaveBeenCalledWith(
      payload.sub,
      "TOKEN_REFRESH",
      expect.objectContaining({ ip: null, userAgent: null })
    );
  });

  it("token hợp lệ về chữ ký nhưng đã bị thu hồi trong DB (đã logout/đã rotate trước đó) -> 401, audit log TOKEN_REUSE_DETECTED", async () => {
    mocks.isActive.mockResolvedValue(false);
    const refreshToken = jwtService.signRefreshToken(payload);
    const request = requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`);

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mocks.rotate).not.toHaveBeenCalled();
    expect(mocks.auditLog).toHaveBeenCalledWith(
      payload.sub,
      "TOKEN_REUSE_DETECTED",
      expect.objectContaining({ ip: null, userAgent: null })
    );
  });

  it("không cấp lại access token từ 1 access token cũ đưa nhầm vào refresh cookie", async () => {
    const accessToken = jwtService.signAccessToken(payload);
    const request = requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${accessToken}`);
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  // F2 / AC4 — tài khoản bị khóa: từ chối VÀ thu hồi toàn bộ token của user.
  it("tài khoản bị khóa (is_deleted=true) -> 403, thu hồi TOÀN BỘ refresh token của user, không rotate", async () => {
    setLockedFlag(true);
    const refreshToken = jwtService.signRefreshToken(payload);

    const response = await POST(requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`));

    expect(response.status).toBe(403);
    expect(mocks.revokeAllForUser).toHaveBeenCalledWith(payload.sub);
    expect(mocks.rotate).not.toHaveBeenCalled();
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)).toBeUndefined();
    expect(response.cookies.get(REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });

  // F2 / AC5 — tài khoản chưa khóa không bị ảnh hưởng.
  it("tài khoản chưa khóa -> vẫn rotate bình thường, không thu hồi hàng loạt", async () => {
    setLockedFlag(false);
    const refreshToken = jwtService.signRefreshToken(payload);

    const response = await POST(requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`));

    expect(response.status).toBe(200);
    expect(mocks.revokeAllForUser).not.toHaveBeenCalled();
    expect(mocks.rotate).toHaveBeenCalled();
  });

  // AC2 + AC3 — token claim STAFF nhưng DB đã hạ xuống USER -> từ chối + thu hồi.
  it("role trong token là hạ quyền so với DB -> 403, thu hồi toàn bộ token, không rotate", async () => {
    setLockedFlag(false, "USER");
    const staffPayload: JwtPayload = { ...payload, role: "STAFF" };
    const refreshToken = jwtService.signRefreshToken(staffPayload);

    const response = await POST(requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`));

    expect(response.status).toBe(403);
    expect(mocks.revokeAllForUser).toHaveBeenCalledWith(payload.sub);
    expect(mocks.rotate).not.toHaveBeenCalled();
    expect(mocks.isActive).not.toHaveBeenCalled();
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)).toBeUndefined();
    expect(response.cookies.get(REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });

  // AC4 — token claim USER nhưng DB đã nâng lên STAFF -> vẫn 200, cấp lại theo role MỚI.
  it("role trong token là nâng quyền so với DB -> 200, cấp lại token với role hiện tại trong DB", async () => {
    setLockedFlag(false, "STAFF");
    const refreshToken = jwtService.signRefreshToken(payload);

    const response = await POST(requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`));

    expect(response.status).toBe(200);
    expect(mocks.revokeAllForUser).not.toHaveBeenCalled();
    expect(mocks.rotate).toHaveBeenCalled();

    const newAccessToken = response.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    expect(jwtService.verifyAccessToken(newAccessToken!)).toMatchObject({ role: "STAFF" });
  });

  // F4 / AC9 — throttle cùng tier với session route, là guard-clause đầu tiên.
  it("vượt ngưỡng authLimiter -> trả 429 của limiter, không verify token/không đụng DB", async () => {
    const tooMany = NextResponse.json(
      { success: false, message: "Too many login attempts", error: { code: "TOO_MANY_LOGIN_ATTEMPTS" } },
      { status: 429 },
    );
    mocks.authLimiter.mockResolvedValue(tooMany);
    const refreshToken = jwtService.signRefreshToken(payload);

    const response = await POST(requestWithCookie(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`));

    expect(response.status).toBe(429);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.isActive).not.toHaveBeenCalled();
    expect(mocks.rotate).not.toHaveBeenCalled();
  });
});
