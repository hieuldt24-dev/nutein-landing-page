// @vitest-environment node
// route.ts -> jwt.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  isActive: vi.fn(),
  rotate: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock("@/features/auth/services/refresh-token.service", () => ({
  refreshTokenService: { isActive: mocks.isActive, rotate: mocks.rotate },
}));

vi.mock("@/features/auth/services/audit-log.service", () => ({
  auditLogService: { log: mocks.auditLog },
}));

import { NextRequest } from "next/server";
import { jwtService, type JwtPayload } from "@/features/auth/services/jwt.service";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/constants";
import { POST } from "./route";

const payload: JwtPayload = { sub: "user-1", email: "user@example.com", role: "USER" };

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
});
