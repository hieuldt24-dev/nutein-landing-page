/**
 * Admin orders (S3) — shape ổn định khi đổi mock → API/Supabase `orders` + `order_status_logs`.
 * Status map DB enum OrderStatus (lowercase phía app).
 */

export type AdminOrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

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
  paymentStatus: "paid" | "unpaid";
  shippingFee: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  lines: AdminOrderLine[];
  statusHistory: AdminOrderStatusLog[];
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
}
