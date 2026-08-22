"use client";

import { useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  ACCOUNT_ORDERS_API_PATH,
  ACCOUNT_ORDER_STATUS_FILTERS,
} from "@/features/account/constants";
import { fetcher } from "@/lib/swr-fetcher";
import { apiRequest } from "@/lib/api-client";
import { notify } from "@/lib/toast";
import { cn, formatCurrencyVnd } from "@/lib/utils";
import type {
  AccountOrder,
  AccountOrderStatusFilter,
} from "@/features/account/types";
import type { RetryPaymentResult } from "@/features/checkout/types";
import { AccountOrderStatusBadge } from "@/components/account/AccountOrderStatusBadge";
import { FillButton } from "@/components/ui/FillButton";
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
  const { mutate: globalMutate } = useSWRConfig();
  /** Guard đồng bộ chống double-click — useState/disabled chỉ áp dụng ở lần
   *  render sau nên không chặn kịp click thứ 2 bắn ra trước khi re-render. */
  const retryingRef = useRef<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data;
    return data.filter((order) => order.status === statusFilter);
  }, [data, statusFilter]);

  const handleRetryPayment = async (orderCode: string) => {
    if (retryingRef.current.has(orderCode)) return;
    retryingRef.current.add(orderCode);
    try {
      const result = await apiRequest<RetryPaymentResult>(
        "/api/checkout/payos/retry",
        {
          method: "POST",
          body: JSON.stringify({ orderCode }),
        },
      );

      if (result.status === "created") {
        window.location.replace(result.paymentUrl);
        return;
      }

      notify.success("Đơn hàng đã được thanh toán.");
      await globalMutate(ACCOUNT_ORDERS_API_PATH);
    } catch (err) {
      notify.error(
        err instanceof Error
          ? err.message
          : "Không tạo được link thanh toán — vui lòng thử lại.",
      );
    } finally {
      retryingRef.current.delete(orderCode);
    }
  };

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
                  <p className="font-display text-lg font-bold text-ink">
                    {formatCurrencyVnd(order.total)}
                  </p>
                  {order.canRetryPayment ? (
                    <FillButton
                      type="button"
                      variant="ink-solid"
                      className="h-[34px] px-4 text-[11px] font-extrabold uppercase"
                      onClick={() => void handleRetryPayment(order.orderCode)}
                    >
                      Thanh toán ngay
                    </FillButton>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
