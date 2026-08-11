import type { AdminOrder } from "@/features/admin-orders/types";
import type { AdminContactMessage } from "@/features/admin-contact/types";
import type { AdminProduct } from "@/features/admin-products/types";
import { ADMIN_LOW_STOCK_THRESHOLD } from "../constants";
import type {
  AdminDashboardSummary,
  DashboardAttentionItem,
} from "../types";

const ACTION_STATUSES = new Set(["pending", "processing"]);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

/**
 * KPI vận hành Staff — từ orders (đầy đủ) + contact unread + product stock.
 */
export function buildStaffOpsSummary(input: {
  orders: AdminOrder[];
  unreadContacts: AdminContactMessage[];
  product: AdminProduct | null;
}): AdminDashboardSummary {
  const today = startOfDay(new Date());
  const newOrdersCount = input.orders.filter(
    (o) => startOfDay(new Date(o.createdAt)).getTime() === today.getTime(),
  ).length;
  const ordersNeedingAction = input.orders.filter((o) =>
    ACTION_STATUSES.has(o.status),
  ).length;
  const lowStock =
    input.product && input.product.stock < ADMIN_LOW_STOCK_THRESHOLD ? 1 : 0;

  return {
    newOrdersCount,
    ordersNeedingAction,
    unreadContacts: input.unreadContacts.length,
    lowStock,
  };
}

/**
 * List “Cần chú ý” — tối đa vài dòng, deep-link sang module tương ứng.
 */
export function buildStaffAttentionItems(input: {
  orders: AdminOrder[];
  unreadContacts: AdminContactMessage[];
  product: AdminProduct | null;
}): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];

  const stalePending = input.orders
    .filter((o) => o.status === "pending" && hoursAgo(o.createdAt) >= 2)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(0, 2);

  for (const order of stalePending) {
    items.push({
      id: `order-${order.id}`,
      kind: "order",
      message: `Đơn ${order.orderCode} chờ xác nhận quá 2 giờ`,
      href: `/staff/orders/${order.id}`,
      createdAt: order.createdAt,
    });
  }

  if (input.unreadContacts.length > 0) {
    const newest = [...input.unreadContacts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    items.push({
      id: "contact-unread",
      kind: "contact",
      message: `${input.unreadContacts.length} liên hệ chưa đọc từ form tư vấn`,
      href: "/staff/contact",
      createdAt: newest.createdAt,
    });
  }

  if (input.product && input.product.stock < ADMIN_LOW_STOCK_THRESHOLD) {
    items.push({
      id: `product-${input.product.id}`,
      kind: "product",
      message: `${input.product.name} còn ${input.product.stock} — dưới ngưỡng tồn kho`,
      href: "/staff/products",
      createdAt: input.product.updatedAt,
      urgent: true,
    });
  }

  return items.slice(0, 5);
}
