"use client";

import useSWR from "swr";
import { ADMIN_DASHBOARD_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";
import type { AdminDashboardSummary } from "@/features/admin-dashboard/types";

const METRICS: { key: keyof AdminDashboardSummary; label: string }[] = [
  { key: "newOrdersCount", label: "Đơn mới" },
  { key: "ordersNeedingAction", label: "Cần xử lý" },
  { key: "unreadContacts", label: "Liên hệ mới" },
  { key: "lowStock", label: "Tồn thấp" },
];

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle sm:h-[96px]"
        />
      ))}
    </div>
  );
}

/**
 * S2 — 4 thẻ tổng quan. Chỉ gọi service (không import mock).
 * Lưới 2×2 — gọn khi đứng cạnh pie trên desktop.
 */
export function AdminDashboardSummary() {
  const { data, error, isLoading } = useSWR(
    ADMIN_DASHBOARD_SWR_KEY,
    () => adminDashboardService.getSummary(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  if (isLoading) {
    return <SummarySkeleton />;
  }

  if (error || !data) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được chỉ số vận hành. Thử tải lại trang.
      </p>
    );
  }

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:gap-3">
      {METRICS.map((metric) => (
        <li
          key={metric.key}
          className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5"
        >
          <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase sm:text-[12px]">
            {metric.label}
          </p>
          <p className="mt-1.5 font-display text-[clamp(22px,5vw,32px)] font-bold tracking-[-0.03em] text-ink sm:mt-2">
            {data[metric.key]}
          </p>
        </li>
      ))}
    </ul>
  );
}
