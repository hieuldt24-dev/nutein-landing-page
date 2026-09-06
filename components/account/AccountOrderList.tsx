"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ACCOUNT_ORDERS_API_PATH,
  ACCOUNT_ORDER_STATUS_FILTERS,
} from "@/features/account/constants";
import { fetcher } from "@/lib/swr-fetcher";
import { cn, formatCurrencyVnd } from "@/lib/utils";
import type {
  AccountOrder,
  AccountOrderStatusFilter,
} from "@/features/account/types";
import { AccountOrderStatusBadge } from "@/components/account/AccountOrderStatusBadge";
import { useAuthStore } from "@/lib/useAuthStore";

function formatOrderDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AccountOrderList() {
  const { isLoggedIn } = useAuthStore();
  const key = isLoggedIn ? ACCOUNT_ORDERS_API_PATH : null;
  const [statusFilter, setStatusFilter] =
    useState<AccountOrderStatusFilter>("all");

  const { data, error, isLoading } = useSWR<AccountOrder[]>(key, fetcher);

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data;
    return data.filter((order) => order.status === statusFilter);
  }, [data, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-ink/5"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm font-semibold text-red-600">
        Không tải được lịch sử đơn hàng. Thử lại sau.
      </p>
    );
  }

  const hasAnyOrders = Boolean(data?.length);

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Lọc theo trạng thái đơn"
      >
        {ACCOUNT_ORDER_STATUS_FILTERS.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              aria-pressed={active}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors",
                active
                  ? "bg-ink text-bg"
                  : "border border-ink/15 bg-surface text-ink/70 hover:border-ink/25 hover:text-ink",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {!hasAnyOrders ? (
        <p className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-8 text-center text-sm text-text-muted">
          Bạn chưa có đơn hàng nào.
        </p>
      ) : !filteredOrders.length ? (
        <p className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-8 text-center text-sm text-text-muted">
          Không có đơn ở trạng thái này.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-3">
          {filteredOrders.map((order) => (
            <li
              key={order.id}
              className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold tracking-[0.06em] text-text-muted uppercase">
                    {formatOrderDate(order.createdAt)}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-ink">
                    {order.orderCode}
                  </p>
                  <p className="mt-1 text-[13px] text-text-body">
                    Nutein · {order.variantLabel} · {order.quantity} hũ
                  </p>
                  {order.couponCode ? (
                    <p className="mt-1 text-[12px] font-semibold text-forest">
                      Mã giảm giá: {order.couponCode}
                      {typeof order.couponDiscountAmount === "number"
                        ? ` · −${formatCurrencyVnd(order.couponDiscountAmount)}`
                        : ""}
                    </p>
                  ) : null}
                  {order.estimatedDeliveryLabel ? (
                    <p className="mt-1 text-[12px] text-text-muted">
                      {order.estimatedDeliveryLabel}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AccountOrderStatusBadge status={order.status} />
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.02em] uppercase",
                      order.paymentStatus === "PAID"
                        ? "bg-lime/50 text-forest"
                        : "bg-ink/10 text-text-muted",
                    )}
                  >
                    {order.paymentStatus === "PAID"
                      ? "Đã thanh toán"
                      : "Chưa thanh toán"}
                  </span>
                  <p className="font-display text-lg font-bold text-ink">
                    {formatCurrencyVnd(order.total)}
                  </p>
                  {/* Đơn chưa thanh toán mới cần thao tác (chuyển khoản lại,
                      báo đã chuyển, yêu cầu hủy) — trạng thái thật và các
                      hành động hợp lệ đều do trang chi tiết đọc từ server. */}
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="text-[12px] font-bold text-primary-deep underline-offset-2 hover:underline"
                  >
                    {order.paymentStatus === "PAID"
                      ? "Xem chi tiết"
                      : "Xem & thanh toán"}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
