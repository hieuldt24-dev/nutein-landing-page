// @vitest-environment node
// route.ts -> auth-email.server.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  emailExistsInUsers: vi.fn(),
  emailStatusLimiter: vi.fn(),
}));

vi.mock("@/features/auth/services/auth-email.server", () => ({
  emailExistsInUsers: mocks.emailExistsInUsers,
}));

vi.mock("@/src/middlewares/rate-limit.middleware", () => ({
  emailStatusLimiter: mocks.emailStatusLimiter,
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

function emailRequest(email = "a@example.com") {
  return new NextRequest("http://localhost:3000/api/auth/email-status", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/email-status — F5 (AC12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailStatusLimiter.mockResolvedValue(null);
    mocks.emailExistsInUsers.mockResolvedValue(true);
  });

  it("dưới ngưỡng -> 200 với shape { exists } không đổi", async () => {
    const response = await POST(emailRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ exists: true });
  });

  it("vượt ngưỡng limiter riêng -> trả 429 và KHÔNG truy vấn danh sách email", async () => {
    mocks.emailStatusLimiter.mockResolvedValue(
      NextResponse.json(
        {
          success: false,
          message: "quá nhiều lần",
          error: { code: "TOO_MANY_EMAIL_CHECKS" },
        },
        { status: 429 },
      ),
    );

    const response = await POST(emailRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("TOO_MANY_EMAIL_CHECKS");
    // Guard-clause đứng đầu: không rò rỉ thông tin tồn tại email khi bị chặn.
    expect(mocks.emailExistsInUsers).not.toHaveBeenCalled();
  });

  it("limiter là guard-clause đầu tiên — chạy trước cả parse body", async () => {
    mocks.emailStatusLimiter.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "TOO_MANY_EMAIL_CHECKS" } }, { status: 429 }),
    );

    // Body rỗng/không hợp lệ: nếu parse chạy trước limiter sẽ ra 400, không phải 429.
    const badRequest = new NextRequest("http://localhost:3000/api/auth/email-status", {
      method: "POST",
    });
    const response = await POST(badRequest);

    expect(response.status).toBe(429);
  });

  it("route vẫn KHÔNG yêu cầu đăng nhập (giữ đúng thiết kế pre-login)", async () => {
    const response = await POST(emailRequest("chua-co@example.com"));

    expect(response.status).toBe(200);
    expect(mocks.emailExistsInUsers).toHaveBeenCalledWith("chua-co@example.com");
  });
});
