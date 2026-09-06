import { apiRequest, type FetchError } from "@/lib/api-client";
import type {
  AdminOrder,
  AdminOrderListQuery,
  AdminOrderListResult,
  AdminOrderStatus,
  AdminOrderSummaryRow,
  ResolvePaymentReviewResult,
} from "../types";

const BASE_PATH = "/api/staff/orders";
const SUMMARY_PATH = "/api/admin/orders-summary";

function buildListQueryString(query: AdminOrderListQuery): string {
  const params = new URLSearchParams();
  if (query.status && query.status !== "all")
    params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin orders domain (S3) — client fetch wrapper gọi `app/api/staff/orders/**`.
 * Business logic/DB thật nằm ở `admin-orders.repository.ts` (server-only).
 */
export const adminOrdersService = {
  async list(query: AdminOrderListQuery = {}): Promise<AdminOrderListResult> {
    return apiRequest<AdminOrderListResult>(
      `${BASE_PATH}${buildListQueryString(query)}`,
    );
  },

  async getById(id: string): Promise<AdminOrder | null> {
    try {
      return await apiRequest<AdminOrder>(`${BASE_PATH}/${id}`);
    } catch (err) {
      if ((err as FetchError)?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  async updateStatus(
    id: string,
    nextStatus: AdminOrderStatus,
    options?: { note?: string },
  ): Promise<AdminOrder> {
    return apiRequest<AdminOrder>(`${BASE_PATH}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, note: options?.note }),
    });
  },

  /**
   * Xác nhận đã nhận tiền chuyển khoản — hành động thủ công của Staff, chỉ
   * áp dụng cho đơn BANK_TRANSFER đang UNPAID.
   */
  async confirmPayment(
    id: string,
    expectedVersion?: number | null,
  ): Promise<AdminOrder> {
    return apiRequest<AdminOrder>(`${BASE_PATH}/${id}/confirm-payment`, {
      method: "POST",
      body: JSON.stringify(expectedVersion == null ? {} : { expectedVersion }),
    });
  },

  /**
   * Kết luận đối soát của nhân viên (RFC-3 route).
   * `no-transfer` là đường DUY NHẤT giải phóng kho/coupon/slot; không nhánh nào
   * ở đây đặt PAID — đó là việc của `confirmPayment`.
   */
  async resolvePaymentReview(
    id: string,
    body: {
      outcome: "no-transfer" | "needs-investigation";
      reason: string;
      expectedVersion: number;
      statementCheckedFrom?: string;
      statementCheckedTo?: string;
      reference?: string;
    },
  ): Promise<ResolvePaymentReviewResult> {
    return apiRequest<ResolvePaymentReviewResult>(
      `${BASE_PATH}/${id}/resolve-payment-review`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  /**
   * Tổng hợp không PII (status/total/createdAt) cho dashboard — gọi được
   * bởi cả STAFF lẫn ADMIN, khác `list()` (chi tiết đầy đủ, chỉ STAFF).
   */
  async listSummary(): Promise<AdminOrderSummaryRow[]> {
    return apiRequest<AdminOrderSummaryRow[]>(SUMMARY_PATH);
  },
};
