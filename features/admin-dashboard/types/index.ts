/**
 * Tổng quan vận hành (S2) — shape ổn định khi đổi mock → API/Supabase.
 * Map tương lai: orders (new / needing action), contact_messages unread, products.stock.
 */
export interface AdminDashboardSummary {
  /** Đơn mới trong cửa sổ gần đây (vd. 24h). */
  newOrdersCount: number;
  /** Đơn đang chờ xử lý (chưa hoàn tất / cần thao tác). */
  ordersNeedingAction: number;
  /** Tin Liên hệ chưa đọc. */
  unreadContacts: number;
  /** Tồn kho hiện tại của SKU Nutein khi ở mức thấp (đơn vị còn lại). */
  lowStock: number;
}
