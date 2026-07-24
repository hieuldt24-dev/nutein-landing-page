import type { AdminDashboardSummary } from "../types";

/**
 * Số liệu demo S2 — chỉ `admin-dashboard.service` được import.
 * Khi gắn API: xóa / cô lập file này.
 */
export const MOCK_ADMIN_DASHBOARD_SUMMARY: AdminDashboardSummary = {
  newOrdersCount: 5,
  ordersNeedingAction: 3,
  unreadContacts: 8,
  lowStock: 12,
};
