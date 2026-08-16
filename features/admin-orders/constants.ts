import type { AdminOrderStatus } from "./types";

/** SWR-as-store — sau này có thể đổi sang `/api/admin/orders`. */
export const ADMIN_ORDERS_SWR_KEY = "admin-orders-list";

export function adminOrderDetailSwrKey(id: string): string {
  return `admin-order:${id}`;
}

export const ADMIN_ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  returned: "Trả hàng",
};

/** Chuyển trạng thái hợp lệ (S3) — mirror luồng vận hành REQUIREMENTS. */
export const ADMIN_ORDER_STATUS_TRANSITIONS: Record<
  AdminOrderStatus,
  readonly AdminOrderStatus[]
> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};
