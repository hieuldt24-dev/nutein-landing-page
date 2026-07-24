"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { AdminOrderStatusBadge } from "@/components/admin/orders/AdminOrderStatusBadge";
import { ADMIN_ORDER_STATUS_LABEL, ADMIN_ORDERS_SWR_KEY } from "@/features/admin-orders/constants";
import { adminOrdersService } from "@/features/admin-orders/services/admin-orders.service";
import type { AdminOrderStatusFilter } from "@/features/admin-orders/types";
import { formatCurrencyVnd, formatDate } from "@/lib/utils";

const STATUS_FILTERS: { value: AdminOrderStatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  ...(Object.entries(ADMIN_ORDER_STATUS_LABEL) as [Exclude<AdminOrderStatusFilter, "all">, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-[color:var(--color-border-subtle)]"
        />
      ))}
    </div>
  );
}

/**
 * S3 — danh sách đơn + lọc trạng thái / khoảng ngày.
 * Chỉ gọi service (không import mock).
 */
export function AdminOrdersList() {
  const [status, setStatus] = useState<AdminOrderStatusFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const swrKey = useMemo(
    () => `${ADMIN_ORDERS_SWR_KEY}:${status}:${from}:${to}`,
    [from, status, to]
  );

  const { data, error, isLoading } = useSWR(
    swrKey,
    () =>
      adminOrdersService.list({
        status,
        from: from || undefined,
        to: to || undefined,
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[160px] flex-col gap-1.5 text-[13px] font-bold text-ink">
          Trạng thái
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminOrderStatusFilter)}
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2 text-[14px] font-medium text-ink"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[150px] flex-col gap-1.5 text-[13px] font-bold text-ink">
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2 text-[14px] font-medium text-ink"
          />
        </label>
        <label className="flex min-w-[150px] flex-col gap-1.5 text-[13px] font-bold text-ink">
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2 text-[14px] font-medium text-ink"
          />
        </label>
      </div>

      {isLoading ? <ListSkeleton /> : null}

      {!isLoading && error ? (
        <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được danh sách đơn. Thử tải lại trang.
        </p>
      ) : null}

      {!isLoading && !error && data && data.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-ink/20 px-5 py-8 text-center text-sm text-text-muted">
          Không có đơn phù hợp bộ lọc.
        </p>
      ) : null}

      {!isLoading && !error && data && data.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((order) => (
            <li key={order.id}>
              <Link
                href={`/staff/orders/${order.id}`}
                className="block rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-4 py-4 transition-colors hover:border-ink/30 hover:bg-ink/[0.02] md:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-ink">{order.orderCode}</p>
                    <p className="mt-1 text-[13px] text-text-muted">
                      {order.customerName} · {formatDate(order.createdAt)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-text-muted">
                      {order.lines[0]?.variantLabel ?? "—"} ×{" "}
                      {order.lines[0]?.quantity ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <AdminOrderStatusBadge status={order.status} />
                    <p className="text-[15px] font-bold text-ink">
                      {formatCurrencyVnd(order.total)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
