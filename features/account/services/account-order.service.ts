import "server-only";

import { MOCK_ACCOUNT_ORDERS } from "../data/orders.mock";
import type { AccountOrder } from "../types";

/**
 * Lịch sử đơn — v1 mock constants.
 * Khi có DB/session: filter theo user, giữ chữ ký `listOrders`.
 */
export const accountOrderService = {
  async listOrders(_email?: string | null): Promise<AccountOrder[]> {
    // Mock: trả list demo. Email dành cho filter tương lai.
    void _email;
    return [...MOCK_ACCOUNT_ORDERS].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
};
