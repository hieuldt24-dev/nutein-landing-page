/** SWR key — KPI + Cần chú ý Staff (một fetch dùng chung). */
export const ADMIN_DASHBOARD_OPS_SWR_KEY = "admin-dashboard-ops";

/** SWR key — doanh thu chung Staff/Admin. */
export const ADMIN_DASHBOARD_REVENUE_SWR_KEY = "admin-dashboard-revenue";

/** SWR key — tổng quan Admin `/admin`. */
export const ADMIN_HOME_SWR_KEY = "admin-home-summary";

/**
 * Ngưỡng tồn thấp (single-SKU). Stock &lt; ngưỡng → KPI + attention.
 * Chưa có cấu hình admin — hằng số domain.
 */
export const ADMIN_LOW_STOCK_THRESHOLD = 20;
