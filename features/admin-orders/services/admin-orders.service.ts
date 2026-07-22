import { sleep } from "@/lib/utils";
import {
  ADMIN_ORDER_STATUS_TRANSITIONS,
  ADMIN_ORDERS_MOCK_LATENCY_MS,
} from "../constants";
import { MOCK_ADMIN_ORDERS } from "../data/orders.mock";
import type {
  AdminOrder,
  AdminOrderListQuery,
  AdminOrderStatus,
} from "../types";

/** Bản sao mutable in-memory — phase mock; API thật sẽ không cần. */
let ordersStore: AdminOrder[] = structuredClone(MOCK_ADMIN_ORDERS);

function endOfDayIso(dateIso: string): string {
  const d = new Date(dateIso);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Admin orders domain (S3).
 * Phase mock: list/filter/detail/updateStatus trên store in-memory.
 * Khi có API: đổi thân các method → `app/api/admin/orders/**` hoặc Supabase;
 * giữ chữ ký + types.
 */
export const adminOrdersService = {
  async list(query: AdminOrderListQuery = {}): Promise<AdminOrder[]> {
    await sleep(ADMIN_ORDERS_MOCK_LATENCY_MS);
    const status = query.status ?? "all";
    let rows = [...ordersStore];

    if (status !== "all") {
      rows = rows.filter((o) => o.status === status);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      rows = rows.filter((o) => new Date(o.createdAt).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(endOfDayIso(query.to)).getTime();
      rows = rows.filter((o) => new Date(o.createdAt).getTime() <= toMs);
    }

    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getById(id: string): Promise<AdminOrder | null> {
    await sleep(ADMIN_ORDERS_MOCK_LATENCY_MS);
    return ordersStore.find((o) => o.id === id) ?? null;
  },

  async updateStatus(
    id: string,
    nextStatus: AdminOrderStatus,
    options?: { note?: string; actorLabel?: string }
  ): Promise<AdminOrder> {
    await sleep(ADMIN_ORDERS_MOCK_LATENCY_MS);
    const idx = ordersStore.findIndex((o) => o.id === id);
    if (idx < 0) {
      throw new Error("Không tìm thấy đơn hàng.");
    }

    const current = ordersStore[idx];
    const allowed = ADMIN_ORDER_STATUS_TRANSITIONS[current.status];
    if (!allowed.includes(nextStatus)) {
      throw new Error("Không thể chuyển sang trạng thái này.");
    }

    const now = new Date().toISOString();
    const updated: AdminOrder = {
      ...current,
      status: nextStatus,
      updatedAt: now,
      statusHistory: [
        ...current.statusHistory,
        {
          id: `log-${id}-${now}`,
          status: nextStatus,
          note: options?.note?.trim() || undefined,
          changedByLabel: options?.actorLabel?.trim() || "Staff",
          createdAt: now,
        },
      ],
    };

    ordersStore = [
      ...ordersStore.slice(0, idx),
      updated,
      ...ordersStore.slice(idx + 1),
    ];
    return updated;
  },
};
