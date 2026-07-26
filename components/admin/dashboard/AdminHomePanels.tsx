"use client";

import type {
  AdminHomeAuditPreviewItem,
  AdminHomeUsersSnapshot,
} from "@/features/admin-dashboard/types";
import { AdminAccentLink } from "@/components/admin/ui/AdminAccentLink";
import { getUserInitials } from "@/lib/user-initials";
import { formatDate } from "@/lib/utils";

/**
 * 4 thẻ người dùng — Admin home (không pie), theo design mock.
 */
export function AdminHomeUsersPanel({
  users,
}: {
  users: AdminHomeUsersSnapshot;
}) {
  const cards = [
    { label: "Tổng người dùng", value: users.total },
    { label: "Mới 7 ngày", value: users.newLast7Days },
    { label: "Staff", value: users.staffCount },
    { label: "Admin", value: users.adminCount },
  ];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Người dùng</h2>
        <AdminAccentLink href="/admin/users">Quản lý</AdminAccentLink>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
        {cards.map((card) => (
          <li
            key={card.label}
            className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 shadow-sm"
          >
            <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase">
              {card.label}
            </p>
            <p className="font-display text-[clamp(24px,5vw,30px)] font-bold tracking-[-0.03em] text-ink">
              {card.value}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Audit gần đây — 1 card list (design mock).
 */
export function AdminHomeAuditPanel({
  recentAudit,
}: {
  recentAudit: AdminHomeAuditPreviewItem[];
}) {
  return (
    <section>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-ink/10 bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
            Nhật ký gần đây
          </h2>
          <AdminAccentLink href="/admin/audit">Xem tất cả</AdminAccentLink>
        </div>

        {recentAudit.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">
            Chưa có nhật ký.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {recentAudit.map((row, index) => {
              const initials = getUserInitials(
                null,
                row.actorEmail ?? "?",
              );
              return (
                <li
                  key={row.id}
                  className={
                    index < recentAudit.length - 1
                      ? "border-b border-ink/5"
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-extrabold text-primary-deep">
                      {initials}
                    </span>
                    <p className="min-w-0 flex-1 text-[13.5px] font-medium text-text-body">
                      {row.actorEmail ? (
                        <span className="font-bold text-ink">
                          {row.actorEmail}
                        </span>
                      ) : (
                        <span className="font-bold text-ink">Hệ thống</span>
                      )}{" "}
                      {row.summary}
                    </p>
                    <span className="shrink-0 text-[12px] font-semibold text-text-muted">
                      {formatDate(row.createdAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
