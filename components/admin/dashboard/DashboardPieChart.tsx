"use client";

import { useMemo, useState } from "react";
import {
  PieCenter,
  PieChart,
  PieSlice,
  type PieData,
} from "@/src/components/charts";
import type { DashboardPieSlice } from "@/features/admin-dashboard/types";
import { cn } from "@/lib/utils";

/**
 * Donut + legend — dùng chung đơn theo trạng thái / phân bố role users.
 */
export function DashboardPieChart({
  data,
  centerLabel,
  className,
}: {
  data: DashboardPieSlice[];
  centerLabel: string;
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const pieData: PieData[] = useMemo(
    () =>
      data.map((slice) => ({
        label: slice.label,
        value: slice.value,
        color: slice.color,
      })),
    [data],
  );

  const total = useMemo(
    () => pieData.reduce((sum, slice) => sum + slice.value, 0),
    [pieData],
  );

  if (pieData.length === 0 || total === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-8 text-center text-sm text-text-muted">
        Chưa có dữ liệu.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-3 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-center sm:gap-8 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="size-[200px] shrink-0">
        <PieChart
          data={pieData}
          size={200}
          innerRadius={52}
          padAngle={0.02}
          cornerRadius={4}
          hoverOffset={8}
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
          className="h-full w-full"
        >
          {pieData.map((_, index) => (
            <PieSlice
              key={pieData[index].label}
              index={index}
              hoverEffect="grow"
              hoverOffset={6}
            />
          ))}
          <PieCenter defaultLabel={centerLabel} />
        </PieChart>
      </div>

      <ul className="m-0 flex w-full max-w-[260px] list-none flex-col gap-1.5 p-0">
        {pieData.map((slice, index) => {
          const active = hoveredIndex === index;
          return (
            <li key={slice.label}>
              <button
                type="button"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors",
                  active ? "bg-ink/5" : "hover:bg-ink/5",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                  {slice.label}
                </span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-text-muted">
                  {slice.value}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
