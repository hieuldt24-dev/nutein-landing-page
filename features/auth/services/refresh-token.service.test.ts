// @vitest-environment node
// refresh-token.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  eqAfterUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: mocks.insert,
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.maybeSingle,
        }),
      }),
      update: (payload: unknown) => {
        mocks.update(payload);
        return { eq: mocks.eqAfterUpdate };
      },
    }),
  },
}));

import { refreshTokenService, hashRefreshToken } from "./refresh-token.service";

describe("hashRefreshToken", () => {
  it("cùng input luôn ra cùng hash (deterministic)", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
  });

  it("input khác nhau ra hash khác nhau", () => {
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("xyz"));
  });

  it("không trả về chính token gốc (có hash hoá thật)", () => {
    expect(hashRefreshToken("abc")).not.toBe("abc");
  });
});

describe("refreshTokenService.store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("insert đúng user_id + token_hash + expires_at (ISO string)", async () => {
    mocks.insert.mockResolvedValue({ error: null });
    const expiresAt = new Date("2026-08-01T00:00:00Z");

    await refreshTokenService.store("user-1", "raw-token", expiresAt);

    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      token_hash: hashRefreshToken("raw-token"),
      expires_at: expiresAt.toISOString(),
    });
  });

  it("throw khi insert lỗi", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "db down" } });
    await expect(refreshTokenService.store("user-1", "raw-token", new Date())).rejects.toThrow(
      "db down"
    );
  });
});

describe("refreshTokenService.isActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("true khi token tồn tại, chưa thu hồi, chưa hết hạn", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { revoked_at: null, expires_at: new Date(Date.now() + 100_000).toISOString() },
    });
    expect(await refreshTokenService.isActive("raw-token")).toBe(true);
  });

  it("false khi không tìm thấy row trong DB (chưa từng cấp / đã bị xoá)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    expect(await refreshTokenService.isActive("raw-token")).toBe(false);
  });

  it("false khi đã bị thu hồi (revoked_at khác null)", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        revoked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 100_000).toISOString(),
      },
    });
    expect(await refreshTokenService.isActive("raw-token")).toBe(false);
  });

  it("false khi đã hết hạn theo expires_at trong DB", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { revoked_at: null, expires_at: new Date(Date.now() - 1000).toISOString() },
    });
    expect(await refreshTokenService.isActive("raw-token")).toBe(false);
  });
});

describe("refreshTokenService.revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("update revoked_at cho đúng token_hash", async () => {
    mocks.eqAfterUpdate.mockResolvedValue({ error: null });

    await refreshTokenService.revoke("raw-token");

    expect(mocks.update).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
    expect(mocks.eqAfterUpdate).toHaveBeenCalledWith("token_hash", hashRefreshToken("raw-token"));
  });

  it("throw khi update lỗi", async () => {
    mocks.eqAfterUpdate.mockResolvedValue({ error: { message: "db down" } });
    await expect(refreshTokenService.revoke("raw-token")).rejects.toThrow("db down");
  });
});

describe("refreshTokenService.rotate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqAfterUpdate.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("thu hồi token cũ rồi lưu token mới", async () => {
    const expiresAt = new Date("2026-08-01T00:00:00Z");

    await refreshTokenService.rotate("user-1", "old-token", "new-token", expiresAt);

    expect(mocks.eqAfterUpdate).toHaveBeenCalledWith("token_hash", hashRefreshToken("old-token"));
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      token_hash: hashRefreshToken("new-token"),
      expires_at: expiresAt.toISOString(),
    });
  });
});
