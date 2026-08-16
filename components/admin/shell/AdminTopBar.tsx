"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  ADMIN_NAV,
  STAFF_NAV,
  type AdminNavGroup,
  type AdminNavItem,
} from "./admin-nav.constants";

function resolveNav(
  groups: AdminNavGroup[],
  pathname: string,
): { group: AdminNavGroup; item: AdminNavItem } | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.match(pathname)) {
        return { group, item };
      }
    }
  }
  return null;
}

function formatTodayLabel(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("vi-VN", { weekday: "long" });
  const day = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${day}`;
}

/**
 * Top bar sticky — breadcrumb desktop, hamburger + title mobile (design mock).
 */
export function AdminTopBar({
  role,
  fullName,
  email,
  onOpenMobile,
}: {
  role: string | null;
  fullName?: string | null;
  email: string;
  onOpenMobile: () => void;
}) {
  const pathname = usePathname();
  const groups = role === "admin" ? ADMIN_NAV : STAFF_NAV;
  const resolved = resolveNav(groups, pathname);
  const pageTitle = resolved?.item.label ?? "Tổng quan";
  const groupLabel = resolved?.group.label;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink/10 bg-bg/95 px-4 backdrop-blur-sm sm:h-[60px] md:px-8">
      <div className="flex min-w-0 items-center gap-2 lg:gap-2">
        <button
          type="button"
          className="-ml-1.5 flex size-11 cursor-pointer items-center justify-center rounded-full text-ink lg:hidden"
          aria-label="Mở menu quản trị"
          onClick={onOpenMobile}
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>

        {/* Desktop breadcrumb — mobile dùng H1 trong trang */}
        <nav
          aria-label="Đường dẫn"
          className="hidden min-w-0 items-center gap-2 lg:flex"
        >
          {groupLabel ? (
            <>
              <span className="truncate text-[13px] font-semibold text-text-muted">
                {groupLabel}
              </span>
              <span className="text-[13px] font-semibold text-text-faint">/</span>
            </>
          ) : null}
          <span className="truncate text-[13px] font-bold text-ink">
            {pageTitle}
          </span>
        </nav>
        <span className="sr-only lg:hidden">{pageTitle}</span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-[13px] font-semibold text-text-body sm:inline">
          {formatTodayLabel()}
        </span>
        <div className="lg:hidden">
          <UserAvatar fullName={fullName} email={email} size="sm" />
        </div>
      </div>
    </header>
  );
}
