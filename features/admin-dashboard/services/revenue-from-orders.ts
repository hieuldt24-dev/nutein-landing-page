import type { AdminOrderSummaryRow } from "@/features/admin-orders/types";
import type { DashboardRevenueSnapshot } from "../types";

const EXCLUDED: ReadonlySet<AdminOrderSummaryRow["status"]> = new Set([
  "cancelled",
  "returned",
]);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekChangePercent(
  weekVnd: number,
  previousWeekVnd: number,
): number | null {
  if (previousWeekVnd === 0) {
    return weekVnd === 0 ? null : 100;
  }
  return ((weekVnd - previousWeekVnd) / previousWeekVnd) * 100;
}

/**
 * Snapshot doanh thu từ list đơn tổng hợp (không PII).
 * Neo cửa sổ theo đơn mới nhất (ổn định khi ít đơn), không phụ thuộc “hôm nay” máy.
 * Chỉ cộng đơn không hủy / không trả.
 */
export function buildRevenueSnapshotFromOrders(
  orders: AdminOrderSummaryRow[],
): DashboardRevenueSnapshot {
  const countable = orders.filter((o) => !EXCLUDED.has(o.status));

  const asOfMs = countable.reduce(
    (max, o) => Math.max(max, new Date(o.createdAt).getTime()),
    0,
  );
  const asOf = new Date(asOfMs || Date.now());
  const asOfStart = startOfDay(asOf);
  const weekStart = addDays(asOfStart, -6);
  const prevWeekStart = addDays(asOfStart, -13);
  const prevWeekEnd = addDays(asOfStart, -7);
  const monthStart = addDays(asOfStart, -29);

  let todayVnd = 0;
  let weekVnd = 0;
  let previousWeekVnd = 0;
  let monthVnd = 0;
  let monthOrderCount = 0;

  const dayTotals = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    dayTotals.set(toDateKey(addDays(asOfStart, -6 + i)), 0);
  }

  for (const order of countable) {
    const created = new Date(order.createdAt);
    const createdStart = startOfDay(created);
    const amount = order.total;

    if (createdStart.getTime() === asOfStart.getTime()) {
      todayVnd += amount;
    }
    if (createdStart >= weekStart && createdStart <= asOfStart) {
      weekVnd += amount;
    }
    if (createdStart >= prevWeekStart && createdStart <= prevWeekEnd) {
      previousWeekVnd += amount;
    }
    if (createdStart >= monthStart) {
      monthVnd += amount;
      monthOrderCount += 1;
    }

    const key = toDateKey(createdStart);
    if (dayTotals.has(key)) {
      dayTotals.set(key, (dayTotals.get(key) ?? 0) + amount);
    }
  }

  const last7Days = [...dayTotals.entries()].map(([date, amountVnd]) => ({
    date,
    amountVnd,
  }));

  return {
    asOf: asOf.toISOString(),
    todayVnd,
    weekVnd,
    previousWeekVnd,
    weekChangePercent: weekChangePercent(weekVnd, previousWeekVnd),
    monthVnd,
    monthOrderCount,
    last7Days,
  };
}
