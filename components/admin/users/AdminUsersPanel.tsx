"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ADMIN_USERS_SWR_KEY } from "@/features/admin-users/constants";
import { adminUsersService } from "@/features/admin-users/services/admin-users.service";
import type { AuthRole } from "@/features/auth/types";
import { notify } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

export function AdminUsersPanel() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<AuthRole | "all">("all");
  const key = useMemo(() => `${ADMIN_USERS_SWR_KEY}:${q}:${role}`, [q, role]);
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => adminUsersService.list({ q, role }),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const changeRole = async (id: string, next: AuthRole) => {
    try {
      await adminUsersService.setRole(id, next);
      await mutate();
      notify.success("Đã cập nhật vai trò.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    }
  };

  const toggleLock = async (id: string, locked: boolean) => {
    try {
      await adminUsersService.setLocked(id, !locked);
      await mutate();
      notify.success(locked ? "Đã mở khóa." : "Đã khóa tài khoản.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-bold">
          Tìm kiếm
          <input
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email hoặc tên"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">
          Vai trò
          <select
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as AuthRole | "all")}
          >
            <option value="all">Tất cả</option>
            <option value="user">User</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-red-700">Không tải được users.</p>
      ) : null}
      {data ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((u) => (
            <li
              key={u.id}
              className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">{u.fullName}</p>
                  <p className="text-[13px] text-text-muted">
                    {u.email} · {formatDate(u.createdAt)}
                    {u.locked ? " · Đã khóa" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-2 py-1.5 text-[13px] font-bold"
                    value={u.role}
                    onChange={(e) =>
                      void changeRole(u.id, e.target.value as AuthRole)
                    }
                  >
                    <option value="user">user</option>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void toggleLock(u.id, u.locked)}
                    className="cursor-pointer rounded-full border border-ink/20 px-3 py-1.5 text-[12px] font-bold"
                  >
                    {u.locked ? "Mở khóa" : "Khóa"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
