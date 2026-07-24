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

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function RevenueSkeleton() {
  const margin = useDashboardChartMargin();
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle sm:h-[96px]"
          />
        ))}
      </div>
      <div className="pt-2 sm:pt-3">
        <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3 py-4 shadow-sm sm:px-5 sm:py-5">
          <AreaChartLoading
            aspectRatio="16 / 9"
            className="w-full"
            margin={margin}
          />
        </div>
      </div>
    </div>
  );
}

function RevenueArea({ data }: { data: DashboardRevenueSnapshot }) {
  const margin = useDashboardChartMargin();
  const chartData = data.last7Days.map((day) => ({
    date: parseLocalDate(day.date),
    revenue: day.amountVnd,
  }));

  return (
    <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-[15px] font-bold text-ink sm:text-base">
          7 ngày gần đây
        </h3>
        <p className="text-[12px] text-text-muted">
          Cập nhật {formatDate(data.asOf)}
        </p>
      </div>
      <div className="mt-3 w-full sm:mt-4">
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
            showDatePill={false}
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
 * Khối doanh thu — dùng chung Staff `/staff` và Admin `/admin`.
 * Chart: Bklit UI `@bklit/area-chart` (src/components/charts).
 */
export function DashboardRevenuePanel({
  /** Khi Admin home đã fetch sẵn revenue — tránh double request. */
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

  const cards: { label: string; value: number; format: "money" | "count" }[] = [
    { label: "Hôm nay", value: snapshot.todayVnd, format: "money" },
    { label: "7 ngày", value: snapshot.weekVnd, format: "money" },
    { label: "30 ngày", value: snapshot.monthVnd, format: "money" },
    {
      label: "Đơn · 30 ngày",
      value: snapshot.monthOrderCount,
      format: "count",
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <p className="text-[13px] text-text-muted">
        Chưa gồm đơn hủy và trả hàng.
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <li
            key={card.label}
            className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5"
          >
            <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase sm:text-[12px]">
              {card.label}
            </p>
            <p className="mt-1.5 font-display text-[clamp(18px,5vw,28px)] font-bold tracking-[-0.03em] text-ink sm:mt-2">
              {card.format === "count"
                ? card.value
                : formatCurrencyVnd(card.value)}
            </p>
          </li>
        ))}
      </ul>
      <div className="pt-2 sm:pt-3">
        <RevenueArea data={snapshot} />
      </div>
    </div>
  );
}
