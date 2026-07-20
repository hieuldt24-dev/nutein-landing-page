"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { formatCurrencyVnd } from "@/lib/utils";
import type { AccountOrder } from "@/features/account/types";
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
  const { user } = useAuthStore();
  const email = user?.email;
  const key = email
    ? `/api/account/orders?email=${encodeURIComponent(email)}`
    : null;

  const { data, error, isLoading } = useSWR<AccountOrder[]>(key, fetcher);

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

  if (!data?.length) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-8 text-center text-sm text-text-muted">
        Bạn chưa có đơn hàng nào.
      </p>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-3">
      {data.map((order) => (
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
                Nutein · {order.variantLabel} · SL {order.quantity}
              </p>
              {order.estimatedDeliveryLabel ? (
                <p className="mt-1 text-[12px] text-text-muted">
                  {order.estimatedDeliveryLabel}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <AccountOrderStatusBadge status={order.status} />
              <p className="font-display text-lg font-bold text-ink">
                {formatCurrencyVnd(order.total)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
