import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthError, User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { supabaseBrowser } from "@/lib/supabase-browser";
import { authRepository, toAuthUser } from "./auth.repository";

function makeAuthError(message: string): AuthError {
  return { name: "AuthApiError", message, status: 400, code: undefined } as AuthError;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "user@example.com",
    phone: "",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe("authRepository.signInWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gọi Supabase signInWithOAuth với provider google + redirectTo", async () => {
    vi.mocked(supabaseBrowser.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.com" },
      error: null,
    } as never);

    await expect(
      authRepository.signInWithGoogle("http://localhost/auth/callback?next=%2F")
    ).resolves.toBeUndefined();

    expect(supabaseBrowser.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost/auth/callback?next=%2F" },
    });
  });

  it("throw message đã map khi Supabase trả lỗi", async () => {
    vi.mocked(supabaseBrowser.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: "google", url: null },
      error: makeAuthError("OAuth provider disabled"),
    } as never);

    await expect(
      authRepository.signInWithGoogle("http://localhost/auth/callback")
    ).rejects.toThrow("OAuth provider disabled");
  });
});

describe("authRepository.signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolve thành công khi Supabase signOut không lỗi", async () => {
    vi.mocked(supabaseBrowser.auth.signOut).mockResolvedValue({ error: null } as never);
    await expect(authRepository.signOut()).resolves.toBeUndefined();
  });

  it("throw message đã map khi Supabase signOut lỗi", async () => {
    vi.mocked(supabaseBrowser.auth.signOut).mockResolvedValue({
      error: makeAuthError("Network error"),
    } as never);
    await expect(authRepository.signOut()).rejects.toThrow("Network error");
  });
});

describe("toAuthUser", () => {
  it("ưu tiên user_metadata.full_name khi map fullName", () => {
    const user = makeUser({ user_metadata: { full_name: "  Trần Thị B  " } });
    expect(toAuthUser(user)).toEqual({
      email: "user@example.com",
      fullName: "Trần Thị B",
      phone: undefined,
      role: "user",
    });
  });

  it("fallback sang user_metadata.name khi không có full_name", () => {
    const user = makeUser({ user_metadata: { name: "Lê Văn C" } });
    expect(toAuthUser(user).fullName).toBe("Lê Văn C");
  });

  it("fullName là undefined khi không có full_name lẫn name", () => {
    const user = makeUser({ user_metadata: {} });
    expect(toAuthUser(user).fullName).toBeUndefined();
  });

  it("chuẩn hoá phone rỗng thành undefined, giữ nguyên phone có giá trị", () => {
    expect(toAuthUser(makeUser({ phone: "" })).phone).toBeUndefined();
    expect(toAuthUser(makeUser({ phone: "0901234567" })).phone).toBe("0901234567");
  });

  it("email null/undefined map về chuỗi rỗng", () => {
    const user = makeUser({ email: undefined });
    expect(toAuthUser(user).email).toBe("");
  });

  it("role lấy từ tham số serverRole (public.users)", () => {
    const user = makeUser({ email: "anyone@example.com", user_metadata: {} });
    expect(toAuthUser(user, "admin").role).toBe("admin");
    expect(toAuthUser(user, "staff").role).toBe("staff");
    expect(toAuthUser(user).role).toBe("user");
  });

  it("không dùng email allowlist — thiếu serverRole luôn là user", () => {
    const user = makeUser({ email: "admin@nutein.com", user_metadata: {} });
    expect(toAuthUser(user).role).toBe("user");
  });
});
