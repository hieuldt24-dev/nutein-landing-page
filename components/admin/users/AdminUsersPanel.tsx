"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { AdminListPagination } from "@/components/admin/ui/AdminListPagination";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ADMIN_LIST_PAGE_SIZE } from "@/lib/admin-list-query";
import { ADMIN_USERS_SWR_KEY } from "@/features/admin-users/constants";
import { adminUsersService } from "@/features/admin-users/services/admin-users.service";
import type { AuthRole } from "@/features/auth/types";
import { revalidateAfterUserMutation } from "@/lib/admin-swr-revalidate";
import { notify } from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/lib/useAuthStore";

const ROLES: { value: AuthRole | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "user", label: "Khách" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
];

const ROLE_LABEL: Record<AuthRole, string> = {
  user: "Khách",
  staff: "Staff",
  admin: "Admin",
};

export function AdminUsersPanel() {
  const { user: currentUser } = useAuthStore();
  const { mutate: globalMutate } = useSWRConfig();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<AuthRole | "all">("all");
  const [page, setPage] = useState(0);
  const key = useMemo(
    () => `${ADMIN_USERS_SWR_KEY}:${q}:${role}:${page}`,
    [q, role, page],
  );
  const { data, error, isLoading } = useSWR(
    key,
    () =>
      adminUsersService.list({
        q,
        role,
        limit: ADMIN_LIST_PAGE_SIZE,
        offset: page * ADMIN_LIST_PAGE_SIZE,
      }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  // Chip count chỉ cần `total` — gọi `limit: 1` để không kéo về nguyên bảng.
  const { data: counts } = useSWR(
    `${ADMIN_USERS_SWR_KEY}:counts`,
    async () => {
      const [all, staff, admin] = await Promise.all([
        adminUsersService.list({ role: "all", limit: 1 }),
        adminUsersService.list({ role: "staff", limit: 1 }),
        adminUsersService.list({ role: "admin", limit: 1 }),
      ]);
      return { all: all.total, staff: staff.total, admin: admin.total };
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const roleCounts = useMemo(
    () => ({
      all: counts?.all ?? 0,
      user: 0,
      staff: counts?.staff ?? 0,
      admin: counts?.admin ?? 0,
    }),
    [counts],
  );

  const changeRole = async (id: string, next: AuthRole) => {
    try {
      await adminUsersService.setRole(id, next);
      await revalidateAfterUserMutation(globalMutate);
      notify.success("Đã cập nhật vai trò.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    }
  };

  const toggleLock = async (id: string, locked: boolean) => {
    try {
      await adminUsersService.setLocked(id, !locked);
      await revalidateAfterUserMutation(globalMutate);
      notify.success(locked ? "Đã mở khóa." : "Đã khóa tài khoản.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5">
        <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
          Người dùng
        </h1>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((opt) => (
            <AdminFilterChip
              key={opt.value}
              active={role === opt.value}
              onClick={() => {
                setRole(opt.value);
                setPage(0);
              }}
            >
              {opt.label}
              {opt.value === "staff" || opt.value === "admin"
                ? ` · ${roleCounts[opt.value]}`
                : opt.value === "all"
                  ? ` · ${roleCounts.all}`
                  : ""}
            </AdminFilterChip>
          ))}
        </div>
        <label className="relative ml-auto min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Tìm email hoặc tên</span>
          <input
            className="h-10 w-full rounded-full border border-ink/15 bg-surface px-4 text-[14px] font-medium text-ink placeholder:text-text-faint"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Email hoặc tên…"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[20px] border border-ink/10 bg-border-subtle" />
      ) : null}
      {error ? (
        <p className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được danh sách người dùng.
        </p>
      ) : null}
      {data && items.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-text-muted">
          Không tìm thấy người dùng.
        </p>
      ) : null}
      {data && items.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((u) => {
            const isSelf =
              Boolean(currentUser?.email) && u.email === currentUser?.email;
            return (
              <li
                key={u.id}
                className={cn(
                  "rounded-[20px] border border-ink/10 bg-surface px-4 py-4 shadow-sm md:px-5",
                  u.locked && "opacity-75",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      fullName={u.fullName}
                      email={u.email}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-ink">
                        {u.fullName}
                        {isSelf ? (
                          <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-primary-deep uppercase">
                            Bạn
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[13px] text-text-muted">
                        {u.email} · tham gia {formatDate(u.createdAt)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-primary-deep uppercase">
                          {ROLE_LABEL[u.role]}
                        </span>
                        {u.locked ? (
                          <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-danger uppercase">
                            Đã khóa
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isSelf ? (
                      <span
                        title="Không thể tự đổi vai trò của chính mình"
                        className="rounded-full border border-ink/10 bg-border-subtle px-3 py-1.5 text-[12px] font-bold text-text-muted"
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    ) : (
                      <select
                        className="h-9 rounded-full border border-ink/20 bg-bg px-3 text-[13px] font-bold text-ink"
                        value={u.role}
                        onChange={(e) =>
                          void changeRole(u.id, e.target.value as AuthRole)
                        }
                      >
                        <option value="user">Khách</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    {isSelf ? (
                      <span
                        title="Không thể tự khóa tài khoản của chính mình"
                        className="rounded-full border border-ink/10 bg-border-subtle px-3 py-1.5 text-[12px] font-bold text-text-muted"
                      >
                        Khóa
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void toggleLock(u.id, u.locked)}
                        className={cn(
                          "h-9 cursor-pointer rounded-full px-3.5 text-[12px] font-bold",
                          u.locked
                            ? "bg-danger text-bg hover:opacity-90"
                            : "border border-danger/40 text-danger hover:bg-danger/10",
                        )}
                      >
                        {u.locked ? "Mở khóa" : "Khóa"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {data && total > 0 ? (
        <div className="mt-4">
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
