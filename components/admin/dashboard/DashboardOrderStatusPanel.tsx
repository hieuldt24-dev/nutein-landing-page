"use client";

import useSWR from "swr";
import { DashboardPieChart } from "@/components/admin/dashboard/DashboardPieChart";
import { ADMIN_DASHBOARD_ORDER_STATUS_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";

function OrderStatusSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 shadow-sm sm:flex-row sm:justify-center sm:gap-10">
      <div className="size-[220px] animate-pulse rounded-full bg-border-subtle sm:size-[240px]" />
      <div className="flex w-full max-w-[240px] flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-[var(--radius-md)] bg-border-subtle"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Staff — pie đơn theo trạng thái (Bklit PieChart).
 */
export function DashboardOrderStatusPanel() {
  const { data, error, isLoading } = useSWR(
    ADMIN_DASHBOARD_ORDER_STATUS_SWR_KEY,
    () => adminDashboardService.getOrderStatusBreakdown(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  if (isLoading) return <OrderStatusSkeleton />;

  if (error) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được phân bố trạng thái đơn.
      </p>
    );
  }

  return (
    <DashboardPieChart data={data ?? []} centerLabel="Tổng đơn" />
  );
}
