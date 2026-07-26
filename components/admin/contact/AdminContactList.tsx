"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { ADMIN_CONTACT_SWR_KEY } from "@/features/admin-contact/constants";
import { adminContactService } from "@/features/admin-contact/services/admin-contact.service";
import type { AdminContactFilter } from "@/features/admin-contact/types";
import { cn, formatDate } from "@/lib/utils";

const FILTERS: { value: AdminContactFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unread", label: "Chưa đọc" },
  { value: "open", label: "Chưa xử lý" },
  { value: "handled", label: "Đã xử lý" },
];

function statusPill(m: {
  isRead: boolean;
  isHandled: boolean;
}): { label: string; className: string } {
  if (!m.isRead) {
    return { label: "Chưa đọc", className: "bg-primary-soft text-primary-deep" };
  }
  if (m.isHandled) {
    return { label: "Đã xử lý", className: "bg-lime/50 text-forest" };
  }
  return { label: "Chưa xử lý", className: "bg-ink/10 text-text-muted" };
}

export function AdminContactList() {
  const [filter, setFilter] = useState<AdminContactFilter>("all");

  const { data: allMessages } = useSWR(
    `${ADMIN_CONTACT_SWR_KEY}:all`,
    () => adminContactService.list("all"),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const key = useMemo(() => `${ADMIN_CONTACT_SWR_KEY}:${filter}`, [filter]);
  const { data, error, isLoading } = useSWR(
    key,
    () => adminContactService.list(filter),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const unreadCount = useMemo(
    () => allMessages?.filter((m) => !m.isRead).length ?? 0,
    [allMessages],
  );
  const openCount = useMemo(
    () => allMessages?.filter((m) => !m.isHandled).length ?? 0,
    [allMessages],
  );
  const totalCount = allMessages?.length ?? 0;

  const chipCount = (value: AdminContactFilter): number | null => {
    if (!allMessages) return null;
    if (value === "all") return totalCount;
    if (value === "unread") return unreadCount;
    if (value === "open") return openCount;
    return null;
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
        Liên hệ
      </h1>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((opt) => {
          const count = chipCount(opt.value);
          return (
            <AdminFilterChip
              key={opt.value}
              active={filter === opt.value}
              onClick={() => setFilter(opt.value)}
              className="h-9 text-[12.5px]"
            >
              {opt.label}
              {count !== null && opt.value !== "handled" ? ` · ${count}` : ""}
            </AdminFilterChip>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[20px] border border-ink/10 bg-border-subtle"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được hộp thư.
        </p>
      ) : null}

      {!isLoading && !error && data && data.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-text-muted">
          Chưa có liên hệ nào.
        </p>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((m) => {
            const pill = statusPill(m);
            return (
              <li key={m.id}>
                <Link
                  href={`/staff/contact/${m.id}`}
                  className="flex items-start gap-3 rounded-[20px] border border-ink/15 bg-surface px-3.5 py-3.5 transition-colors hover:border-ink/30 hover:bg-ink/[0.02] sm:gap-3.5 sm:px-4 sm:py-4 md:px-5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-[9px] shrink-0 rounded-full",
                      !m.isRead ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p
                        className={cn(
                          "text-[15px] text-ink",
                          m.isRead ? "font-semibold" : "font-extrabold",
                        )}
                      >
                        {m.name}
                      </p>
                      <span className="text-[12px] font-semibold text-text-muted sm:hidden">
                        {formatDate(m.createdAt, {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug text-text-body">
                      {m.message}
                    </p>
                    <span
                      className={cn(
                        "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase sm:hidden",
                        pill.className,
                      )}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                    <span className="text-[12px] font-semibold text-text-muted">
                      {formatDate(m.createdAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase",
                        pill.className,
                      )}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    strokeWidth={2.2}
                    className="mt-1 shrink-0 text-text-faint"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
