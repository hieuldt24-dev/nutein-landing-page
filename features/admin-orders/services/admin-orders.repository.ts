import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { BadRequestError, NotFoundError } from "@/src/errors/app.error";
import { auditLogRepository } from "@/features/admin-audit/services/audit-log.repository";
import {
  ADMIN_ORDER_STATUS_LABEL,
  ADMIN_ORDER_STATUS_TRANSITIONS,
} from "../constants";
import type {
  AdminOrder,
  AdminOrderListQuery,
  AdminOrderListResult,
  AdminOrderStatus,
  AdminOrderStatusLog,
  AdminOrderSummaryRow,
} from "../types";

type DbOrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "COD — Thanh toán khi nhận hàng",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  MOMO: "Ví điện tử",
  VNPAY: "VNPay",
  PAYOS: "Chuyển khoản ngân hàng (payOS)",
};

interface OrderShippingAddressSnapshot {
  fullName: string;
  phone: string;
  email: string;
  street: string;
  ward: string;
  province: string;
}

interface OrderItemRow {
  product_name: string;
  variant_info: string | null;
  price: number;
  quantity: number;
}

interface OrderRow {
  id: string;
  order_code: string;
  status: DbOrderStatus;
  payment_method: string;
  payment_status: "UNPAID" | "PAID";
  shipping_address: OrderShippingAddressSnapshot | null;
  note: string | null;
  shipping_fee: number;
  discount_amount: number;
  total_price: number;
  final_price: number;
  created_at: string;
  updated_at: string;
  order_items: OrderItemRow[] | null;
}

interface OrderStatusLogRow {
  id: string;
  status: DbOrderStatus;
  note: string | null;
  created_at: string;
  changed_by: { name: string | null; email: string } | null;
}

const ORDER_SELECT =
  "id, order_code, status, payment_method, payment_status, shipping_address, note, shipping_fee, discount_amount, total_price, final_price, created_at, updated_at, order_items(product_name, variant_info, price, quantity)";

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function toDbStatus(status: AdminOrderStatus): DbOrderStatus {
  return status.toUpperCase() as DbOrderStatus;
}

function toAppStatus(status: DbOrderStatus): AdminOrderStatus {
  return status.toLowerCase() as AdminOrderStatus;
}

