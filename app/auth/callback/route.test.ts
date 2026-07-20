import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  })),
}));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("đổi code lấy session thành công thì redirect tới `next`", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=abc123&next=/account"
    );
    const response = await GET(request);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/account");
  });

  it("không truyền `next` thì redirect về trang chủ", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc123");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("exchangeCodeForSession lỗi thì redirect về '/' kèm ?auth_error=1", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=bad-code");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/?auth_error=1");
  });

  it("thiếu `code` trong query thì redirect lỗi mà không gọi Supabase", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(request);

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/?auth_error=1");
  });
});
