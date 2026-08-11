"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronRight, Search } from "lucide-react";
import { AdminOrderStatusBadge } from "@/components/admin/orders/AdminOrderStatusBadge";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { AdminListPagination } from "@/components/admin/ui/AdminListPagination";
import { FillButton } from "@/components/ui/FillButton";
import {
  ADMIN_ORDER_STATUS_LABEL,
  ADMIN_ORDERS_SWR_KEY,
} from "@/features/admin-orders/constants";
import { adminOrdersService } from "@/features/admin-orders/services/admin-orders.service";
import type {
  AdminOrderStatus,
  AdminOrderStatusFilter,
} from "@/features/admin-orders/types";
import {
  ADMIN_LIST_PAGE_SIZE,
  defaultLast7DaysRange,
} from "@/lib/admin-list-query";
import { formatCurrencyVnd, formatDate } from "@/lib/utils";

const STATUS_FILTERS: AdminOrderStatusFilter[] = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

function filterLabel(value: AdminOrderStatusFilter): string {
  if (value === "all") return "Tất cả";
  return ADMIN_ORDER_STATUS_LABEL[value];
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-[20px] border border-ink/10 bg-border-subtle"
        />
      ))}
    </div>
  );
}

/**
 * S3 — danh sách đơn: mặc định 7 ngày gần nhất, phân trang server (limit/offset).
 */
export function AdminOrdersList() {
  const defaultRange = useMemo(() => defaultLast7DaysRange(), []);
  const [status, setStatus] = useState<AdminOrderStatusFilter>("all");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const swrKey = useMemo(
    () =>
      `${ADMIN_ORDERS_SWR_KEY}:${status}:${from}:${to}:${q.trim()}:${page}:${ADMIN_LIST_PAGE_SIZE}`,
    [status, from, to, q, page],
  );

  const { data, error, isLoading } = useSWR(
    swrKey,
    () =>
      adminOrdersService.list({
        status,
        from: from || undefined,
        to: to || undefined,
        q: q.trim() || undefined,
        limit: ADMIN_LIST_PAGE_SIZE,
        offset: page * ADMIN_LIST_PAGE_SIZE,
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const isDefaultRange = from === defaultRange.from && to === defaultRange.to;

  const clearFilters = () => {
    setStatus("all");
    setFrom(defaultRange.from);
    setTo(defaultRange.to);
    setQ("");
    setPage(0);
  };

  const hasActiveFilters =
    status !== "all" ||
    !isDefaultRange ||
    Boolean(q.trim());

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
        Đơn hàng
      </h1>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {STATUS_FILTERS.map((value) => (
              <AdminFilterChip
                key={value}
                active={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(0);
                }}
                className="h-9 text-[12.5px]"
              >
                {filterLabel(value)}
              </AdminFilterChip>
            ))}
          </div>
          <label className="relative flex h-[38px] w-full items-center gap-2 rounded-full border border-ink/12 bg-surface px-3.5 sm:ml-auto sm:max-w-[280px]">
            <Search
              size={15}
              strokeWidth={2.1}
              className="shrink-0 text-text-muted"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Tìm mã đơn, tên khách…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-text-faint"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
              className="rounded-[14px] border border-ink/20 bg-surface px-3 py-2 text-[14px] font-medium text-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Đến ngày
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(0);
              }}
              className="rounded-[14px] border border-ink/20 bg-surface px-3 py-2 text-[14px] font-medium text-ink"
            />
          </label>
        </div>
      </div>

      {isLoading ? <ListSkeleton /> : null}

      {!isLoading && error ? (
        <p className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được danh sách đơn. Thử tải lại trang.
        </p>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-ink/10 bg-surface px-8 py-10">
          <p className="font-display text-base font-bold text-ink">
            Chưa có đơn
          </p>
          <p className="max-w-sm text-center text-[13.5px] font-medium text-text-muted">
            Thử đổi khoảng ngày hoặc trạng thái.
          </p>
          {hasActiveFilters ? (
            <FillButton
              type="button"
              variant="ink-solid"
              onClick={clearFilters}
              className="mt-2 h-10 px-5 text-[13px] font-bold"
            >
              Xóa bộ lọc
            </FillButton>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {items.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/staff/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-[20px] border border-ink/15 bg-surface px-3.5 py-3.5 transition-colors hover:border-ink/30 hover:bg-ink/[0.02] sm:gap-4 sm:px-4 sm:py-4 md:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-[15px] font-bold text-ink">
                        {order.orderCode}
                      </p>
                      <p className="text-[14px] font-bold text-ink sm:hidden">
                        {formatCurrencyVnd(order.total)}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-[13px] font-medium text-text-muted">
                      {order.customerName} · {formatDate(order.createdAt)}
                      {order.lines[0]
                        ? ` · ${order.lines[0].variantLabel} × ${order.lines[0].quantity}`
                        : ""}
                    </p>
                  </div>
                  <AdminOrderStatusBadge
                    status={order.status as AdminOrderStatus}
                  />
                  <p className="hidden w-[110px] shrink-0 text-right text-[15px] font-bold text-ink sm:block">
                    {formatCurrencyVnd(order.total)}
                  </p>
                  <ChevronRight
                    size={16}
                    strokeWidth={2.2}
                    className="shrink-0 text-text-faint"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
          <AdminListPagination
            page={page}
            pageSize={ADMIN_LIST_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
