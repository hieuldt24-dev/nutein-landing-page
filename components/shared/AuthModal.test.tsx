import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig, useSWRConfig } from "swr";
import type { AuthUser } from "@/features/auth/types";

vi.mock("next/image", () => ({
  // next/image cần context/loader riêng của Next runtime — mock về <img>
  // thường cho môi trường test (vitest + jsdom, không chạy qua Next server).
  // eslint-disable-next-line @next/next/no-img-element -- đây chính là mock thay next/image
  default: (props: Record<string, unknown>) => <img alt={props.alt as string} {...props} />,
}));

const mocks = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@/lib/useAuthStore", () => ({
  useAuthStore: mocks.useAuthStore,
}));

vi.mock("@/lib/toast", () => ({
  notify: {
    success: mocks.notifySuccess,
    error: mocks.notifyError,
    info: mocks.notifyInfo,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  usePathname: () => "/",
}));

import AuthModal from "./AuthModal";

function authStoreState(
  overrides: Partial<{
    user: AuthUser | null;
    isLoggedIn: boolean;
    signInWithGoogle: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  }> = {}
) {
  return {
    user: null,
    isLoggedIn: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

/** Mở modal đúng cách app thật dùng — mutate("auth-modal", true) — thay vì seed cache trực tiếp. */
function OpenAuthModal() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    mutate("auth-modal", true, { revalidate: false });
  }, [mutate]);
  return <AuthModal />;
}

function renderAuthModal() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <OpenAuthModal />
    </SWRConfig>
  );
}

function getGoogleButton() {
  return screen.getByRole("button", { name: /Tiếp tục với Google/ });
}

describe("AuthModal — chỉ đăng nhập bằng Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthStore.mockReturnValue(authStoreState());
  });

  it("render dialog với CTA Google và không còn ô email/mật khẩu", async () => {
    renderAuthModal();

    await screen.findByRole("dialog");
    expect(screen.getByText("Chào mừng trở lại")).toBeInTheDocument();
    expect(getGoogleButton()).toBeInTheDocument();

    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByPlaceholderText("tenban@example.com")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đăng ký" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quên mật khẩu?" })).not.toBeInTheDocument();
  });

  it("bấm CTA gọi signInWithGoogle với redirect URL /auth/callback?next=", async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    mocks.useAuthStore.mockReturnValue(authStoreState({ signInWithGoogle }));

    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.click(getGoogleButton());

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(signInWithGoogle).toHaveBeenCalledWith(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`
    );
  });

  it("signInWithGoogle lỗi: toast error và bật lại nút", async () => {
    const signInWithGoogle = vi.fn().mockRejectedValue(new Error("Google lỗi"));
    mocks.useAuthStore.mockReturnValue(authStoreState({ signInWithGoogle }));

    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.click(getGoogleButton());

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledWith("Google lỗi"));
    await waitFor(() => expect(getGoogleButton()).not.toBeDisabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("đã đăng nhập + mở modal: tự đóng", async () => {
    mocks.useAuthStore.mockReturnValue(
      authStoreState({
        user: { email: "user@example.com", fullName: "Nguyễn Văn A", role: "user" },
        isLoggedIn: true,
      })
    );

    renderAuthModal();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("nhấn Escape đóng modal", async () => {
    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("bấm backdrop đóng modal", async () => {
    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.click(document.getElementById("auth-modal-backdrop")!);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
