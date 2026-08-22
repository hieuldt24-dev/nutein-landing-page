// @vitest-environment node
// route.ts -> contact.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  sessionLimiter: vi.fn(),
}));

vi.mock("@/features/contact/services/contact.service", () => ({
  contactService: { submit: mocks.submit },
}));

vi.mock("@/src/middlewares/rate-limit.middleware", () => ({
  sessionLimiter: mocks.sessionLimiter,
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const validBody = {
  name: "Nguyễn Văn A",
  email: "a@example.com",
  phone: "0912345678",
  subject: "Hỏi về sản phẩm",
  message: "Tôi muốn biết thêm thông tin về sản phẩm Nutein.",
};

function contactRequest(body: unknown = validBody) {
  return new NextRequest("http://localhost:3000/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/contact — F4 rate limiting (AC10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionLimiter.mockResolvedValue(null);
    mocks.submit.mockResolvedValue({ id: "contact-1" });
  });

  it("dưới ngưỡng -> vẫn xử lý form bình thường (201)", async () => {
    const response = await POST(contactRequest());

    expect(response.status).toBe(201);
    expect(mocks.submit).toHaveBeenCalled();
  });

  it("vượt ngưỡng limiter -> trả 429, KHÔNG gọi contactService.submit", async () => {
    mocks.sessionLimiter.mockResolvedValue(
      NextResponse.json(
        { success: false, message: "quá nhiều request", error: { code: "TOO_MANY_REQUESTS" } },
        { status: 429 },
      ),
    );

    const response = await POST(contactRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("limiter là guard-clause đầu tiên — chặn trước cả validate body", async () => {
    mocks.sessionLimiter.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "TOO_MANY_REQUESTS" } }, { status: 429 }),
    );

    const response = await POST(contactRequest({ name: "" }));

    expect(response.status).toBe(429);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
