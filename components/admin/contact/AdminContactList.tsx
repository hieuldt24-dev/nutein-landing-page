"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ADMIN_CONTACT_SWR_KEY } from "@/features/admin-contact/constants";
import { adminContactService } from "@/features/admin-contact/services/admin-contact.service";
import type { AdminContactFilter } from "@/features/admin-contact/types";
import { formatDate } from "@/lib/utils";

export function AdminContactList() {
  const [filter, setFilter] = useState<AdminContactFilter>("all");
  const key = useMemo(() => `${ADMIN_CONTACT_SWR_KEY}:${filter}`, [filter]);
  const { data, error, isLoading } = useSWR(
    key,
    () => adminContactService.list(filter),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  return (
    <div>
      <label className="mb-4 flex w-fit flex-col gap-1 text-[13px] font-bold">
        Lọc
        <select
          className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value as AdminContactFilter)}
        >
          <option value="all">Tất cả</option>
          <option value="unread">Chưa đọc</option>
          <option value="open">Chưa xử lý</option>
          <option value="handled">Đã xử lý</option>
        </select>
      </label>
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-red-700">Không tải được hộp thư.</p>
      ) : null}
      {data ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((m) => (
            <li key={m.id}>
              <Link
                href={`/staff/contact/${m.id}`}
                className="block rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-4 py-4 hover:border-ink/30"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className={`text-[15px] ${m.isRead ? "font-semibold" : "font-bold"} text-ink`}>
                    {m.name}
                  </p>
                  <span className="text-[12px] text-text-muted">
                    {!m.isRead ? "Chưa đọc · " : ""}
                    {m.isHandled ? "Đã xử lý" : "Mở"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-text-muted">{m.message}</p>
                <p className="mt-1 text-[12px] text-text-muted">{formatDate(m.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
