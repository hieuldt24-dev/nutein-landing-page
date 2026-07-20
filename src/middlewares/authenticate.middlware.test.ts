// @vitest-environment node
// authenticate.middlware.ts -> jwt.service.ts có `import "server-only"`,
// chặn import ở jsdom.
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { jwtService, type JwtPayload } from "@/features/auth/services/jwt.service";
import { ACCESS_TOKEN_COOKIE } from "@/features/auth/constants";
import { authenticate, requireRole } from "./authenticate.middlware";

const payload: JwtPayload = { sub: "user-1", email: "user@example.com", role: "STAFF" };

function requestWithAccessToken(token: string) {
  return new NextRequest("http://localhost:3000/api/protected", {
    headers: { cookie: `${ACCESS_TOKEN_COOKIE}=${token}` },
  });
}

describe("authenticate", () => {
  it("thiếu cookie access token -> AppError 401 NO_TOKEN", async () => {
    const request = new NextRequest("http://localhost:3000/api/protected");
    await expect(authenticate(request)).rejects.toMatchObject({
      statusCode: 401,
      code: "NO_TOKEN",
    });
  });

  it("access token hợp lệ -> trả đúng userId/email/role từ payload", async () => {
    const token = jwtService.signAccessToken(payload);
    const request = requestWithAccessToken(token);

    const user = await authenticate(request);
    expect(user).toEqual({ userId: payload.sub, email: payload.email, role: payload.role });
  });

  it("access token hết hạn -> AppError 401 TOKEN_EXPIRED", async () => {
    const expiredToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: -10 });
    const request = requestWithAccessToken(expiredToken);

    await expect(authenticate(request)).rejects.toMatchObject({
      statusCode: 401,
      code: "TOKEN_EXPIRED",
    });
  });

  it("access token sai chữ ký -> AppError 401 INVALID_TOKEN", async () => {
    const request = requestWithAccessToken("not-a-real-jwt");
    await expect(authenticate(request)).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_TOKEN",
    });
  });
});

describe("requireRole", () => {
  const user = { userId: "user-1", email: "user@example.com", role: "USER" as const };

  it("không throw khi user có role nằm trong danh sách cho phép", () => {
    expect(() => requireRole(user, "USER", "STAFF")).not.toThrow();
  });

  it("throw AppError 403 khi role không đủ quyền", () => {
    expect(() => requireRole(user, "ADMIN")).toThrow(
      expect.objectContaining({ statusCode: 403, code: "FORBIDDEN" })
    );
  });
});
