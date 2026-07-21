import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
}));

import AuthModal from "./AuthModal";

function authStoreState(overrides: Partial<{
  user: AuthUser | null;
  isLoggedIn: boolean;
  signIn: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    user: null,
    isLoggedIn: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
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

/** Nút submit trùng text "Đăng nhập" với nút tab — phân biệt bằng type="submit". */
function getSubmitButton() {
  const button = screen
    .getAllByRole("button", { name: "Đăng nhập" })
    .find((btn) => btn.getAttribute("type") === "submit");
  if (!button) throw new Error("Không tìm thấy nút submit đăng nhập");
  return button;
}

describe("AuthModal — đăng nhập", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthStore.mockReturnValue(authStoreState());
  });

  it("mở ở tab Đăng nhập theo mặc định với email + mật khẩu", async () => {
    renderAuthModal();

    await screen.findByRole("dialog");
    expect(screen.getByText("Chào mừng trở lại")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("tenban@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("hiển thị lỗi validate khi submit form trống", async () => {
    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.click(getSubmitButton());

    expect(await screen.findByText("Vui lòng nhập email")).toBeInTheDocument();
    expect(mocks.useAuthStore().signIn).not.toHaveBeenCalled();
  });

  it("hiển thị lỗi validate khi email sai định dạng", async () => {
    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    const emailInput = screen.getByPlaceholderText("tenban@example.com");
    await user.type(emailInput, "not-an-email");
    await user.type(screen.getByPlaceholderText("••••••••"), "matkhau123");
    // fireEvent.submit thay vì click nút submit — input type="email" khiến
    // jsdom tự chặn submit ở tầng constraint validation gốc trước khi
    // react-hook-form/Zod kịp chạy, nên bấm nút sẽ không bao giờ thấy message.
    fireEvent.submit(emailInput.closest("form")!);

    expect(await screen.findByText("Email không đúng định dạng")).toBeInTheDocument();
  });

  it("submit hợp lệ: gọi signIn với đúng email/password/rememberMe, toast success, đóng modal", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    mocks.useAuthStore.mockReturnValue(authStoreState({ signIn }));

    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.type(screen.getByPlaceholderText("tenban@example.com"), "user@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "matkhau123");
    await user.click(getSubmitButton());

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("user@example.com", "matkhau123", false)
    );
    await waitFor(() =>
      expect(mocks.notifySuccess).toHaveBeenCalledWith(
        "Đăng nhập thành công! Chào mừng bạn quay trở lại."
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("tick 'Ghi nhớ đăng nhập': gọi signIn với rememberMe = true", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    mocks.useAuthStore.mockReturnValue(authStoreState({ signIn }));

    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.type(screen.getByPlaceholderText("tenban@example.com"), "user@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "matkhau123");
    await user.click(screen.getByLabelText("Ghi nhớ đăng nhập"));
    await user.click(getSubmitButton());

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("user@example.com", "matkhau123", true)
    );
  });

  it("submit sai mật khẩu: hiển thị toast lỗi từ Supabase, modal vẫn mở", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error("Email hoặc mật khẩu không đúng."));
    mocks.useAuthStore.mockReturnValue(authStoreState({ signIn }));

    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.type(screen.getByPlaceholderText("tenban@example.com"), "user@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "sai-mat-khau");
    await user.click(getSubmitButton());

    await waitFor(() =>
      expect(mocks.notifyError).toHaveBeenCalledWith("Email hoặc mật khẩu không đúng.")
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("vô hiệu hoá nút submit + hiện 'Đang xử lý...' trong lúc chờ signIn", async () => {
    let resolveSignIn!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveSignIn = resolve;
    });
    const signIn = vi.fn().mockReturnValue(pending);
    mocks.useAuthStore.mockReturnValue(authStoreState({ signIn }));

    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    await user.type(screen.getByPlaceholderText("tenban@example.com"), "user@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "matkhau123");
    // Lấy reference TRƯỚC khi click — label nút đổi thành "Đang xử lý..."
    // ngay khi submit nên getSubmitButton() (tìm theo tên "Đăng nhập") sẽ
    // không còn match được nút này nữa sau đó.
    const submitButton = getSubmitButton();
    await user.click(submitButton);

    expect(await screen.findByText("Đang xử lý...")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    expect(screen.getByPlaceholderText("tenban@example.com")).toBeDisabled();

    resolveSignIn();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("toggle hiện/ẩn mật khẩu đổi type input và aria-label nút", async () => {
    const user = userEvent.setup();
    renderAuthModal();
    await screen.findByRole("dialog");

    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ẩn mật khẩu" })).toBeInTheDocument();
  });

  it("nút 'Quên mật khẩu?' đang bị vô hiệu hoá (chưa triển khai)", async () => {
    renderAuthModal();
    await screen.findByRole("dialog");

    expect(screen.getByRole("button", { name: "Quên mật khẩu?" })).toBeDisabled();
  });

  it("đã đăng nhập: hiện thông tin user + nút Đăng xuất thay vì form", async () => {
    mocks.useAuthStore.mockReturnValue(
      authStoreState({
        user: { email: "user@example.com", fullName: "Nguyễn Văn A", role: "user" },
        isLoggedIn: true,
      })
    );

    renderAuthModal();
    await screen.findByRole("dialog");

    expect(screen.queryByPlaceholderText("tenban@example.com")).not.toBeInTheDocument();
    // Email hiện 2 lần (subtitle header + khối thông tin tài khoản) — hợp lệ.
    expect(screen.getAllByText("user@example.com").length).toBe(2);
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeInTheDocument();
  });
});
