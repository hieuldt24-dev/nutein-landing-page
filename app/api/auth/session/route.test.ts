// @vitest-environment node
// route.ts -> jwt.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  store: vi.fn(),
  auditLog: vi.fn(),
  authLimiter: vi.fn(),
}));

vi.mock("@/src/middlewares/rate-limit.middleware", () => ({
  authLimiter: mocks.authLimiter,
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mocks.single,
        }),
      }),
    }),
  })),
}));

vi.mock("@/features/auth/services/refresh-token.service", () => ({
  refreshTokenService: { store: mocks.store },
}));

vi.mock("@/features/auth/services/audit-log.service", () => ({
  auditLogService: { log: mocks.auditLog },
}));

import { NextRequest, NextResponse } from "next/server";
import { jwtService } from "@/features/auth/services/jwt.service";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/constants";
import { POST } from "./route";

// Handler thật không đọc gì từ req, nhưng withErrorHandler cần req.nextUrl để
// log khi có lỗi — luôn truyền 1 NextRequest thật, không gọi POST() tay không.
function fakeRequest() {
  return new NextRequest("http://localhost:3000/api/auth/session", { method: "POST" });
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mặc định: chưa vượt ngưỡng rate limit (limiter trả null = cho đi tiếp).
    mocks.authLimiter.mockResolvedValue(null);
  });

  it("chưa đăng nhập Supabase (không có user) -> 401, không set cookie JWT", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(fakeRequest());

    expect(response.status).toBe(401);
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)).toBeUndefined();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it("đã đăng nhập Supabase -> 200, set cả 2 cookie JWT đúng payload (role từ public.users)", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    });
    mocks.single.mockResolvedValue({ data: { role: "STAFF" }, error: null });

    const response = await POST(fakeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: { role: "staff" },
    });

    const accessToken = response.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const refreshToken = response.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const decoded = jwtService.verifyAccessToken(accessToken!);
    expect(decoded).toMatchObject({
      sub: "user-1",
      email: "user@example.com",
      role: "STAFF",
    });

    expect(mocks.store).toHaveBeenCalledWith("user-1", refreshToken, expect.any(Date));
    expect(mocks.auditLog).toHaveBeenCalledWith(
      "user-1",
      "LOGIN_SUCCESS",
      expect.objectContaining({ ip: null, userAgent: null })
    );
  });

  it("public.users chưa có row (race ngay sau signup) -> fallback role USER, vẫn set cookie", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-2", email: "user2@example.com" } },
      error: null,
    });
    mocks.single.mockResolvedValue({ data: null, error: { message: "not found" } });

    const response = await POST(fakeRequest());
    expect(response.status).toBe(200);

    const accessToken = response.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const decoded = jwtService.verifyAccessToken(accessToken!);
    expect(decoded.role).toBe("USER");
  });

  // F2 / AC3 — tài khoản bị khóa không được cấp JWT mới.
  it("tài khoản bị khóa (is_deleted=true) -> 403, không mint/lưu token nào", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-3", email: "locked@example.com" } },
      error: null,
    });
    mocks.single.mockResolvedValue({ data: { role: "USER", is_deleted: true }, error: null });

    const response = await POST(fakeRequest());

    expect(response.status).toBe(403);
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)).toBeUndefined();
    expect(response.cookies.get(REFRESH_TOKEN_COOKIE)).toBeUndefined();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  // F2 / AC5 — tài khoản chưa khóa không bị ảnh hưởng.
  it("tài khoản chưa khóa (is_deleted=false) -> vẫn 200, set cookie như bình thường", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-4", email: "ok@example.com" } },
      error: null,
    });
    mocks.single.mockResolvedValue({ data: { role: "USER", is_deleted: false }, error: null });

    const response = await POST(fakeRequest());

    expect(response.status).toBe(200);
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBeTruthy();
    expect(mocks.store).toHaveBeenCalled();
  });

  // F4 / AC8 — vượt ngưỡng thì trả thẳng response 429 của limiter, và phải
  // chặn TRƯỚC khi gọi Supabase (guard-clause đầu tiên).
  it("vượt ngưỡng authLimiter -> trả 429 của limiter, không gọi Supabase/không mint token", async () => {
    const tooMany = NextResponse.json(
      { success: false, message: "Too many login attempts", error: { code: "TOO_MANY_LOGIN_ATTEMPTS" } },
      { status: 429 },
    );
    mocks.authLimiter.mockResolvedValue(tooMany);

    const response = await POST(fakeRequest());

    expect(response.status).toBe(429);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });
});
