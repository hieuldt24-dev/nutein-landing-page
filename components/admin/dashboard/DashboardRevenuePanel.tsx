"use client";

import useSWR from "swr";
import {
  Area,
  AreaChart,
  AreaChartLoading,
  ChartTooltip,
  Grid,
  TooltipContent,
  XAxis,
} from "@/src/components/charts";
import { useDashboardChartMargin } from "@/components/admin/dashboard/useDashboardChartMargin";
import { ADMIN_DASHBOARD_REVENUE_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";
import type { DashboardRevenueSnapshot } from "@/features/admin-dashboard/types";
import {
  formatChartDayTitle,
  formatCurrencyVnd,
  formatDate,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatWeekChange(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("vi-VN")}% so với 7 ngày trước`;
}

function RevenueSkeleton() {
  const margin = useDashboardChartMargin();
  return (
    <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 shadow-sm sm:px-7 sm:py-5">
      <div className="h-5 w-40 animate-pulse rounded bg-border-subtle" />
      <div className="mt-4 h-9 w-48 animate-pulse rounded bg-border-subtle" />
      <div className="mt-5">
        <AreaChartLoading
          aspectRatio="16 / 9"
          className="w-full"
          margin={margin}
        />
      </div>
    </div>
  );
}

function RevenueHero({ data }: { data: DashboardRevenueSnapshot }) {
  const margin = useDashboardChartMargin();
  const chartData = data.last7Days.map((day) => ({
    date: parseLocalDate(day.date),
    revenue: day.amountVnd,
  }));
  const change = data.weekChangePercent;
  const changePositive = change !== null && change >= 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 shadow-sm sm:px-7 sm:py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
          Doanh thu 7 ngày
        </h2>
        <p className="text-[12px] text-text-muted">
          Cập nhật {formatDate(data.asOf)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-4">
        <p className="font-display text-[clamp(28px,6vw,34px)] font-bold tracking-[-0.03em] text-ink">
          {formatCurrencyVnd(data.weekVnd)}
        </p>
        {change !== null ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-extrabold",
              changePositive
                ? "bg-lime/50 text-forest"
                : "bg-danger/10 text-danger",
            )}
          >
            {formatWeekChange(change)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 w-full sm:mt-5">
        <AreaChart
          data={chartData}
          aspectRatio="16 / 9"
          className="w-full"
          status="ready"
          margin={margin}
        >
          <Grid horizontal />
          <Area
            dataKey="revenue"
            fill="var(--chart-line-primary)"
            fillOpacity={0.35}
            fadeEdges
          />
          <XAxis />
          <ChartTooltip
            showDatePill
            content={({ point }) => {
              const dateValue = point.date;
              const title =
                dateValue instanceof Date
                  ? formatChartDayTitle(dateValue)
                  : typeof dateValue === "string"
                    ? formatChartDayTitle(dateValue)
                    : "Ngày";
              return (
                <TooltipContent
                  title={title}
                  rows={[
                    {
                      label: "Doanh thu",
                      value: formatCurrencyVnd(Number(point.revenue ?? 0)),
                      color: "var(--chart-line-primary)",
                    },
                  ]}
                />
              );
            }}
          />
        </AreaChart>
      </div>
    </div>
  );
}

/**
 * Khối doanh thu — Staff `/staff` và Admin `/admin`.
 * 1 chart duy nhất (Area) theo design mock.
 */
export function DashboardRevenuePanel({
  revenue,
}: {
  revenue?: DashboardRevenueSnapshot | null;
} = {}) {
  const shouldFetch = revenue === undefined;
  const { data, error, isLoading } = useSWR(
    shouldFetch ? ADMIN_DASHBOARD_REVENUE_SWR_KEY : null,
    () => adminDashboardService.getRevenue(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const snapshot = revenue ?? data;

  if (shouldFetch && isLoading) {
    return <RevenueSkeleton />;
  }

  if ((shouldFetch && (error || !snapshot)) || (!shouldFetch && !snapshot)) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được doanh thu. Thử tải lại trang.
      </p>
    );
  }

  if (!snapshot) return null;

  return <RevenueHero data={snapshot} />;
}
