import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthError, User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
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

describe("authRepository.signInWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trả về user khi Supabase đăng nhập thành công", async () => {
    const user = makeUser();
    vi.mocked(supabaseBrowser.auth.signInWithPassword).mockResolvedValue({
      data: { user, session: {} as never },
      error: null,
    } as never);

    const result = await authRepository.signInWithPassword("user@example.com", "matkhau123");

    expect(result).toEqual(user);
    expect(supabaseBrowser.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "matkhau123",
    });
  });

  it("map lỗi 'Invalid login credentials' sang message tiếng Việt", async () => {
    vi.mocked(supabaseBrowser.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: makeAuthError("Invalid login credentials"),
    } as never);

    await expect(
      authRepository.signInWithPassword("user@example.com", "wrong-password")
    ).rejects.toThrow("Email hoặc mật khẩu không đúng.");
  });

  it("map lỗi 'Email not confirmed' sang message tiếng Việt", async () => {
    vi.mocked(supabaseBrowser.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: makeAuthError("Email not confirmed"),
    } as never);

    await expect(
      authRepository.signInWithPassword("user@example.com", "matkhau123")
    ).rejects.toThrow("Vui lòng xác nhận email trước khi đăng nhập (kiểm tra hộp thư đến).");
  });

  it("giữ nguyên message gốc khi lỗi không nằm trong danh sách map", async () => {
    vi.mocked(supabaseBrowser.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: makeAuthError("Some unexpected Supabase error"),
    } as never);

    await expect(
      authRepository.signInWithPassword("user@example.com", "matkhau123")
    ).rejects.toThrow("Some unexpected Supabase error");
  });

  it("throw lỗi mặc định khi không có error nhưng cũng không có user", async () => {
    vi.mocked(supabaseBrowser.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as never);

    await expect(
      authRepository.signInWithPassword("user@example.com", "matkhau123")
    ).rejects.toThrow("Đăng nhập thất bại");
  });
});

describe("authRepository.signUpWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("needsEmailConfirmation = false khi Supabase trả session ngay (auto-confirm)", async () => {
    const user = makeUser();
    vi.mocked(supabaseBrowser.auth.signUp).mockResolvedValue({
      data: { user, session: {} as never },
      error: null,
    } as never);

    const result = await authRepository.signUpWithPassword(
      "user@example.com",
      "matkhau123",
      "Nguyễn Văn A"
    );

    expect(result.user).toEqual(user);
    expect(result.needsEmailConfirmation).toBe(false);
    expect(supabaseBrowser.auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "matkhau123",
      options: { data: { full_name: "Nguyễn Văn A" } },
    });
  });

  it("needsEmailConfirmation = true khi Supabase yêu cầu xác nhận email (không trả session)", async () => {
    const user = makeUser();
    vi.mocked(supabaseBrowser.auth.signUp).mockResolvedValue({
      data: { user, session: null },
      error: null,
    } as never);

    const result = await authRepository.signUpWithPassword(
      "user@example.com",
      "matkhau123",
      "Nguyễn Văn A"
    );

    expect(result.needsEmailConfirmation).toBe(true);
  });

  it("map lỗi 'User already registered' sang message tiếng Việt", async () => {
    vi.mocked(supabaseBrowser.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: makeAuthError("User already registered"),
    } as never);

    await expect(
      authRepository.signUpWithPassword("user@example.com", "matkhau123", "Nguyễn Văn A")
    ).rejects.toThrow("Email này đã được đăng ký.");
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

  it("role từ app_metadata ưu tiên hơn allowlist email", () => {
    const user = makeUser({
      email: "user@example.com",
      app_metadata: { role: "staff" },
    });
    expect(toAuthUser(user).role).toBe("staff");
  });

  it("role fallback allowlist khi metadata không có role", () => {
    const user = makeUser({ email: "admin@nutein.com", user_metadata: {} });
    expect(toAuthUser(user).role).toBe("admin");
  });
});
