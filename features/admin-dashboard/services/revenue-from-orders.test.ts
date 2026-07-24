import { describe, expect, it } from "vitest";
import { buildRevenueSnapshotFromOrders } from "./revenue-from-orders";
import type { AdminOrder } from "@/features/admin-orders/types";

function order(
  partial: Pick<AdminOrder, "id" | "status" | "createdAt" | "total">,
): AdminOrder {
  return {
    orderCode: partial.id,
    updatedAt: partial.createdAt,
    customerName: "Test",
    customerEmail: "t@example.com",
    customerPhone: "0900000000",
    shippingAddressLabel: "HN",
    paymentMethodLabel: "COD",
    paymentStatus: "unpaid",
    shippingFee: 0,
    discountAmount: 0,
    subtotal: partial.total,
    lines: [],
    statusHistory: [],
    ...partial,
  };
}

describe("buildRevenueSnapshotFromOrders", () => {
  it("bỏ đơn cancelled/returned và neo theo đơn mới nhất", () => {
    const rows = [
      order({
        id: "1",
        status: "delivered",
        createdAt: "2026-07-20T10:00:00.000Z",
        total: 100_000,
      }),
      order({
        id: "2",
        status: "cancelled",
        createdAt: "2026-07-21T10:00:00.000Z",
        total: 999_000,
      }),
      order({
        id: "3",
        status: "processing",
        createdAt: "2026-07-21T12:00:00.000Z",
        total: 50_000,
      }),
    ];

    const snap = buildRevenueSnapshotFromOrders(rows);
    expect(snap.todayVnd).toBe(50_000);
    expect(snap.weekVnd).toBe(150_000);
    expect(snap.monthOrderCount).toBe(2);
    expect(snap.last7Days).toHaveLength(7);
  });
});
