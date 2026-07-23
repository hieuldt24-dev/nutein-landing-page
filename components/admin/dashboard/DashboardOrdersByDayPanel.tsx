"use client";

import useSWR from "swr";
import {
  Bar,
  BarChart,
  BarChartLoading,
  BarXAxis,
  ChartTooltip,
  Grid,
  TooltipContent,
} from "@/src/components/charts";
import { useDashboardChartMargin } from "@/components/admin/dashboard/useDashboardChartMargin";
import { ADMIN_DASHBOARD_ORDERS_BY_DAY_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";
import type { DashboardOrdersByDayPoint } from "@/features/admin-dashboard/types";
import { formatChartDayTitle, formatDayMonth } from "@/lib/utils";

function OrdersByDaySkeleton() {
  const margin = useDashboardChartMargin();
  return (
    <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3 py-4 shadow-sm sm:px-5 sm:py-5">
      <BarChartLoading
        aspectRatio="16 / 9"
        className="w-full"
        margin={margin}
      />
    </div>
  );
}

function OrdersByDayBars({ data }: { data: DashboardOrdersByDayPoint[] }) {
  const margin = useDashboardChartMargin();
  const chartData = data.map((day) => ({
    day: formatDayMonth(day.date),
    dateKey: day.date,
    newCount: day.newCount,
    cancelledCount: day.cancelledCount,
  }));

  return (
    <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3 py-4 shadow-sm sm:px-5 sm:py-5">
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[12px] font-semibold text-text-muted">
        <li className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm bg-[var(--chart-line-primary)]"
            aria-hidden
          />
          Đơn mới
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-danger" aria-hidden />
          Đơn hủy
        </li>
      </ul>
      <div className="mt-3 w-full sm:mt-4">
        <BarChart
          data={chartData}
          xDataKey="day"
          aspectRatio="16 / 9"
          className="w-full"
          status="ready"
          margin={margin}
          barGap={0.22}
        >
          <Grid horizontal />
          <Bar
            dataKey="newCount"
            fill="var(--chart-line-primary)"
            lineCap="round"
          />
          <Bar
            dataKey="cancelledCount"
            fill="var(--color-danger)"
            lineCap="round"
          />
          <BarXAxis showAllLabels />
          <ChartTooltip
            showDatePill={false}
            content={({ point }) => (
              <TooltipContent
                title={formatChartDayTitle(String(point.dateKey ?? point.day))}
                rows={[
                  {
                    label: "Đơn mới",
                    value: Number(point.newCount ?? 0),
                    color: "var(--chart-line-primary)",
                  },
                  {
                    label: "Đơn hủy",
                    value: Number(point.cancelledCount ?? 0),
                    color: "var(--color-danger)",
                  },
                ]}
              />
            )}
          />
        </BarChart>
      </div>
    </div>
  );
}

/**
 * Staff — bar đơn mới theo ngày (2 series: mới + hủy).
 */
export function DashboardOrdersByDayPanel() {
  const { data, error, isLoading } = useSWR(
    ADMIN_DASHBOARD_ORDERS_BY_DAY_SWR_KEY,
    () => adminDashboardService.getOrdersByDay(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  if (isLoading) return <OrdersByDaySkeleton />;

  if (error) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được đơn theo ngày.
      </p>
    );
  }

  return <OrdersByDayBars data={data ?? []} />;
}
