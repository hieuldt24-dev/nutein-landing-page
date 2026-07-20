// @vitest-environment node
// jwt.service.ts có `import "server-only"` (đúng convention của project cho
// service đụng secret) — cái này chặn import khi environment là jsdom.
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { jwtService, expiryToSeconds, type JwtPayload } from "./jwt.service";

const payload: JwtPayload = { sub: "user-1", email: "user@example.com", role: "USER" };

describe("jwtService", () => {
  it("ký và verify access token round-trip đúng payload", () => {
    const token = jwtService.signAccessToken(payload);
    const decoded = jwtService.verifyAccessToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it("ký và verify refresh token round-trip đúng payload", () => {
    const token = jwtService.signRefreshToken(payload);
    const decoded = jwtService.verifyRefreshToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it("access token và refresh token ký bằng secret khác nhau — verify chéo phải thất bại", () => {
    const accessToken = jwtService.signAccessToken(payload);
    expect(() => jwtService.verifyRefreshToken(accessToken)).toThrow();

    const refreshToken = jwtService.signRefreshToken(payload);
    expect(() => jwtService.verifyAccessToken(refreshToken)).toThrow();
  });

  it("throw khi verify token bị sửa chữ ký (tampered)", () => {
    const token = jwtService.signAccessToken(payload);
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => jwtService.verifyAccessToken(tampered)).toThrow();
  });

  it("throw TokenExpiredError khi access token đã hết hạn", () => {
    // Ký tay bằng cùng secret thật (không mock jsonwebtoken) với expiresIn âm
    // để giả lập token hết hạn ngay lập tức, không cần chờ 15 phút thật.
    const expiredToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
      expiresIn: -10,
    });

    expect(() => jwtService.verifyAccessToken(expiredToken)).toThrow();
    try {
      jwtService.verifyAccessToken(expiredToken);
    } catch (error) {
      expect((error as Error).name).toBe("TokenExpiredError");
    }
  });

  it("access token cấp ra có hạn ngắn hơn refresh token (đúng thiết kế)", () => {
    const accessToken = jwtService.signAccessToken(payload);
    const refreshToken = jwtService.signRefreshToken(payload);
    const accessExp = jwt.decode(accessToken) as { exp: number };
    const refreshExp = jwt.decode(refreshToken) as { exp: number };
    expect(accessExp.exp).toBeLessThan(refreshExp.exp);
  });
});

describe("expiryToSeconds", () => {
  it("parse đúng các đơn vị s/m/h/d", () => {
    expect(expiryToSeconds("30s", 0)).toBe(30);
    expect(expiryToSeconds("15m", 0)).toBe(900);
    expect(expiryToSeconds("2h", 0)).toBe(7200);
    expect(expiryToSeconds("7d", 0)).toBe(604800);
  });

  it("trả về fallback khi format không hợp lệ", () => {
    expect(expiryToSeconds("invalid", 123)).toBe(123);
    expect(expiryToSeconds("", 456)).toBe(456);
  });
});
