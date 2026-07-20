import type { AccountOrder } from "../types";

/**
 * Mock lịch sử đơn — khi có DB: `accountOrderService.listOrders` đọc theo session.
 * Single-SKU: mỗi đơn 1 dòng (quantity + variantLabel).
 * Chỉ service được import file này — UI không import mock trực tiếp.
 */
export const MOCK_ACCOUNT_ORDERS: AccountOrder[] = [
  {
    id: "ord-mock-1",
    orderCode: "NT-20260718-A1B2",
    status: "shipping",
    createdAt: "2026-07-18T09:30:00.000Z",
    quantity: 3,
    variantLabel: "3 hộp",
    total: 747_000,
    estimatedDeliveryLabel: "Dự kiến giao trong 3–5 ngày làm việc",
  },
  {
    id: "ord-mock-2",
    orderCode: "NT-20260710-C3D4",
    status: "processing",
    createdAt: "2026-07-10T14:15:00.000Z",
    quantity: 1,
    variantLabel: "1 hộp",
    total: 249_000,
    estimatedDeliveryLabel: "Dự kiến giao trong 3–5 ngày làm việc",
  },
  {
    id: "ord-mock-3",
    orderCode: "NT-20260622-E5F6",
    status: "completed",
    createdAt: "2026-06-22T11:00:00.000Z",
    quantity: 6,
    variantLabel: "6 hộp",
    total: 1_344_600,
  },
];
