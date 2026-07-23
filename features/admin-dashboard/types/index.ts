/**
 * Dashboard tổng quan — Staff (doanh thu + vận hành) / Admin (doanh thu + users + audit).
 * Shape ổn định khi đổi mock → API.
 */

/** Doanh thu dùng chung Staff + Admin. */
export interface DashboardRevenueSnapshot {
  /** Mốc thời gian tính cửa sổ (ISO) — mock neo theo đơn mới nhất. */
  asOf: string;
  todayVnd: number;
  weekVnd: number;
  monthVnd: number;
  /** Số đơn tính vào doanh thu trong 30 ngày (không hủy/trả). */
  monthOrderCount: number;
  /** 7 ngày gần `asOf` — dùng vẽ AreaChart doanh thu. */
  last7Days: { date: string; amountVnd: number }[];
}

/** Điểm bar “đơn mới theo ngày” (Staff). */
export interface DashboardOrdersByDayPoint {
  date: string;
  /** Tổng đơn tạo trong ngày. */
  newCount: number;
  /** Đơn status cancelled (cùng ngày tạo). */
  cancelledCount: number;
}

/** Slice cho pie/donut (Bklit PieChart). */
export interface DashboardPieSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Tổng quan vận hành (S2 Staff) — đơn / liên hệ / tồn.
 * Map tương lai: orders, contact_messages, products.stock.
 */
export interface AdminDashboardSummary {
  newOrdersCount: number;
  ordersNeedingAction: number;
  unreadContacts: number;
  lowStock: number;
}

export interface AdminHomeUsersSnapshot {
  total: number;
  userCount: number;
  staffCount: number;
  adminCount: number;
  lockedCount: number;
  /** Phân bố role — dùng PieChart. */
  roleBreakdown: DashboardPieSlice[];
}

export interface AdminHomeAuditPreviewItem {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  summary: string;
  actorEmail: string;
  createdAt: string;
}

/** Tổng quan Admin `/admin` — doanh thu + users + audit gần đây. */
export interface AdminHomeSummary {
  revenue: DashboardRevenueSnapshot;
  users: AdminHomeUsersSnapshot;
  recentAudit: AdminHomeAuditPreviewItem[];
}