function endOfDayIso(dateIso: string): string {
  const d = new Date(dateIso);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Escape ký tự đặc biệt của PostgREST `ilike` / filter. */
function escapeIlike(value: string): string {
  return value.replace(/[%_,.\\]/g, "\\$&");
}

function toAdminOrder(order: OrderRow, logs: OrderStatusLogRow[]): AdminOrder {
  const address = order.shipping_address;
  const lines = (order.order_items ?? []).map((item) => ({
    productName: item.product_name,
    variantLabel: item.variant_info ?? "—",
    quantity: item.quantity,
    unitPrice: Number(item.price),
    lineTotal: Number(item.price) * item.quantity,
  }));

  const statusHistory: AdminOrderStatusLog[] = logs.map((log) => ({
    id: log.id,
    status: toAppStatus(log.status),
    note: log.note ?? undefined,
    changedByLabel: log.changed_by?.name || log.changed_by?.email || "—",
    createdAt: log.created_at,
  }));

  return {
    id: order.id,
    orderCode: order.order_code,
    status: toAppStatus(order.status),
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customerName: address?.fullName ?? "—",
    customerEmail: address?.email ?? "—",
    customerPhone: address?.phone ?? "—",
    shippingAddressLabel: address
      ? [address.street, address.ward, address.province].filter(Boolean).join(", ")
      : "—",
    note: order.note ?? undefined,
    paymentMethodLabel: PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method,
    paymentStatus: order.payment_status === "PAID" ? "paid" : "unpaid",
    shippingFee: Number(order.shipping_fee),
    discountAmount: Number(order.discount_amount),
    subtotal: Number(order.total_price),
    total: Number(order.final_price),
    lines,
    statusHistory,
  };
}

async function fetchStatusLogs(orderId: string): Promise<OrderStatusLogRow[]> {
  const client = requireAdminClient();
  const { data: logs, error } = await client
    .from("order_status_logs")
    .select("id, status, note, created_at, changed_by:users(name, email)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Không tải được lịch sử trạng thái: ${error.message}`);
  }
  return (logs as unknown as OrderStatusLogRow[]) ?? [];
}

/**
 * Dữ liệu tổng hợp cho dashboard (doanh thu/breakdown theo status/ngày) —
 * KHÔNG select shipping_address/order_items, chỉ 3 field cần cho tính
 * toán. Route gọi hàm này (`/api/admin/orders-summary`) cho phép cả
 * STAFF lẫn ADMIN — khác `list()`/`getById()` chỉ STAFF (S3, chứa PII).
 */
async function listSummary(): Promise<AdminOrderSummaryRow[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("orders")
    .select("status, final_price, created_at");

  if (error) {
    throw new Error(`Không tải được tổng hợp đơn: ${error.message}`);
  }

  return ((data as { status: DbOrderStatus; final_price: number; created_at: string }[]) ?? []).map(
    (row) => ({
      status: toAppStatus(row.status),
      total: Number(row.final_price),
      createdAt: row.created_at,
    }),
  );
}

async function list(query: AdminOrderListQuery = {}): Promise<AdminOrderListResult> {
  const client = requireAdminClient();
  let builder = client.from("orders").select(ORDER_SELECT, { count: "exact" });

  if (query.status && query.status !== "all") {
    builder = builder.eq("status", toDbStatus(query.status));
  }
  if (query.from) {
    builder = builder.gte("created_at", new Date(query.from).toISOString());
  }
  if (query.to) {
    builder = builder.lte("created_at", endOfDayIso(query.to));
  }
  const needle = query.q?.trim();
  if (needle) {
    const q = escapeIlike(needle);
    builder = builder.or(
      `order_code.ilike.%${q}%,shipping_address->>fullName.ilike.%${q}%,shipping_address->>email.ilike.%${q}%`,
    );
  }

  builder = builder.order("created_at", { ascending: false });

  // Có `limit` → phân trang; omit → trả hết (dashboard Staff ops).
  if (query.limit != null) {
    const offset = query.offset ?? 0;
    builder = builder.range(offset, offset + query.limit - 1);
  }

  const { data, error, count } = await builder;

  if (error) {
    throw new Error(`Không tải được danh sách đơn: ${error.message}`);
  }

  const items = ((data as OrderRow[]) ?? []).map((row) => toAdminOrder(row, []));
  return {
    items,
    total: count ?? items.length,
  };
}

async function getById(id: string): Promise<AdminOrder | null> {
  const client = requireAdminClient();
  const { data: order, error: orderError } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Không tải được đơn hàng: ${orderError.message}`);
  }
  if (!order) {
    return null;
  }

  const logs = await fetchStatusLogs(id);
  return toAdminOrder(order as OrderRow, logs);
}

async function updateStatus(
  id: string,
  nextStatus: AdminOrderStatus,
  staffUserId: string,
  note?: string,
): Promise<AdminOrder> {
  const client = requireAdminClient();

  const { data: current, error: currentError } = await client
    .from("orders")
    .select("status, payment_method, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    throw new Error(`Không tra được đơn hàng: ${currentError.message}`);
  }
  if (!current) {
    throw new NotFoundError("Đơn hàng");
  }

  const currentStatus = toAppStatus(current.status as DbOrderStatus);
  const allowedNext = ADMIN_ORDER_STATUS_TRANSITIONS[currentStatus];
  if (!allowedNext.includes(nextStatus)) {
    throw new BadRequestError(
      `Không thể chuyển từ "${ADMIN_ORDER_STATUS_LABEL[currentStatus]}" sang "${ADMIN_ORDER_STATUS_LABEL[nextStatus]}".`,
    );
  }

  const updatePayload: {
    status: DbOrderStatus;
    handled_by: string;
    payment_status?: "PAID";
  } = {
    status: toDbStatus(nextStatus),
    handled_by: staffUserId,
  };
  // COD thu tiền lúc giao hàng — không có webhook nào set payment_status
  // như payOS, nên tự đánh PAID khi đơn chuyển sang "delivered".
  if (
    nextStatus === "delivered" &&
    current.payment_method === "COD" &&
    current.payment_status !== "PAID"
  ) {
    updatePayload.payment_status = "PAID";
  }

  // Gộp update + refetch order/items vào 1 round trip (select trên chính
  // response của update) thay vì update rồi getById riêng.
  const { data: updatedOrder, error: updateError } = await client
    .from("orders")
    .update(updatePayload)
    .eq("id", id)
    .select(ORDER_SELECT)
    .single();

  if (updateError) {
    throw new Error(`Không cập nhật được trạng thái đơn: ${updateError.message}`);
  }

  // Trigger DB tự chèn order_status_logs (order_id, status, changed_by) khi
  // status đổi, nhưng KHÔNG nhận note — patch lại dòng vừa chèn nếu có note.
  const trimmedNote = note?.trim();
  if (trimmedNote) {
    const { data: latestLog, error: latestLogError } = await client
      .from("order_status_logs")
      .select("id")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLogError) {
      throw new Error(`Không tra được log trạng thái: ${latestLogError.message}`);
    }
    if (latestLog) {
      const { error: noteError } = await client
        .from("order_status_logs")
        .update({ note: trimmedNote })
        .eq("id", latestLog.id);

      if (noteError) {
        throw new Error(`Không lưu được ghi chú: ${noteError.message}`);
      }
    }
  }

  await auditLogRepository.record({
    userId: staffUserId,
    action: "UPDATE",
    tableName: "orders",
    recordId: id,
    oldData: { status: current.status },
    newData: { status: updatePayload.status, payment_status: updatePayload.payment_status },
  });

  const logs = await fetchStatusLogs(id);
  return toAdminOrder(updatedOrder as OrderRow, logs);
}

/**
 * Admin orders domain (S3) — repo thật, thay `data/orders.mock.ts`.
 * Chỉ dùng trong Route Handler (`app/api/staff/orders/**` — full chi tiết,
 * chỉ STAFF; `app/api/admin/orders-summary` — tổng hợp không PII, cả
 * STAFF/ADMIN), không import từ client component — xem
 * `admin-orders.service.ts` (client fetch wrapper).
 */
export const adminOrdersRepository = {
  list,
  listSummary,
  getById,
  updateStatus,
};
