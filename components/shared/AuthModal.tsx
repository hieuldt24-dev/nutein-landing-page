"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { notify } from "@/lib/toast";
import { Loader2, X } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { useAuthStore } from "@/lib/useAuthStore";
import {
  AUTH_MODAL_OPTIONS_DEFAULT,
  AUTH_MODAL_OPTIONS_SWR_KEY,
  AUTH_MODAL_SWR_KEY,
  type AuthModalOptions,
} from "@/features/auth/constants";
import { OPEN_AUTH_MODAL_STORAGE_KEY } from "@/features/account/constants";
import { closeAuthModal } from "@/lib/openAuthModal";

export default function AuthModal() {
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const { isLoggedIn, signInWithGoogle } = useAuthStore();
  // revalidateOnMount/OnFocus/OnReconnect: false — key này chỉ là cờ mở/đóng
  // UI (SWR-as-store), không phải server data. Không tắt sẽ có nguy cơ race
  // giống useAuthStore: fetcher no-op tự chạy lại (VD mỗi lần tab focus lại)
  // rồi ghi đè `true` thật về `false`, tự đóng modal ngoài ý muốn.
  const { data: isOpen } = useSWR(AUTH_MODAL_SWR_KEY, () => false, {
    fallbackData: false,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: modalOptions } = useSWR<AuthModalOptions>(
    AUTH_MODAL_OPTIONS_SWR_KEY,
    () => AUTH_MODAL_OPTIONS_DEFAULT,
    {
      fallbackData: AUTH_MODAL_OPTIONS_DEFAULT,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const setIsOpen = useCallback(
    (val: boolean) => {
      if (val) {
        void mutate(AUTH_MODAL_SWR_KEY, true, { revalidate: false });
      } else {
        closeAuthModal(mutate);
      }
    },
    [mutate],
  );

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const returnToRef = useRef<string | null>(null);
  const appliedOpenRef = useRef(false);

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

  // Modal chỉ dành cho đăng nhập — đã login thì đóng (tránh panel "Xin chào"
  // + email trùng + Đăng xuất; tài khoản quản lý qua /account).
  useEffect(() => {
    if (isOpen && isLoggedIn) setIsOpen(false);
  }, [isOpen, isLoggedIn, setIsOpen]);

  // Guest bị chặn ở /account* → layout ghi flag rồi về `/`; mở modal 1 lần tại home.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(OPEN_AUTH_MODAL_STORAGE_KEY) !== "1") return;
      sessionStorage.removeItem(OPEN_AUTH_MODAL_STORAGE_KEY);
      setIsOpen(true);
    } catch {
      /* private mode */
    }
  }, [setIsOpen]);

  // Áp options mỗi lần mở modal (returnTo).
  useEffect(() => {
    if (!isOpen) {
      appliedOpenRef.current = false;
      return;
    }
    if (appliedOpenRef.current) return;
    appliedOpenRef.current = true;

    const opts = modalOptions ?? AUTH_MODAL_OPTIONS_DEFAULT;
    returnToRef.current = opts.returnTo;
  }, [isOpen, modalOptions]);

  if (!isOpen) return null;

  const resolveAfterAuthPath = (): string | null => {
    const fromOptions = returnToRef.current;
    if (fromOptions) return fromOptions;
    if (pathname?.startsWith("/checkout")) return "/checkout";
    return null;
  };

  // Redirect toàn trang sang Google — session thật lấy về qua app/auth/callback/route.ts
  // (xem sanitizeAuthReturnTo).
  const onGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const next = resolveAfterAuthPath() ?? "/";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      await signInWithGoogle(redirectTo);
      // Thành công: trình duyệt redirect sang Google ngay, không cần setIsOpen(false).
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Không thể đăng nhập bằng Google.");
      setIsGoogleLoading(false);
    }
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
              Chào mừng trở lại
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Đăng nhập để theo dõi đơn hàng và ưu đãi.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <FillButton
            type="button"
            variant="ink-solid"
            disabled={isGoogleLoading}
            onClick={() => {
              void onGoogleLogin();
            }}
            className="h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
          >
            {isGoogleLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Tiếp tục với Google
          </FillButton>
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
