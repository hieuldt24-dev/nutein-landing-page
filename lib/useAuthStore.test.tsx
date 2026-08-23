import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { User } from "@supabase/supabase-js";
import type { AuthUser } from "@/features/auth/types";

vi.mock("@/features/auth/services/auth.repository", () => ({
  authRepository: {
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    mintApiSession: vi.fn().mockResolvedValue({ ok: true, role: "user" }),
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

  it("không còn expose signIn/signUp (chỉ còn Google)", () => {
    const { result } = renderAuthStore();

    expect(result.current).not.toHaveProperty("signIn");
    expect(result.current).not.toHaveProperty("signUp");
    expect(typeof result.current.signInWithGoogle).toBe("function");
  });

  it("signInWithGoogle uỷ quyền cho repository kèm redirectTo", async () => {
    vi.mocked(authRepository.signInWithGoogle).mockResolvedValue(undefined);

    const { result } = renderAuthStore();

    await act(async () => {
      await result.current.signInWithGoogle("http://localhost/auth/callback?next=%2F");
    });

    expect(authRepository.signInWithGoogle).toHaveBeenCalledWith(
      "http://localhost/auth/callback?next=%2F"
    );
  });

  it("signOut gọi repository và giữ state ở trạng thái chưa đăng nhập", async () => {
    vi.mocked(authRepository.signOut).mockResolvedValue(undefined);

    const { result } = renderAuthStore();

    await act(async () => {
      await result.current.signOut();
    });

    expect(authRepository.signOut).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("role null khi chưa đăng nhập -> isStaffOrAdmin false", async () => {
    const { result } = renderAuthStore();

    await waitFor(() => expect(result.current.role).toBeNull());
    expect(result.current.isStaffOrAdmin).toBe(false);
  });
});
