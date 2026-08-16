import type {
  AdminDashboardSummary,
  AdminHomeSummary,
  DashboardAttentionItem,
  DashboardRevenueSnapshot,
} from "../types";
import { buildRevenueSnapshotFromOrders } from "./revenue-from-orders";
import {
  buildStaffAttentionItems,
  buildStaffOpsSummary,
} from "./staff-ops-from-api";
import { adminOrdersService } from "@/features/admin-orders/services/admin-orders.service";
import { adminUsersService } from "@/features/admin-users/services/admin-users.service";
import { adminAuditService } from "@/features/admin-audit/services/admin-audit.service";
import { adminContactService } from "@/features/admin-contact/services/admin-contact.service";
import { adminProductsService } from "@/features/admin-products/services/admin-products.service";
import type { AdminProduct } from "@/features/admin-products/types";

export interface StaffOpsHome {
  summary: AdminDashboardSummary;
  attention: DashboardAttentionItem[];
}

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

async function loadProductSafe(): Promise<AdminProduct | null> {
  try {
    return await adminProductsService.getProduct();
  } catch {
    return null;
  }
}

/**
 * Dashboard domain — Staff ops + doanh thu + Admin home.
 * Aggregate phía client từ API đã có (orders-summary / orders / contact / products / users / audit).
 */
export const adminDashboardService = {
  /** KPI + Cần chú ý — một round-trip, chia SWR key chung. */
  async getStaffOps(): Promise<StaffOpsHome> {
    const [{ items: orders }, unreadContacts, product] = await Promise.all([
      adminOrdersService.list({}),
      adminContactService.list("unread"),
      loadProductSafe(),
    ]);
    return {
      summary: buildStaffOpsSummary({ orders, unreadContacts, product }),
      attention: buildStaffAttentionItems({ orders, unreadContacts, product }),
    };
  },

  /**
   * Doanh thu — Staff + Admin. `listSummary()` (không PII) — Admin gọi `list()` sẽ 403.
   */
  async getRevenue(): Promise<DashboardRevenueSnapshot> {
    const orders = await adminOrdersService.listSummary();
    return buildRevenueSnapshotFromOrders(orders);
  },

  /** Admin `/admin` — doanh thu + users + audit gần đây. */
  async getAdminHome(): Promise<AdminHomeSummary> {
    const [orders, users, { items: audit }] = await Promise.all([
      adminOrdersService.listSummary(),
      adminUsersService.list({}),
      adminAuditService.list({ limit: 5 }),
    ]);

    const asOf = startOfDay(new Date());
    const weekStart = addDays(asOf, -6);
    const newLast7Days = users.filter((u) => {
      const created = startOfDay(new Date(u.createdAt));
      return created >= weekStart && created <= asOf;
    }).length;

    return {
      revenue: buildRevenueSnapshotFromOrders(orders),
      users: {
        total: users.length,
        newLast7Days,
        staffCount: users.filter((u) => u.role === "staff").length,
        adminCount: users.filter((u) => u.role === "admin").length,
      },
      recentAudit: audit.map((row) => ({
        id: row.id,
        action: row.action,
        summary: row.summary,
        actorEmail: row.actorEmail,
        createdAt: row.createdAt,
      })),
    };
  },
};
