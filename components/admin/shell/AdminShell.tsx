"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuthStore } from "@/lib/useAuthStore";
import { useAccountProfile } from "@/lib/useAccountProfile";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
import { ADMIN_NAV, STAFF_NAV } from "./admin-nav.constants";
import { AdminNavGroups } from "./AdminNavGroups";
import { AdminSidebarBrand } from "./AdminSidebarBrand";
import { AdminSidebarUserCard } from "./AdminSidebarUserCard";

const COMPACT_STORAGE_KEY = "nutein:admin-sidebar-compact";
const SIDEBAR_EXPANDED_W = 260;
const SIDEBAR_COMPACT_W = 72;

/**
 * Shell quản trị — compact giữ chỗ layout; hover mở rộng overlay.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, role, signOut } = useAuthStore();
  const { profile } = useAccountProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hoverExpand, setHoverExpand] = useState(false);

  const groups = role === "admin" ? ADMIN_NAV : STAFF_NAV;
  const roleLabel =
    role === "admin" ? "Admin" : role === "staff" ? "Staff" : "User";
  const homeHref = role === "admin" ? "/admin" : "/staff";
  const displayName = profile?.fullName || user?.fullName;

  /** Compact đã bật nhưng đang hover → UI đầy đủ, layout vẫn 72px. */
  const compactUi = compact && !hoverExpand;
  const panelExpanded = !compact || hoverExpand;

  const handleLogout = async () => {
    await signOut();
    notify.success("Đã đăng xuất.");
    window.location.replace("/");
  };

  useEffect(() => {
    try {
      setCompact(window.localStorage.getItem(COMPACT_STORAGE_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!compact) setHoverExpand(false);
  }, [compact]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const toggleCompact = () => {
    setCompact((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COMPACT_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const sidebarBody = (isCompactUi: boolean, onNavigate?: () => void) => (
    <>
      <div className="flex-1 overflow-y-auto py-5">
        <AdminNavGroups
          groups={groups}
          pathname={pathname}
          compactUi={isCompactUi}
          onNavigate={onNavigate}
          onLogout={() => {
            void handleLogout();
          }}
        />
      </div>

      <div className={cn("border-t border-ink/10 py-4", isCompactUi ? "px-2" : "px-4")}>
        <AdminSidebarUserCard
          fullName={displayName}
          email={user?.email ?? ""}
          roleLabel={roleLabel}
          compactUi={isCompactUi}
        />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg text-text-body">
      {/* Desktop: spacer giữ layout khi compact; panel có thể overlay khi hover */}
      <div
        className="relative hidden shrink-0 lg:block"
        style={{
          width: compact ? SIDEBAR_COMPACT_W : SIDEBAR_EXPANDED_W,
        }}
      >
        <aside
          onMouseEnter={() => {
            if (compact) setHoverExpand(true);
          }}
          onMouseLeave={() => setHoverExpand(false)}
          className={cn(
            "sticky top-0 flex h-screen flex-col border-r border-ink/10 bg-surface transition-[width,box-shadow] duration-200 ease-out",
            compact && "absolute top-0 left-0 z-40",
            panelExpanded ? "w-[260px]" : "w-[72px]",
            compact && hoverExpand && "shadow-lg",
          )}
        >
          <div
            className={cn(
              "border-b border-ink/10 py-4",
              compactUi ? "px-2" : "px-4",
            )}
          >
            <AdminSidebarBrand
              homeHref={homeHref}
              compactUi={compactUi}
              compactMode={compact}
              onToggleCompact={toggleCompact}
            />
          </div>
          {sidebarBody(compactUi)}
        </aside>
      </div>

      <button
        type="button"
        className="fixed top-4 left-4 z-40 flex size-11 cursor-pointer items-center justify-center rounded-full border border-ink/15 bg-surface text-ink shadow-md lg:hidden"
        aria-label="Mở menu quản trị"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} strokeWidth={2.2} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-ink/40"
            onClick={closeMobile}
          />
          <aside className="absolute top-0 left-0 flex h-full w-[min(100%,280px)] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
              <AdminSidebarBrand homeHref={homeHref} compactUi={false} />
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Đóng"
                className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-ink/15 text-ink"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            {sidebarBody(false, closeMobile)}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pt-14 lg:pt-0">{children}</main>
      </div>
    </div>
  );
}

/** Khung nội dung trang admin. */
export function AdminPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1100px] px-4 py-5 pb-10 md:px-8 md:py-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
