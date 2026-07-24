import { ADMIN_ORDER_STATUS_LABEL } from "@/features/admin-orders/constants";
import type { AdminOrderStatus, AdminOrderSummaryRow } from "@/features/admin-orders/types";
import type { AdminManagedUser } from "@/features/admin-users/types";
import type { DashboardPieSlice } from "../types";

const ORDER_STATUS_COLOR: Record<AdminOrderStatus, string> = {
  pending: "var(--chart-4)",
  processing: "var(--chart-3)",
  shipped: "var(--chart-1)",
  delivered: "var(--chart-5)",
  cancelled: "var(--color-danger)",
  returned: "var(--color-sage)",
};

const STATUS_ORDER: AdminOrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

/** Đếm đơn theo trạng thái — bỏ slice value = 0. */
export function buildOrderStatusBreakdown(
  orders: AdminOrderSummaryRow[],
): DashboardPieSlice[] {
  const counts = new Map<AdminOrderStatus, number>();
  for (const status of STATUS_ORDER) {
    counts.set(status, 0);
  }
  for (const order of orders) {
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  }

  return STATUS_ORDER.map((status) => ({
    label: ADMIN_ORDER_STATUS_LABEL[status],
    value: counts.get(status) ?? 0,
    color: ORDER_STATUS_COLOR[status],
  })).filter((slice) => slice.value > 0);
}

/** Phân bố role users (không gồm “đã khóa” — metric riêng). */
export function buildUserRoleBreakdown(
  users: AdminManagedUser[],
): DashboardPieSlice[] {
  const userCount = users.filter((u) => u.role === "user").length;
  const staffCount = users.filter((u) => u.role === "staff").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return [
    { label: "Khách", value: userCount, color: "var(--chart-3)" },
    { label: "Staff", value: staffCount, color: "var(--chart-1)" },
    { label: "Admin", value: adminCount, color: "var(--chart-5)" },
  ].filter((slice) => slice.value > 0);
}
