import { apiRequest } from "@/lib/api-client";
import { ACCOUNT_ORDERS_API_PATH } from "../constants";
import type { AccountOrder, AccountOrderDetail } from "../types";

/**
 * Client wrapper cho các route đơn hàng của chính khách (RFC-3 -> UI RFC-4).
 * Business logic nằm ở `account-order.service.ts` (server-only) và ở RPC —
 * file này chỉ gọi HTTP, KHÔNG chứa quyết định trạng thái nào.
 */

/** Kết quả chung của claim / cancel — trạng thái THẬT sau thao tác. */
export interface AccountOrderActionResult {
  orderId: string;
  changed: boolean;
  reviewState: string | null;
  stateVersion: number;
  paymentStatus: "UNPAID" | "PAID";
}

export const accountOrderClient = {
  listOrders(): Promise<AccountOrder[]> {
    return apiRequest<AccountOrder[]>(ACCOUNT_ORDERS_API_PATH);
  },

  /**
   * `cache: "no-store"` ở CẢ hai phía: route đã set `Cache-Control: no-store`,
   * còn đây chặn bfcache/HTTP cache của chính browser. Trang success và trang
   * chi tiết phải đọc trạng thái thật sau reload hoặc khi mở ở tab thứ hai,
   * không được tin snapshot cũ (plan: "không tin localStorage là trạng thái thật").
   */
  getOrderDetail(orderId: string): Promise<AccountOrderDetail> {
    return apiRequest<AccountOrderDetail>(
      `${ACCOUNT_ORDERS_API_PATH}/${encodeURIComponent(orderId)}`,
      { cache: "no-store" },
    );
  },

  /** "Tôi đã chuyển khoản" — LỜI KHAI, không đặt PAID. */
  claimPayment(
    orderId: string,
    body: { expectedVersion?: number; note?: string } = {},
  ): Promise<AccountOrderActionResult> {
    return apiRequest<AccountOrderActionResult>(
      `${ACCOUNT_ORDERS_API_PATH}/${encodeURIComponent(orderId)}/payment-claim`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  /** YÊU CẦU hủy — không phải đã hủy, không hứa hoàn kho/hoàn tiền. */
  requestCancel(
    orderId: string,
    body: { expectedVersion?: number; reason?: string } = {},
  ): Promise<AccountOrderActionResult> {
    return apiRequest<AccountOrderActionResult>(
      `${ACCOUNT_ORDERS_API_PATH}/${encodeURIComponent(orderId)}/cancel`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },
};
