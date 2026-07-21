import "server-only";

import type { AccountOrder, AccountOrderStatus } from "../types";
import { supabaseAdmin } from "@/lib/supabase";

type DbOrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

interface OrderListRow {
  id: string;
  order_code: string;
  status: DbOrderStatus;
  shipping_method: "STANDARD" | "EXPRESS";
  final_price: number | string;
  created_at: string;
  shipping_address: {
    variantLabel?: string;
  } | null;
  order_items:
    | {
        quantity: number;
        variant_info: string | null;
      }[]
    | null;
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function mapStatus(status: DbOrderStatus): AccountOrderStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "PROCESSING":
      return "processing";
    case "SHIPPED":
      return "shipping";
    case "DELIVERED":
      return "completed";
    case "CANCELLED":
    case "RETURNED":
      return "cancelled";
    default:
      return "processing";
  }
}

function estimatedDeliveryLabel(
  method: "STANDARD" | "EXPRESS",
  status: AccountOrderStatus,
): string | undefined {
  if (status === "completed" || status === "cancelled") return undefined;
  return method === "EXPRESS"
    ? "Dự kiến giao trong 1–2 ngày làm việc"
    : "Dự kiến giao trong 3–5 ngày làm việc";
}

function toAccountOrder(row: OrderListRow): AccountOrder {
  const items = row.order_items ?? [];
  const status = mapStatus(row.status);
  const jarTotal = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const labels = items
    .map((item) => item.variant_info?.trim())
    .filter((label): label is string => Boolean(label));
  const uniqueLabels = [...new Set(labels)];
  const variantLabel =
    uniqueLabels.length > 0
      ? uniqueLabels.join(" + ")
      : row.shipping_address?.variantLabel?.trim() || "1 hộp";

  return {
    id: row.id,
    orderCode: row.order_code,
    status,
    createdAt: row.created_at,
    quantity: jarTotal,
    variantLabel,
    total: Number(row.final_price),
    estimatedDeliveryLabel: estimatedDeliveryLabel(row.shipping_method, status),
  };
}

/** Lịch sử đơn — đọc `orders.order_code` + `order_items`. */
export const accountOrderService = {
  async listOrders(userId: string): Promise<AccountOrder[]> {
    const { data, error } = await requireAdminClient()
      .from("orders")
      .select(
        `
        id,
        order_code,
        status,
        shipping_method,
        final_price,
        created_at,
        shipping_address,
        order_items ( quantity, variant_info )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Không tải được lịch sử đơn: ${error.message}`);
    }

    return ((data as OrderListRow[]) ?? []).map(toAccountOrder);
  },
};
