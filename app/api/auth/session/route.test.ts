// @vitest-environment node
// route.ts -> jwt.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  store: vi.fn(),
  auditLog: vi.fn(),
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

import { NextRequest } from "next/server";
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
});
