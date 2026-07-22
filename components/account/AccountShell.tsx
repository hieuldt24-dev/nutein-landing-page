"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSWRConfig } from "swr";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCOUNT_LOGGING_OUT_SWR_KEY, OPEN_AUTH_MODAL_STORAGE_KEY } from "@/features/account/constants";
import { useAuthStore } from "@/lib/useAuthStore";
import { useAccountProfile } from "@/lib/useAccountProfile";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { notify } from "@/lib/toast";

const TABS = [
  {
    href: "/account",
    label: "Hồ sơ",
    match: (path: string) => path === "/account",
  },
  {
    href: "/account/addresses",
    label: "Địa chỉ",
    match: (path: string) => path.startsWith("/account/addresses"),
  },
  {
    href: "/account/orders",
    label: "Đơn hàng",
    match: (path: string) => path.startsWith("/account/orders"),
  },
] as const;

interface AccountShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

/**
 * Shell tab Hồ sơ / Địa chỉ / Đơn hàng / Đăng xuất — account portal.
 */
export function AccountShell({ children, title, description }: AccountShellProps) {
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const { signOut, user } = useAuthStore();
  const { profile } = useAccountProfile();
  const displayName = profile?.fullName || user?.fullName;

  const handleLogout = async () => {
    // Bật cờ TRƯỚC signOut — layout guest-guard không ghi open-auth flag.
    await mutate(ACCOUNT_LOGGING_OUT_SWR_KEY, true, { revalidate: false });
    try {
      sessionStorage.removeItem(OPEN_AUTH_MODAL_STORAGE_KEY);
    } catch {
      /* private mode */
    }
    await signOut();
    notify.success("Đã đăng xuất.");
    window.location.replace("/");
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 pt-28 pb-16 md:px-10 md:pt-32 md:pb-20">
      <header className="mb-8 md:mb-10">
        <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
          Tài khoản
        </p>
        <div className="mt-3 flex items-start gap-4">
          <UserAvatar
            fullName={displayName}
            email={user?.email}
            size="lg"
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em] text-ink">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-[520px] text-[15px] text-text-muted">{description}</p>
            ) : null}
            {user?.email ? (
              <p className="mt-1 text-[13px] font-medium text-text-muted">{user.email}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-ink/10 pb-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-bold transition-colors",
                active
                  ? "bg-ink text-bg"
                  : "bg-transparent text-ink/70 hover:bg-ink/5 hover:text-ink"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <LogOut size={15} strokeWidth={2.2} />
          Đăng xuất
        </button>
      </div>

      {children}
    </div>
  );
}
