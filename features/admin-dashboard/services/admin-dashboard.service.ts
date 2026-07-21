import { ADMIN_DASHBOARD_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_DASHBOARD_SUMMARY } from "../data/dashboard.mock";
import type { AdminDashboardSummary } from "../types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Admin dashboard domain (S2).
 * Phase 1: đọc mock. Khi có API: đổi thân `getSummary` →
 * `GET /api/admin/dashboard` hoặc query Supabase — giữ chữ ký + `AdminDashboardSummary`.
 */
export const adminDashboardService = {
  async getSummary(): Promise<AdminDashboardSummary> {
    await delay(ADMIN_DASHBOARD_MOCK_LATENCY_MS);
    return { ...MOCK_ADMIN_DASHBOARD_SUMMARY };
  },
};
