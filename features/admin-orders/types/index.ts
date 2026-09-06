/**
 * Admin orders (S3) — shape ổn định khi đổi mock → API/Supabase `orders` + `order_status_logs`.
 * Status map DB enum OrderStatus (lowercase phía app).
 */

export type AdminOrderStatus =
  "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";

export interface AdminOrderStatusLog {
  id: string;
  status: AdminOrderStatus;
  note?: string;
  changedByLabel: string;
  createdAt: string;
}

export interface AdminOrderLine {
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrder {
  id: string;
  orderCode: string;
  status: AdminOrderStatus;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressLabel: string;
  note?: string;
  paymentMethodLabel: string;
  /** Giá trị enum thô trong DB (VD "BANK_TRANSFER", "COD") — UI dùng để gate action. */
  paymentMethod: string;
  paymentStatus: "paid" | "unpaid";
  shippingFee: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  lines: AdminOrderLine[];
  statusHistory: AdminOrderStatusLog[];
  /**
   * Bốn field dưới đây đến từ các cột RFC-2 (`payment_review_state`,
   * `payment_expires_at`, `review_due_at`, `state_version`).
   *
   * TẤT CẢ đều OPTIONAL có chủ đích: migration RFC-2 CHƯA được apply. Trên
   * database hiện tại các cột này không tồn tại và repository trả `undefined`
   * — UI phải chạy đúng ở cả hai trạng thái. Đừng biến chúng thành bắt buộc
   * trước khi cutover xong.
   */
  paymentReviewState?: string | null;
  paymentExpiresAt?: string | null;
  reviewDueAt?: string | null;
  /** `expectedVersion` cho confirm-payment / resolve-payment-review. */
  stateVersion?: number | null;
}

/** Kết quả `POST /api/staff/orders/[id]/resolve-payment-review`. */
export interface ResolvePaymentReviewResult {
  orderId: string;
  changed: boolean;
  status: string;
  paymentStatus: string;
  reviewState: string | null;
  stateVersion: number;
}

/**
 * Dòng tổng hợp cho dashboard (doanh thu/breakdown) — KHÔNG chứa PII khách
 * hàng (tên/SĐT/địa chỉ). Admin không có quyền xem chi tiết đơn (S3) nhưng
 * vẫn cần số liệu tổng hợp cho `/admin` — dùng type/endpoint riêng này thay
 * vì mở quyền `AdminOrder` đầy đủ cho Admin.
 */
export interface AdminOrderSummaryRow {
  status: AdminOrderStatus;
  total: number;
  createdAt: string;
}

export type AdminOrderStatusFilter = AdminOrderStatus | "all";

export interface AdminOrderListQuery {
  status?: AdminOrderStatusFilter;
  /** ISO date từ (inclusive) — lọc createdAt. */
  from?: string;
  /** ISO date đến (inclusive end of day) — lọc createdAt. */
  to?: string;
  /** Tìm mã đơn / tên / email (tuỳ chọn). */
  q?: string;
  /** Số dòng mỗi trang — omit = trả hết (dashboard). */
  limit?: number;
  /** Offset 0-based — chỉ dùng khi có limit. */
  offset?: number;
}

/** Kết quả list có tổng để phân trang. */
export interface AdminOrderListResult {
  items: AdminOrder[];
  total: number;
}
