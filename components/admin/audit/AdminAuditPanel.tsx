"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { AdminListPagination } from "@/components/admin/ui/AdminListPagination";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ADMIN_AUDIT_SWR_KEY } from "@/features/admin-audit/constants";
import { adminAuditService } from "@/features/admin-audit/services/admin-audit.service";
import type { AdminAuditAction } from "@/features/admin-audit/types";
import {
  ADMIN_LIST_PAGE_SIZE,
  defaultLast7DaysRange,
} from "@/lib/admin-list-query";
import { formatDate } from "@/lib/utils";

const ACTIONS: { value: AdminAuditAction | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "CREATE", label: "Tạo" },
  { value: "UPDATE", label: "Sửa" },
  { value: "DELETE", label: "Xóa" },
];

const ACTION_LABEL: Record<AdminAuditAction, string> = {
  CREATE: "Tạo",
  UPDATE: "Sửa",
  DELETE: "Xóa",
};

export function AdminAuditPanel() {
  const defaultRange = useMemo(() => defaultLast7DaysRange(), []);
  const [action, setAction] = useState<AdminAuditAction | "all">("all");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [page, setPage] = useState(0);

  const key = useMemo(
    () =>
      `${ADMIN_AUDIT_SWR_KEY}:${action}:${actor}:${from}:${to}:${page}:${ADMIN_LIST_PAGE_SIZE}`,
    [action, actor, from, to, page],
  );
  const { data, error, isLoading } = useSWR(
    key,
    () =>
      adminAuditService.list({
        action,
        actor: actor.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: ADMIN_LIST_PAGE_SIZE,
        offset: page * ADMIN_LIST_PAGE_SIZE,
      }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <h1 className="mb-5 font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
        Nhật ký
      </h1>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((opt) => (
            <AdminFilterChip
              key={opt.value}
              active={action === opt.value}
              onClick={() => {
                setAction(opt.value);
                setPage(0);
              }}
            >
              {opt.label}
            </AdminFilterChip>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <input
            className="h-10 w-full rounded-full border border-ink/15 bg-surface px-4 text-[14px] font-medium text-ink placeholder:text-text-faint sm:max-w-xs"
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(0);
            }}
            placeholder="Email người thao tác…"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
            <input
              type="date"
              className="h-10 w-full rounded-[var(--radius-md)] border border-ink/15 bg-surface px-3 text-[14px] font-medium text-ink"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
              aria-label="Từ ngày"
            />
            <input
              type="date"
              className="h-10 w-full rounded-[var(--radius-md)] border border-ink/15 bg-surface px-3 text-[14px] font-medium text-ink"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(0);
              }}
              aria-label="Đến ngày"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle" />
      ) : null}
      {error ? (
        <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được nhật ký.
        </p>
      ) : null}
      {!isLoading && !error && items.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-text-muted">
          Không có nhật ký phù hợp.
        </p>
      ) : null}
      {!isLoading && !error && items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <ul className="m-0 overflow-hidden rounded-[var(--radius-lg)] border border-ink/10 bg-surface p-0 shadow-sm">
            {items.map((row, index) => (
              <li
                key={row.id}
                className={
                  index < items.length - 1 ? "border-b border-ink/5" : undefined
                }
              >
                <div className="flex items-start gap-3 px-4 py-3.5 md:px-5">
                  <UserAvatar
                    fullName={null}
                    email={row.actorEmail}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          row.action === "CREATE"
                            ? "rounded-full bg-lime/50 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-forest uppercase"
                            : row.action === "DELETE"
                              ? "rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-danger uppercase"
                              : "rounded-full bg-sky/50 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-ink uppercase"
                        }
                      >
                        {ACTION_LABEL[row.action]}
                      </span>
                      <span className="text-[12px] font-semibold text-text-muted">
                        {formatDate(row.createdAt, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-[13.5px] font-medium text-ink">
                      {row.summary}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {row.actorEmail ?? "Hệ thống"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <AdminListPagination
            page={page}
            pageSize={ADMIN_LIST_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
