"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ADMIN_AUDIT_SWR_KEY } from "@/features/admin-audit/constants";
import { adminAuditService } from "@/features/admin-audit/services/admin-audit.service";
import type { AdminAuditAction } from "@/features/admin-audit/types";
import { formatDate } from "@/lib/utils";

export function AdminAuditPanel() {
  const [action, setAction] = useState<AdminAuditAction | "all">("all");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const key = useMemo(
    () => `${ADMIN_AUDIT_SWR_KEY}:${action}:${actor}:${from}:${to}`,
    [action, actor, from, to]
  );
  const { data, error, isLoading } = useSWR(
    key,
    () => adminAuditService.list({ action, actor, from: from || undefined, to: to || undefined }),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-bold">
          Thao tác
          <select
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
            value={action}
            onChange={(e) => setAction(e.target.value as AdminAuditAction | "all")}
          >
            <option value="all">Tất cả</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">
          Actor email
          <input
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">
          Từ
          <input
            type="date"
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">
          Đến
          <input
            type="date"
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-red-700">Không tải được audit log.</p>
      ) : null}
      {data ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((row) => (
            <li
              key={row.id}
              className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-4 py-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-bold text-ink">
                  {row.action} · {row.tableName}
                </p>
                <span className="text-[12px] text-text-muted">
                  {formatDate(row.createdAt, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-text-muted">{row.summary}</p>
              <p className="mt-1 text-[12px] text-text-muted">
                {row.actorEmail} · record {row.recordId}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
