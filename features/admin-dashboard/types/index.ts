/**
 * Dashboard tổng quan — Staff (doanh thu + vận hành) / Admin (doanh thu + users + audit).
 */

/** Doanh thu dùng chung Staff + Admin. */
export interface DashboardRevenueSnapshot {
  /** Mốc thời gian tính cửa sổ (ISO) — neo theo đơn mới nhất / now. */
  asOf: string;
  todayVnd: number;
  weekVnd: number;
  /** 7 ngày liền trước cửa sổ week hiện tại (để % so sánh). */
  previousWeekVnd: number;
  /**
   * % đổi weekVnd vs previousWeekVnd.
   * `null` khi previousWeek = 0 và week cũng 0 (không hiển thị badge).
   */
  weekChangePercent: number | null;
  monthVnd: number;
  /** Số đơn tính vào doanh thu trong 30 ngày (không hủy/trả). */
  monthOrderCount: number;
  /** 7 ngày gần `asOf` — AreaChart doanh thu. */
  last7Days: { date: string; amountVnd: number }[];
}

/**
 * Tổng quan vận hành (S2 Staff) — đơn / liên hệ / tồn.
 * Derive từ API orders / contact / products.
 */
export interface AdminDashboardSummary {
  newOrdersCount: number;
  ordersNeedingAction: number;
  unreadContacts: number;
  lowStock: number;
}

export type DashboardAttentionKind = "order" | "contact" | "product";

/** Một dòng “Cần chú ý” trên Staff home. */
export interface DashboardAttentionItem {
  id: string;
  kind: DashboardAttentionKind;
  /** Copy tiếng Việt, có thể chứa mã đơn / tên SP. */
  message: string;
  href: string;
  createdAt: string;
  /** true = ưu tiên danger (vd. tồn kho). */
  urgent?: boolean;
}

export interface AdminHomeUsersSnapshot {
  total: number;
  /** User tạo trong 7 ngày gần asOf. */
  newLast7Days: number;
  staffCount: number;
  adminCount: number;
}

export interface AdminHomeAuditPreviewItem {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  summary: string;
  /** null khi không xác định được actor. */
  actorEmail: string | null;
  createdAt: string;
}

/** Tổng quan Admin `/admin` — doanh thu + users + audit gần đây. */
export interface AdminHomeSummary {
  revenue: DashboardRevenueSnapshot;
  users: AdminHomeUsersSnapshot;
  recentAudit: AdminHomeAuditPreviewItem[];
}
