// @vitest-environment node
// lib/vietqr.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildVietQrImageUrl, getVietQrBankAccount } from "@/lib/vietqr";

describe("buildVietQrImageUrl", () => {
  beforeEach(() => {
    vi.stubEnv("VIETQR_BANK_ID", "970407");
    vi.stubEnv("VIETQR_ACCOUNT_NO", "19001234567890");
    vi.stubEnv("VIETQR_ACCOUNT_NAME", "CONG TY NUTEIN");
    vi.stubEnv("VIETQR_TEMPLATE", "compact2");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dựng URL ảnh VietQR đúng shape từ 4 env var", () => {
    const url = buildVietQrImageUrl({
      amount: 250_000,
      addInfo: "NT-20260827-AB12",
    });

    expect(url).not.toBeNull();
    const parsed = new URL(url as string);
    expect(parsed.origin).toBe("https://img.vietqr.io");
    expect(parsed.pathname).toBe("/image/970407-19001234567890-compact2.png");
    expect(parsed.searchParams.get("amount")).toBe("250000");
    expect(parsed.searchParams.get("addInfo")).toBe("NT-20260827-AB12");
    expect(parsed.searchParams.get("accountName")).toBe("CONG TY NUTEIN");
  });

  it("encode addInfo/accountName có ký tự đặc biệt", () => {
    vi.stubEnv("VIETQR_ACCOUNT_NAME", "NUTEIN & CO");
    const url = buildVietQrImageUrl({ amount: 1000, addInfo: "ĐH 1+2" });
    expect(url).toContain("addInfo=");
    expect(url).not.toContain("ĐH 1+2");
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get("addInfo")).toBe("ĐH 1+2");
    expect(parsed.searchParams.get("accountName")).toBe("NUTEIN & CO");
  });

  it("dùng template mặc định compact2 khi VIETQR_TEMPLATE bỏ trống", () => {
    vi.stubEnv("VIETQR_TEMPLATE", "");
    const url = buildVietQrImageUrl({ amount: 1000, addInfo: "X" });
    expect(url).toContain("-compact2.png");
  });

  it("làm tròn số tiền về số nguyên", () => {
    const url = buildVietQrImageUrl({ amount: 1000.6, addInfo: "X" });
    expect(new URL(url as string).searchParams.get("amount")).toBe("1001");
  });

  it("trả null khi thiếu VIETQR_BANK_ID", () => {
    vi.stubEnv("VIETQR_BANK_ID", "");
    expect(buildVietQrImageUrl({ amount: 1000, addInfo: "X" })).toBeNull();
  });

  it("trả null khi thiếu VIETQR_ACCOUNT_NO", () => {
    vi.stubEnv("VIETQR_ACCOUNT_NO", "");
    expect(buildVietQrImageUrl({ amount: 1000, addInfo: "X" })).toBeNull();
  });
});

describe("getVietQrBankAccount", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trả thông tin tài khoản khi đã cấu hình", () => {
    vi.stubEnv("VIETQR_BANK_ID", "970407");
    vi.stubEnv("VIETQR_ACCOUNT_NO", "19001234567890");
    vi.stubEnv("VIETQR_ACCOUNT_NAME", "CONG TY NUTEIN");
    expect(getVietQrBankAccount()).toEqual({
      bankId: "970407",
      accountNo: "19001234567890",
      accountName: "CONG TY NUTEIN",
    });
  });

  it("trả null khi chưa cấu hình", () => {
    vi.stubEnv("VIETQR_BANK_ID", "");
    vi.stubEnv("VIETQR_ACCOUNT_NO", "");
    expect(getVietQrBankAccount()).toBeNull();
  });
});
