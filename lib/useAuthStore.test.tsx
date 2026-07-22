import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { User } from "@supabase/supabase-js";
import type { AuthUser } from "@/features/auth/types";

vi.mock("@/features/auth/services/auth.repository", () => ({
  authRepository: {
    signInWithPassword: vi.fn(),
    signUpWithPassword: vi.fn(),
    signOut: vi.fn(),
    mintApiSession: vi.fn().mockResolvedValue(true),
  },
  toAuthUser: vi.fn(
    (user: User): AuthUser => ({
      email: user.email ?? "",
      fullName:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined,
      phone: user.phone || undefined,
      role: "user",
    })
  ),
}));

import { authRepository } from "@/features/auth/services/auth.repository";
import { useAuthStore } from "./useAuthStore";

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

// Cache SWR mới cho mỗi test — tránh state rò rỉ giữa các test (đúng
// pattern khuyến nghị của SWR cho testing).
function renderAuthStore() {
  return renderHook(() => useAuthStore(), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    ),
  });
}

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mặc định chưa đăng nhập (user null, isLoggedIn false)", async () => {
    const { result } = renderAuthStore();
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("signIn thành công cập nhật user + isLoggedIn = true", async () => {
    const user = makeUser({ user_metadata: { full_name: "Nguyễn Văn A" } });
    vi.mocked(authRepository.signInWithPassword).mockResolvedValue(user);

    const { result } = renderAuthStore();

    await act(async () => {
      await result.current.signIn("user@example.com", "matkhau123");
    });

    expect(authRepository.signInWithPassword).toHaveBeenCalledWith(
      "user@example.com",
      "matkhau123"
    );
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    expect(result.current.user).toEqual({
      email: "user@example.com",
      fullName: "Nguyễn Văn A",
      phone: undefined,
      role: "user",
    });
  });

  it("signIn thất bại: ném lỗi và không đổi state đăng nhập", async () => {
    vi.mocked(authRepository.signInWithPassword).mockRejectedValue(
      new Error("Email hoặc mật khẩu không đúng.")
    );

    const { result } = renderAuthStore();

    await expect(
      act(async () => {
        await result.current.signIn("user@example.com", "sai-mat-khau");
      })
    ).rejects.toThrow("Email hoặc mật khẩu không đúng.");

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("signOut xoá user khỏi state", async () => {
    const user = makeUser();
    vi.mocked(authRepository.signInWithPassword).mockResolvedValue(user);
    vi.mocked(authRepository.signOut).mockResolvedValue(undefined);

    const { result } = renderAuthStore();

    await act(async () => {
      await result.current.signIn("user@example.com", "matkhau123");
    });
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    await act(async () => {
      await result.current.signOut();
    });

    expect(authRepository.signOut).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("signUp cần xác nhận email: không tự đăng nhập", async () => {
    const user = makeUser();
    vi.mocked(authRepository.signUpWithPassword).mockResolvedValue({
      user,
      needsEmailConfirmation: true,
    });

    const { result } = renderAuthStore();

    let signUpResult!: { needsEmailConfirmation: boolean };
    await act(async () => {
      signUpResult = await result.current.signUp(
        "user@example.com",
        "matkhau123",
        "Nguyễn Văn A"
      );
    });

    expect(signUpResult.needsEmailConfirmation).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("signUp auto-confirm: đăng nhập ngay sau khi đăng ký", async () => {
    const user = makeUser({ user_metadata: { full_name: "Nguyễn Văn A" } });
    vi.mocked(authRepository.signUpWithPassword).mockResolvedValue({
      user,
      needsEmailConfirmation: false,
    });

    const { result } = renderAuthStore();

    await act(async () => {
      await result.current.signUp("user@example.com", "matkhau123", "Nguyễn Văn A");
    });

    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
  });
});
