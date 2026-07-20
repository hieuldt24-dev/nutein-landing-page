"use client";

import { useCallback, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { useAuthStore } from "@/lib/useAuthStore";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z
  .object({
    fullName: z.string().min(1, "Vui lòng nhập họ và tên"),
    email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: "Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-bold text-ink">{label}</label>
      {children}
      {error ? <span className="text-[12px] font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}

function TextInput({
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors",
        "placeholder:text-text-faint",
        "focus:border-primary",
        error ? "border-red-500" : "border-ink/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export default function AuthModal() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { user, isLoggedIn, signIn, signOut } = useAuthStore();
  const { data: isOpen } = useSWR("auth-modal", () => false, { fallbackData: false });

  const setIsOpen = useCallback(
    (val: boolean) => mutate("auth-modal", val, { revalidate: false }),
    [mutate]
  );

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    reset: resetLoginForm,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: signUpErrors },
    reset: resetSignUpForm,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeTerms: false,
    },
  });

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const onLogin = async (data: LoginFormValues) => {
    setIsSubmittingForm(true);
    try {
      // Mock auth — khi có API: đổi sang /api/auth/login rồi map user vào signIn.
      await new Promise((resolve) => setTimeout(resolve, 800));
      await signIn({ email: data.email });
      resetLoginForm();
      setIsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const onRegister = async (data: RegisterFormValues) => {
    setIsSubmittingForm(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      // Auto sign-in sau đăng ký (mock) — rồi vào /account bổ sung hồ sơ.
      await signIn({ email: data.email, fullName: data.fullName });
      resetSignUpForm();
      setIsOpen(false);
      router.push("/account");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const onLogoutFromModal = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <div
      id="auth-modal-root"
      className="fixed inset-0 z-[100] flex items-center justify-center p-5 md:p-8"
    >
      <div
        id="auth-modal-backdrop"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 cursor-pointer bg-ink/40"
      />

      <div
        id="auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="animate-fade-in relative z-10 flex w-full max-w-[420px] max-h-[min(920px,calc(100vh-2.5rem))] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-ink bg-bg shadow-xl"
      >
        <div className="relative border-b border-ink/15 px-6 pt-6 pb-5">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Đóng"
            className="group absolute top-5 right-5 z-[1] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-bg text-ink"
          >
            <X
              size={18}
              strokeWidth={2.2}
              className="transition-transform duration-300 ease-out group-hover:rotate-90"
            />
          </button>

          <div className="flex flex-col items-center px-8 text-center">
            <Image
              src="/images/logo-horizontal-2x_1.svg"
              alt="Nutein"
              width={180}
              height={48}
              className="mb-5 h-11 w-auto md:h-12"
              priority
            />
            <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-primary">
              Tài khoản Nutein
            </p>
            <h2
              id="auth-modal-title"
              className="font-display text-[22px] font-bold leading-tight tracking-[-0.03em] text-ink"
            >
              {isLoggedIn
                ? "Xin chào"
                : activeTab === "login"
                  ? "Chào mừng trở lại"
                  : "Tạo tài khoản mới"}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isLoggedIn
                ? user?.email || "Bạn đã đăng nhập."
                : activeTab === "login"
                  ? "Đăng nhập để theo dõi đơn hàng và ưu đãi."
                  : "Gia nhập cộng đồng sống lành cùng protein thực vật."}
            </p>
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="flex gap-6 border-b border-ink/15 px-6">
            {(
              [
                { id: "login", label: "Đăng nhập" },
                { id: "register", label: "Đăng ký" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={isSubmittingForm}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "cursor-pointer border-b-2 py-3 text-[14px] font-bold uppercase tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  activeTab === tab.id
                    ? "border-ink text-ink"
                    : "border-transparent text-text-muted hover:text-ink"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="overflow-y-auto px-6 py-6">
          {isLoggedIn ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-[var(--radius-md)] border border-ink/10 bg-surface px-4 py-3">
                {user?.fullName ? (
                  <p className="text-[15px] font-bold text-ink">{user.fullName}</p>
                ) : null}
                <p className="text-[13px] font-semibold text-text-muted">{user?.email}</p>
              </div>
              <FillButton
                type="button"
                variant="ink-solid"
                onClick={() => {
                  void onLogoutFromModal();
                }}
                className="h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
              >
                Đăng xuất
              </FillButton>
            </div>
          ) : activeTab === "login" ? (
            <form onSubmit={handleLoginSubmit(onLogin)} className="flex flex-col gap-4">
              <Field label="Email" error={loginErrors.email?.message}>
                <TextInput
                  type="email"
                  placeholder="tenban@example.com"
                  disabled={isSubmittingForm}
                  error={Boolean(loginErrors.email)}
                  {...registerLogin("email")}
                />
              </Field>

              <Field label="Mật khẩu" error={loginErrors.password?.message}>
                <div className="relative">
                  <TextInput
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    disabled={isSubmittingForm}
                    error={Boolean(loginErrors.password)}
                    className="pr-12"
                    {...registerLogin("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-text-muted hover:text-ink"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between gap-3 text-[13px]">
                <label className="flex cursor-pointer items-center gap-2 text-text-body">
                  <input
                    type="checkbox"
                    disabled={isSubmittingForm}
                    className="size-4 accent-[var(--color-primary)]"
                    {...registerLogin("rememberMe")}
                  />
                  Ghi nhớ đăng nhập
                </label>
                <button
                  type="button"
                  onClick={() => toast.info("Tính năng khôi phục mật khẩu đang được phát triển.")}
                  className="cursor-pointer font-bold text-primary-deep hover:text-primary"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <FillButton
                type="submit"
                variant="ink-solid"
                disabled={isSubmittingForm}
                className="mt-1 h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
              >
                {isSubmittingForm ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </FillButton>

              <div className="mt-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-ink/15" />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-faint">
                  Hoặc tiếp tục với
                </span>
                <div className="h-px flex-1 bg-ink/15" />
              </div>

              <FillButton
                type="button"
                variant="ink"
                onClick={() => toast.info("Đăng nhập bằng Google đang được tích hợp.")}
                className="h-11 w-full justify-center px-4 text-[13px] font-bold"
              >
                <GoogleIcon />
                Google
              </FillButton>
            </form>
          ) : (
            <form onSubmit={handleSignUpSubmit(onRegister)} className="flex flex-col gap-4">
              <Field label="Họ và tên" error={signUpErrors.fullName?.message}>
                <TextInput
                  type="text"
                  placeholder="Nguyễn Văn A"
                  disabled={isSubmittingForm}
                  error={Boolean(signUpErrors.fullName)}
                  {...registerSignUp("fullName")}
                />
              </Field>

              <Field label="Email" error={signUpErrors.email?.message}>
                <TextInput
                  type="email"
                  placeholder="tenban@example.com"
                  disabled={isSubmittingForm}
                  error={Boolean(signUpErrors.email)}
                  {...registerSignUp("email")}
                />
              </Field>

              <Field label="Mật khẩu" error={signUpErrors.password?.message}>
                <div className="relative">
                  <TextInput
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    disabled={isSubmittingForm}
                    error={Boolean(signUpErrors.password)}
                    className="pr-12"
                    {...registerSignUp("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-text-muted hover:text-ink"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <Field label="Xác nhận mật khẩu" error={signUpErrors.confirmPassword?.message}>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isSubmittingForm}
                  error={Boolean(signUpErrors.confirmPassword)}
                  {...registerSignUp("confirmPassword")}
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-text-body">
                  <input
                    type="checkbox"
                    disabled={isSubmittingForm}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                    {...registerSignUp("agreeTerms")}
                  />
                  <span>
                    Tôi đồng ý với{" "}
                    <button
                      type="button"
                      onClick={() => toast.info("Điều khoản dịch vụ đang được cập nhật.")}
                      className="cursor-pointer font-bold text-primary-deep hover:text-primary"
                    >
                      Điều khoản dịch vụ
                    </button>{" "}
                    &{" "}
                    <button
                      type="button"
                      onClick={() => toast.info("Chính sách bảo mật đang được cập nhật.")}
                      className="cursor-pointer font-bold text-primary-deep hover:text-primary"
                    >
                      Chính sách bảo mật
                    </button>
                  </span>
                </label>
                {signUpErrors.agreeTerms ? (
                  <span className="text-[12px] font-semibold text-red-600">
                    {signUpErrors.agreeTerms.message}
                  </span>
                ) : null}
              </div>

              <FillButton
                type="submit"
                variant="ink-solid"
                disabled={isSubmittingForm}
                className="mt-1 h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
              >
                {isSubmittingForm ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  "Đăng ký tài khoản"
                )}
              </FillButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.62 5.62 0 0 1 8.35 12.9a5.62 5.62 0 0 1 5.641-5.614c2.25 0 4.093 1.258 4.981 3.102l3.65-2.127C20.89 4.984 17.525 3 13.99 3c-4.978 0-9 4.029-9 9s4.022 9 9 9c4.8 0 8.01-3.238 8.01-7.854 0-.482-.047-.949-.13-1.396l-9.63.035z"
      />
    </svg>
  );
}
