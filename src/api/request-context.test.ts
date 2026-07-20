import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp, getUserAgent } from "./request-context";

function requestWithHeaders(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/auth/session", {
    method: "POST",
    headers,
  });
}

describe("getClientIp", () => {
  it("ưu tiên IP đầu tiên trong x-forwarded-for", () => {
    const req = requestWithHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("fallback sang x-real-ip khi không có x-forwarded-for", () => {
    const req = requestWithHeaders({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("null khi không có header nào", () => {
    const req = requestWithHeaders({});
    expect(getClientIp(req)).toBeNull();
  });
});

describe("getUserAgent", () => {
  it("trả về đúng header user-agent", () => {
    const req = requestWithHeaders({ "user-agent": "vitest-agent" });
    expect(getUserAgent(req)).toBe("vitest-agent");
  });

  it("null khi không có header", () => {
    const req = requestWithHeaders({});
    expect(getUserAgent(req)).toBeNull();
  });
});
