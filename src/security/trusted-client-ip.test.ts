// @vitest-environment node
// trusted-client-ip.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  canonicalizeIp,
  hashClientIp,
  resolveHashedClientIp,
  resolveTrustedClientIp,
} from "./trusted-client-ip";

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    headers,
  });
}

const ENV_KEYS = ["TRUSTED_CLIENT_IP_HEADER", "CLIENT_IP_HASH_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("canonicalizeIp — AC02 IPv4/IPv6 canonicalization", () => {
  it.each([
    ["1.2.3.4", "1.2.3.4"],
    ["1.2.3.4:5678", "1.2.3.4"],
    ["  1.2.3.4  ", "1.2.3.4"],
    // IPv4-mapped IPv6 phải gộp về CÙNG bucket với IPv4 thuần, nếu không cùng
    // một khách có hai hạn mức.
    ["::ffff:1.2.3.4", "1.2.3.4"],
    ["[2001:db8:1:2:3:4:5:6]:443", "2001:db8:1:2::/64"],
    // Hoa/thường của IPv6 là cùng một địa chỉ.
    ["2001:DB8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
  ])("%s -> %s", (input, expected) => {
    expect(canonicalizeIp(input)).toBe(expected);
  });

  it("IPv6 bị cắt về /64 nên xoay địa chỉ trong cùng prefix KHÔNG né được limiter", () => {
    const a = canonicalizeIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = canonicalizeIp("2001:db8:1:2:9999:8888:7777:6666");
    expect(a).toBe(b);
  });

  it("chuỗi không phải IP -> null", () => {
    expect(canonicalizeIp("not-an-ip")).toBeNull();
    expect(canonicalizeIp("")).toBeNull();
  });
});

describe("resolveTrustedClientIp — AC08 chống spoof x-forwarded-for", () => {
  it("chưa cấu hình TRUSTED_CLIENT_IP_HEADER -> trusted=false (IP là tín hiệu mềm)", () => {
    const result = resolveTrustedClientIp(
      requestWith({ "x-forwarded-for": "1.2.3.4" }),
    );
    expect(result.trusted).toBe(false);
    expect(result.ip).toBe("1.2.3.4");
  });

  it("lấy hop CUỐI, không phải hop đầu do client tự gửi", () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
    // Client gửi "9.9.9.9" bịa đặt; proxy của ta thêm IP thật vào cuối.
    const result = resolveTrustedClientIp(
      requestWith({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 203.0.113.7" }),
    );
    expect(result.ip).toBe("203.0.113.7");
    expect(result.trusted).toBe(true);
  });

  it("header lạ do client bịa KHÔNG được đọc khi ta chỉ tin header đã cấu hình", () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "cf-connecting-ip";
    const result = resolveTrustedClientIp(
      requestWith({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" }),
    );
    expect(result.ip).toBeNull();
  });

  it("thiếu header -> ip null, không ném lỗi", () => {
    expect(resolveTrustedClientIp(requestWith({})).ip).toBeNull();
  });
});

describe("hashClientIp — AC13 không log/lưu IP thô", () => {
  it("thiếu CLIENT_IP_HASH_SECRET -> null, KHÔNG fallback sang hash không khoá", () => {
    expect(hashClientIp("1.2.3.4")).toBeNull();
  });

  it("có secret -> giá trị ổn định, khác secret thì khác hash, không chứa IP gốc", () => {
    process.env.CLIENT_IP_HASH_SECRET = "secret-a";
    const a1 = hashClientIp("1.2.3.4");
    const a2 = hashClientIp("1.2.3.4");
    process.env.CLIENT_IP_HASH_SECRET = "secret-b";
    const b = hashClientIp("1.2.3.4");

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).not.toContain("1.2.3.4");
    expect(a1).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("resolveHashedClientIp", () => {
  it("không có nhánh nào trả IP thô", () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
    process.env.CLIENT_IP_HASH_SECRET = "secret";
    const result = resolveHashedClientIp(
      requestWith({ "x-forwarded-for": "203.0.113.7" }),
    );
    expect(result.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(result)).not.toContain("203.0.113.7");
  });

  it("thiếu secret -> ipHash null (bên gọi tự quyết fail-closed hay bỏ qua)", () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
    expect(
      resolveHashedClientIp(requestWith({ "x-forwarded-for": "1.2.3.4" }))
        .ipHash,
    ).toBeNull();
  });
});
