import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminNavGroup } from "./admin-nav.constants";

export function AdminNavGroups({
  groups,
  pathname,
  compactUi,
  onNavigate,
  onLogout,
}: {
  groups: AdminNavGroup[];
  pathname: string;
  /** true = chỉ hiện icon (compact + chưa hover expand). */
  compactUi: boolean;
  onNavigate?: () => void;
  onLogout?: () => void;
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
          <li>
            <button
              type="button"
              title={compactUi ? "Đăng xuất" : undefined}
              onClick={() => {
                onNavigate?.();
                onLogout?.();
              }}
              className={cn(
                "flex w-full cursor-pointer items-center rounded-[var(--radius-md)] text-[13px] font-bold text-danger transition-colors hover:bg-danger/10",
                compactUi ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5",
              )}
            >
              <LogOut
                size={18}
                strokeWidth={2.1}
                className="shrink-0 text-danger"
              />
              {!compactUi ? <span>Đăng xuất</span> : null}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
