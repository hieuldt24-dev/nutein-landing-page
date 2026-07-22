"use client";

import { useEffect } from "react";
import useSWR from "swr";
import {
  ACCOUNT_LOGGING_OUT_SWR_KEY,
  OPEN_AUTH_MODAL_STORAGE_KEY,
} from "@/features/account/constants";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Guard account — không mở AuthModal tại đây (tránh race logout → home + modal).
 *
 * - Guest vào /account*: ghi sessionStorage rồi hard về `/`; AuthModal trên
 *   home đọc flag và mở.
 * - Logout (cờ account-logging-out): hard về `/`, không ghi flag → không modal.
 * - Đã login: children.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, isReady } = useAuthStore();
  const { data: isLoggingOut } = useSWR<boolean>(
    ACCOUNT_LOGGING_OUT_SWR_KEY,
    () => false,
    {
      fallbackData: false,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  useEffect(() => {
    if (!isReady || isLoggedIn) return;

    if (isLoggingOut) {
      window.location.replace("/");
      return;
    }

    try {
      sessionStorage.setItem(OPEN_AUTH_MODAL_STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
    window.location.replace("/");
  }, [isReady, isLoggedIn, isLoggingOut]);

  if (!isReady) {
    return (
      <div className="mx-auto max-w-[960px] px-6 pt-28 pb-16 md:pt-32">
        <div className="h-10 w-48 animate-pulse rounded-md bg-ink/5" />
        <div className="mt-6 h-40 animate-pulse rounded-[var(--radius-lg)] bg-ink/5" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <div className="min-h-[40vh]" aria-hidden />;
  }

  return children;
}
