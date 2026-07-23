import { ADMIN_DASHBOARD_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_DASHBOARD_SUMMARY } from "../data/dashboard.mock";
import type {
  AdminDashboardSummary,
  AdminHomeSummary,
  DashboardOrdersByDayPoint,
  DashboardPieSlice,
  DashboardRevenueSnapshot,
} from "../types";
import { buildOrdersByDayBreakdown } from "./orders-by-day";
import { buildRevenueSnapshotFromOrders } from "./revenue-from-orders";
import {
  buildOrderStatusBreakdown,
  buildUserRoleBreakdown,
} from "./pie-breakdown";
import { adminOrdersService } from "@/features/admin-orders/services/admin-orders.service";
import { adminUsersService } from "@/features/admin-users/services/admin-users.service";
import { adminAuditService } from "@/features/admin-audit/services/admin-audit.service";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Dashboard domain — Staff ops + doanh thu chung + Admin home.
 * Phase mock: tổng hợp từ admin-orders / admin-users / admin-audit.
 * Khi có API: đổi thân method → `GET /api/staff/dashboard` hoặc
 * `GET /api/admin/dashboard` — giữ chữ ký + types.
 */
export const adminDashboardService = {
  /** S2 — chỉ số vận hành (đơn / liên hệ / tồn). */
  async getSummary(): Promise<AdminDashboardSummary> {
    await delay(ADMIN_DASHBOARD_MOCK_LATENCY_MS);
    return { ...MOCK_ADMIN_DASHBOARD_SUMMARY };
  },

  /** Doanh thu — Staff + Admin dùng chung (không thêm delay — orders service đã có). */
  async getRevenue(): Promise<DashboardRevenueSnapshot> {
    const orders = await adminOrdersService.list({});
    return buildRevenueSnapshotFromOrders(orders);
  },

  /** Phân bố đơn theo trạng thái — pie Staff. */
  async getOrderStatusBreakdown(): Promise<DashboardPieSlice[]> {
    const orders = await adminOrdersService.list({});
    return buildOrderStatusBreakdown(orders);
  },

  /** Đơn mới + hủy theo ngày — bar Staff. */
  async getOrdersByDay(): Promise<DashboardOrdersByDayPoint[]> {
    const orders = await adminOrdersService.list({});
    return buildOrdersByDayBreakdown(orders);
  },

  /** Admin `/admin` — doanh thu + users + audit gần đây. */
  async getAdminHome(): Promise<AdminHomeSummary> {
    const [orders, users, audit] = await Promise.all([
      adminOrdersService.list({}),
      adminUsersService.list({}),
      adminAuditService.list({}),
    ]);

    return {
      revenue: buildRevenueSnapshotFromOrders(orders),
      users: {
        total: users.length,
        userCount: users.filter((u) => u.role === "user").length,
        staffCount: users.filter((u) => u.role === "staff").length,
        adminCount: users.filter((u) => u.role === "admin").length,
        lockedCount: users.filter((u) => u.locked).length,
        roleBreakdown: buildUserRoleBreakdown(users),
      },
      recentAudit: audit.slice(0, 5).map((row) => ({
        id: row.id,
        action: row.action,
        summary: row.summary,
        actorEmail: row.actorEmail,
        createdAt: row.createdAt,
      })),
    };
  },
};
