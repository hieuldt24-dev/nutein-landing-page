"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  Mail,
  Menu,
  Newspaper,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/useAuthStore";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/UserAvatar";

const COMPACT_STORAGE_KEY = "nutein:admin-sidebar-compact";
const SIDEBAR_EXPANDED_W = 260;
const SIDEBAR_COMPACT_W = 72;
const NUTEIN_MARK_SRC = "/images/favicon-color-3232-10x_2.svg";

type NavIcon = typeof LayoutDashboard;

interface AdminNavItem {
  href: string;
  label: string;
  icon: NavIcon;
  match: (pathname: string) => boolean;
}

interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

const STAFF_NAV: AdminNavGroup[] = [
  {
    id: "ops",
    label: "Vận hành",
    items: [
      {
        href: "/admin",
        label: "Tổng quan",
        icon: LayoutDashboard,
        match: (p) => p === "/admin",
      },
      {
        href: "/admin/orders",
        label: "Đơn hàng",
        icon: ClipboardList,
        match: (p) => p.startsWith("/admin/orders"),
      },
      {
        href: "/admin/products",
        label: "Sản phẩm",
        icon: Package,
        match: (p) => p.startsWith("/admin/products"),
      },
      {
        href: "/admin/contact",
        label: "Liên hệ",
        icon: Mail,
        match: (p) => p.startsWith("/admin/contact"),
      },
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    items: [
      {
        href: "/admin/coupons",
        label: "Coupon",
        icon: Ticket,
        match: (p) => p.startsWith("/admin/coupons"),
      },
      {
        href: "/admin/blog",
        label: "Blog",
        icon: Newspaper,
        match: (p) => p.startsWith("/admin/blog"),
      },
      {
        href: "/admin/content",
        label: "Trang tĩnh",
        icon: FileText,
        match: (p) => p.startsWith("/admin/content"),
      },
    ],
  },
];

const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "system",
    label: "Hệ thống",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        match: (p) => p.startsWith("/admin/users"),
      },
      {
        href: "/admin/audit",
        label: "Audit",
        icon: ScrollText,
        match: (p) => p.startsWith("/admin/audit"),
      },
    ],
  },
];

function NavGroups({
  groups,
  pathname,
  compactUi,
  onNavigate,
}: {
  groups: AdminNavGroup[];
  pathname: string;
  /** true = chỉ hiện icon (compact + chưa hover expand). */
  compactUi: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn("flex flex-col gap-6", compactUi ? "px-2" : "px-3")}>
      {groups.map((group) => (
        <div key={group.id}>
          {!compactUi ? (
            <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase">
              {group.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={compactUi ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center rounded-[var(--radius-md)] text-[13px] font-bold transition-colors",
                      compactUi
                        ? "justify-center px-2 py-2.5"
                        : "gap-2.5 px-3 py-2.5",
                      active
                        ? "bg-primary-soft text-ink"
                        : "text-text-body hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    {active && !compactUi ? (
                      <span
                        aria-hidden
                        className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                      />
                    ) : null}
                    <Icon
                      size={18}
                      strokeWidth={2.1}
                      className={cn(
                        "shrink-0",
                        active ? "text-primary-deep" : "text-text-muted",
                      )}
                    />
                    {!compactUi ? <span>{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div>
        {!compactUi ? (
          <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase">
            Chung
          </p>
        ) : null}
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link
              href="/"
              title={compactUi ? "Về cửa hàng" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center rounded-[var(--radius-md)] text-[13px] font-bold text-text-body transition-colors hover:bg-ink/5 hover:text-ink",
                compactUi ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5",
              )}
            >
              <Home size={18} strokeWidth={2.1} className="shrink-0 text-text-muted" />
              {!compactUi ? <span>Về cửa hàng</span> : null}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

function SidebarBrand({
  homeHref,
  compactUi,
  compactMode,
  onToggleCompact,
}: {
  homeHref: string;
  compactUi: boolean;
  /** Trạng thái compact đã lưu (không phụ thuộc hover). */
  compactMode?: boolean;
  onToggleCompact?: () => void;
}) {
  const pressed = compactMode ?? compactUi;
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compactUi ? "justify-center" : "justify-between",
      )}
    >
      <Link
        href={homeHref}
        className={cn(
          "flex min-w-0 items-center gap-2",
          compactUi && "justify-center",
        )}
        title="Nutein Quản trị"
      >
        {compactUi ? (
          <Image
            src={NUTEIN_MARK_SRC}
            alt="Nutein"
            width={32}
            height={32}
            className="size-8"
            priority
          />
        ) : (
          <>
            <Image
              src="/images/logo-horizontal-2x_1.svg"
              alt="Nutein"
              width={112}
              height={28}
              className="h-7 w-auto"
              priority
            />
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-primary-deep uppercase">
              Admin
            </span>
          </>
        )}
      </Link>

      {onToggleCompact && !compactUi ? (
        <button
          type="button"
          onClick={onToggleCompact}
          aria-label={pressed ? "Tắt compact mode" : "Bật compact mode"}
          aria-pressed={pressed}
          title={pressed ? "Tắt compact" : "Bật compact"}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:bg-ink/5"
        >
          {pressed ? (
            <PanelLeftOpen size={16} strokeWidth={2.2} />
          ) : (
            <PanelLeftClose size={16} strokeWidth={2.2} />
          )}
        </button>
      ) : null}
    </div>
  );
}

function SidebarUserCard({
  email,
  roleLabel,
  compactUi,
}: {
  email: string;
  roleLabel: string;
  compactUi: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-ink/10 bg-bg",
        compactUi ? "flex justify-center px-2 py-3" : "px-3 py-3",
      )}
      title={compactUi ? `${roleLabel} · ${email}` : undefined}
    >
      <div className={cn("flex items-center gap-3", compactUi && "justify-center")}>
        <UserAvatar email={email} size="md" />
        {!compactUi ? (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-ink">{roleLabel}</p>
            <p className="truncate text-[11px] text-text-muted">{email || "—"}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shell quản trị — compact giữ chỗ layout; hover mở rộng overlay.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, role } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hoverExpand, setHoverExpand] = useState(false);

  const groups = role === "admin" ? ADMIN_NAV : STAFF_NAV;
  const roleLabel =
    role === "admin" ? "Admin" : role === "staff" ? "Staff" : "User";
  const homeHref = role === "admin" ? "/admin/users" : "/admin";

  /** Compact đã bật nhưng đang hover → UI đầy đủ, layout vẫn 72px. */
  const compactUi = compact && !hoverExpand;
  const panelExpanded = !compact || hoverExpand;

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
        <NavGroups
          groups={groups}
          pathname={pathname}
          compactUi={isCompactUi}
          onNavigate={onNavigate}
        />
      </div>

      <div className={cn("border-t border-ink/10 py-4", isCompactUi ? "px-2" : "px-4")}>
        <SidebarUserCard
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
            <SidebarBrand
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
              <SidebarBrand homeHref={homeHref} compactUi={false} />
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
        "mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 md:py-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
