// @vitest-environment node
// route.ts -> refresh-token.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ revoke: vi.fn(), auditLog: vi.fn() }));

vi.mock("@/features/auth/services/refresh-token.service", () => ({
  refreshTokenService: { revoke: mocks.revoke },
}));

vi.mock("@/features/auth/services/audit-log.service", () => ({
  auditLogService: { log: mocks.auditLog },
}));

import { NextRequest } from "next/server";
import { jwtService, type JwtPayload } from "@/features/auth/services/jwt.service";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/constants";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("không có refresh token cookie -> vẫn xoá cookie, không gọi revoke", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBe("");
    expect(response.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe("");
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it("cookie không phải JWT hợp lệ -> vẫn revoke theo hash + xoá cookie, nhưng không audit log được (không đọc được user_id)", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=some-refresh-token` },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(mocks.revoke).toHaveBeenCalledWith("some-refresh-token");
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBe("");
    expect(response.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe("");
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it("cookie là refresh token JWT hợp lệ -> revoke + audit log LOGOUT đúng user_id", async () => {
    const payload: JwtPayload = { sub: "user-1", email: "user@example.com", role: "USER" };
    const refreshToken = jwtService.signRefreshToken(payload);
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(mocks.revoke).toHaveBeenCalledWith(refreshToken);
    expect(mocks.auditLog).toHaveBeenCalledWith(
      "user-1",
      "LOGOUT",
      expect.objectContaining({ ip: null, userAgent: null })
    );
  });
});
