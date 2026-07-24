import type { AdminOrderSummaryRow } from "@/features/admin-orders/types";
import type { DashboardOrdersByDayPoint } from "../types";

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

/**
 * Đếm đơn mới + đơn hủy theo ngày (7 ngày neo theo đơn mới nhất).
 * “Mới” = mọi đơn tạo trong ngày; “Hủy” = status cancelled (cùng ngày tạo).
 */
export function buildOrdersByDayBreakdown(
  orders: AdminOrderSummaryRow[],
): DashboardOrdersByDayPoint[] {
  const asOfMs = orders.reduce(
    (max, o) => Math.max(max, new Date(o.createdAt).getTime()),
    0,
  );
  const asOfStart = startOfDay(new Date(asOfMs || Date.now()));

  const byDay = new Map<string, { newCount: number; cancelledCount: number }>();
  for (let i = 0; i < 7; i += 1) {
    byDay.set(toDateKey(addDays(asOfStart, -6 + i)), {
      newCount: 0,
      cancelledCount: 0,
    });
  }

  for (const order of orders) {
    const key = toDateKey(startOfDay(new Date(order.createdAt)));
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.newCount += 1;
    if (order.status === "cancelled") {
      bucket.cancelledCount += 1;
    }
  }

  return [...byDay.entries()].map(([date, counts]) => ({
    date,
    ...counts,
  }));
}
