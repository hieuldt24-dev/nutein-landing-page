"use client";

import useSWR from "swr";
import { ADMIN_DASHBOARD_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";
import type { AdminDashboardSummary } from "@/features/admin-dashboard/types";

const METRICS: {
  key: keyof AdminDashboardSummary;
  label: string;
  hint: string;
}[] = [
  {
    key: "newOrdersCount",
    label: "Đơn mới",
    hint: "Trong 24 giờ gần nhất",
  },
  {
    key: "ordersNeedingAction",
    label: "Đơn cần xử lý",
    hint: "Chờ thao tác vận hành",
  },
  {
    key: "unreadContacts",
    label: "Liên hệ chưa đọc",
    hint: "Hộp thư Liên hệ",
  },
  {
    key: "lowStock",
    label: "Tồn kho thấp",
    hint: "Đơn vị còn lại (SKU Nutein)",
  },
];

function SummarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[108px] animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle"
        />
      ))}
    </div>
  );
}

/**
 * S2 — 4 thẻ tổng quan. Chỉ gọi service (không import mock).
 * Chi tiết module S3–S8 sẽ bổ sung theo roadmap — card không điều hướng tạm.
 */
export function AdminDashboardSummary() {
  const { data, error, isLoading } = useSWR(
    ADMIN_DASHBOARD_SWR_KEY,
    () => adminDashboardService.getSummary(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  if (isLoading) {
    return <SummarySkeleton />;
  }

  if (error || !data) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được tổng quan vận hành. Thử tải lại trang.
      </p>
    );
  }

  return (
    <div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <li
            key={metric.key}
            className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 shadow-sm"
          >
            <p className="text-[12px] font-bold tracking-[0.06em] text-text-muted uppercase">
              {metric.label}
            </p>
            <p className="mt-2 font-display text-[clamp(28px,4vw,36px)] font-bold tracking-[-0.03em] text-ink">
              {data[metric.key]}
            </p>
            <p className="mt-1 text-[13px] text-text-muted">{metric.hint}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-text-muted">
        Số liệu đang dùng dữ liệu demo (mock). Chi tiết từng module sẽ mở ở các
        phase sau — xem{" "}
        <code className="rounded bg-ink/5 px-1.5 py-0.5 text-[12px] font-semibold text-ink">
          docs/admin-portal-roadmap.md
        </code>
        .
      </p>
    </div>
  );
}
