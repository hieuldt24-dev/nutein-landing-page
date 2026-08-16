"use client";

import useSWR from "swr";
import { AdminAccentLink } from "@/components/admin/ui/AdminAccentLink";
import { ADMIN_DASHBOARD_OPS_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";
import type { AdminDashboardSummary } from "@/features/admin-dashboard/types";

const METRICS: {
  key: keyof AdminDashboardSummary;
  label: string;
  href: string;
  linkLabel: string;
}[] = [
  {
    key: "newOrdersCount",
    label: "Đơn mới hôm nay",
    href: "/staff/orders",
    linkLabel: "Xem đơn",
  },
  {
    key: "ordersNeedingAction",
    label: "Chờ xử lý",
    href: "/staff/orders",
    linkLabel: "Xử lý",
  },
  {
    key: "unreadContacts",
    label: "Liên hệ chưa đọc",
    href: "/staff/contact",
    linkLabel: "Hộp thư",
  },
  {
    key: "lowStock",
    label: "Tồn kho thấp",
    href: "/staff/products",
    linkLabel: "Xem kho",
  },
];

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[112px] animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle"
        />
      ))}
    </div>
  );
}

/**
 * S2 — 4 thẻ vận hành + accent actions (mock v2).
 */
export function AdminDashboardSummary() {
  const { data, error, isLoading } = useSWR(
    ADMIN_DASHBOARD_OPS_SWR_KEY,
    () => adminDashboardService.getStaffOps(),
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

  const summary = data.summary;

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
      {METRICS.map((metric) => (
        <li
          key={metric.key}
          className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 shadow-sm"
        >
          <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase">
            {metric.label}
          </p>
          <p className="font-display text-[clamp(24px,5vw,32px)] font-bold tracking-[-0.03em] text-ink">
            {summary[metric.key]}
          </p>
          <AdminAccentLink href={metric.href} className="mt-auto">
            {metric.linkLabel}
          </AdminAccentLink>
        </li>
      ))}
    </ul>
  );
}
