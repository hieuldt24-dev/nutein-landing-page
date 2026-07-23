"use client";

import type {
  AdminHomeAuditPreviewItem,
  AdminHomeUsersSnapshot,
} from "@/features/admin-dashboard/types";
import { formatDate } from "@/lib/utils";
import { DashboardPieChart } from "@/components/admin/dashboard/DashboardPieChart";
import { FillButton } from "@/components/ui/FillButton";

const ACTION_LABEL: Record<AdminHomeAuditPreviewItem["action"], string> = {
  CREATE: "Tạo",
  UPDATE: "Sửa",
  DELETE: "Xóa",
};

export function AdminHomeUsersPanel({
  users,
}: {
  users: AdminHomeUsersSnapshot;
}) {
  /** 4 thẻ cạnh pie — “Tổng” đã có ở tâm donut. */
  const cards = [
    { label: "Khách", value: users.userCount },
    { label: "Staff", value: users.staffCount },
    { label: "Admin", value: users.adminCount },
    { label: "Đã khóa", value: users.lockedCount },
  ];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Người dùng</h2>
        <FillButton
          href="/admin/users"
          variant="ink"
          className="h-10 px-4 text-[13px] font-bold"
        >
          Quản lý
        </FillButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div className="min-w-0 lg:h-full">
          <DashboardPieChart
            data={users.roleBreakdown}
            centerLabel="Tổng"
            className="h-full"
          />
        </div>
        <ul className="m-0 grid h-full list-none grid-cols-2 grid-rows-2 gap-2.5 p-0 sm:gap-3">
          {cards.map((card) => (
            <li
              key={card.label}
              className="flex min-h-0 flex-col justify-center rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5"
            >
              <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase sm:text-[12px]">
                {card.label}
              </p>
              <p className="mt-1.5 font-display text-[clamp(22px,5vw,32px)] font-bold tracking-[-0.03em] text-ink sm:mt-2">
                {card.value}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AdminHomeAuditPanel({
  recentAudit,
}: {
  recentAudit: AdminHomeAuditPreviewItem[];
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">
          Nhật ký gần đây
        </h2>
        <FillButton
          href="/admin/audit"
          variant="ink"
          className="h-10 px-4 text-[13px] font-bold"
        >
          Xem tất cả
        </FillButton>
      </div>

      {recentAudit.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-8 text-center text-sm text-text-muted">
          Chưa có nhật ký.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {recentAudit.map((row) => (
            <li
              key={row.id}
              className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">{row.summary}</p>
                  <p className="mt-0.5 truncate text-[12px] text-text-muted">
                    {row.actorEmail}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-primary-deep uppercase">
                    {ACTION_LABEL[row.action]}
                  </span>
                  <span className="text-[11px] font-semibold text-text-muted">
                    {formatDate(row.createdAt)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
