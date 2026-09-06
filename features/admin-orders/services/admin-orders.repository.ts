import "server-only";

import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/src/errors/app.error";
import { auditLogRepository } from "@/features/admin-audit/services/audit-log.repository";
import {
  CheckoutRpcUnavailableError,
  orderRepository,
} from "@/features/checkout/services/order.repository";
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
  "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";

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
  /** Cột RFC-2 — chỉ có mặt sau khi migration được apply. */
  payment_review_state?: string | null;
  payment_expires_at?: string | null;
  review_due_at?: string | null;
  state_version?: number | null;
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

/**
 * Bản mở rộng có cột RFC-2, dùng cho hàng đợi đối soát của nhân viên.
 * Dùng TRƯỚC; nếu database chưa apply migration (42703) thì gọi lại bằng
 * `ORDER_SELECT` cũ để back-office không chết trong cửa sổ trước cutover.
 */
const ORDER_SELECT_WITH_PROTECTION = `${ORDER_SELECT}, payment_review_state, payment_expires_at, review_due_at, state_version`;

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/**
 * SQLSTATE 42703 = "column does not exist" — migration RFC-2 chưa được apply
 * trên database đang chạy. Back-office phải sống được ở CẢ HAI phía cutover,
 * nên mọi query có cột RFC-2 đều phải có đường lui về `ORDER_SELECT` cũ.
 */
function isMissingColumnError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "42703";
}

/** Gắn field đối soát (nếu row có) — dữ liệu vắng mặt thì để `undefined`. */
function withProtectionFields(order: AdminOrder, row: OrderRow): AdminOrder {
  if (!("state_version" in row) && !("payment_review_state" in row)) {
    return order;
  }
  return {
    ...order,
    paymentReviewState: row.payment_review_state ?? null,
    paymentExpiresAt: row.payment_expires_at ?? null,
    reviewDueAt: row.review_due_at ?? null,
    stateVersion: row.state_version ?? null,
  };
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
      ? [address.street, address.ward, address.province]
          .filter(Boolean)
          .join(", ")
      : "—",
    note: order.note ?? undefined,
    paymentMethodLabel:
      PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method,
    paymentMethod: order.payment_method,
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

  return (
    (data as {
      status: DbOrderStatus;
      final_price: number;
      created_at: string;
    }[]) ?? []
  ).map((row) => ({
    status: toAppStatus(row.status),
    total: Number(row.final_price),
    createdAt: row.created_at,
  }));
}

async function list(
  query: AdminOrderListQuery = {},
): Promise<AdminOrderListResult> {
  const client = requireAdminClient();

  const runQuery = async (selectClause: string) => {
    let builder = client
      .from("orders")
      .select(selectClause, { count: "exact" });

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

    return builder;
  };

  let { data, error, count } = await runQuery(ORDER_SELECT_WITH_PROTECTION);
  if (error && isMissingColumnError(error)) {
    ({ data, error, count } = await runQuery(ORDER_SELECT));
  }

  if (error) {
    throw new Error(`Không tải được danh sách đơn: ${error.message}`);
  }

  // `select()` nhận selectClause ĐỘNG (fallback 42703), nên supabase-js không
  // suy luận được row type và trả `GenericStringError[]`. Phải đi qua `unknown`.
  const rows = (data as unknown as OrderRow[] | null) ?? [];
  const items = rows.map((row) =>
    withProtectionFields(toAdminOrder(row, []), row),
  );
  return {
    items,
    total: count ?? items.length,
  };
}

async function getById(id: string): Promise<AdminOrder | null> {
  const client = requireAdminClient();
  const readOrder = (selectClause: string) =>
    client.from("orders").select(selectClause).eq("id", id).maybeSingle();

  let { data: order, error: orderError } = await readOrder(
    ORDER_SELECT_WITH_PROTECTION,
  );
  if (orderError && isMissingColumnError(orderError)) {
    ({ data: order, error: orderError } = await readOrder(ORDER_SELECT));
  }

  if (orderError) {
    throw new Error(`Không tải được đơn hàng: ${orderError.message}`);
  }
  if (!order) {
    return null;
  }

  const logs = await fetchStatusLogs(id);
  // Cùng lý do như trong `list()`: selectClause động làm mất row type.
  const orderRow = order as unknown as OrderRow;
  return withProtectionFields(toAdminOrder(orderRow, logs), orderRow);
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
    throw new Error(
      `Không cập nhật được trạng thái đơn: ${updateError.message}`,
    );
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
      throw new Error(
        `Không tra được log trạng thái: ${latestLogError.message}`,
      );
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

  // Best-effort, không ảnh hưởng response — chạy sau khi Staff đã nhận kết
  // quả cập nhật trạng thái đơn thay vì chờ thêm 1 round-trip DB ghi audit log.
  after(async () => {
    await auditLogRepository.record({
      userId: staffUserId,
      action: "UPDATE",
      tableName: "orders",
      recordId: id,
      oldData: { status: current.status },
      newData: {
        status: updatePayload.status,
        payment_status: updatePayload.payment_status,
      },
    });
  });

  const logs = await fetchStatusLogs(id);
  return toAdminOrder(updatedOrder as OrderRow, logs);
}

/** Trạng thái đơn KHÔNG bao giờ được phép chuyển sang PAID. */
const TERMINAL_ORDER_STATUSES = ["CANCELLED", "RETURNED"];

/**
 * Xác nhận đã nhận tiền chuyển khoản (VietQR) — hành động THỦ CÔNG của Staff,
 * là con đường DUY NHẤT đưa đơn BANK_TRANSFER từ UNPAID sang PAID (không có
 * webhook/gateway nào).
 *
 * RFC-3 sửa một lỗi THẬT ở đây. Phiên bản trước chỉ kiểm `payment_method` và
 * `payment_status`, nên một đơn ĐÃ HỦY mà vẫn `payment_status = 'UNPAID'`
 * (đúng trạng thái của mọi đơn chuyển khoản bị hủy) lọt qua toàn bộ guard và
 * bị đánh dấu PAID — hàng đã được hoàn kho rồi lại được ghi nhận là đã thu tiền.
 *
 * Cách sửa: đi qua RPC `checkout_transition_order_state`, nơi guard trạng thái
 * nằm CÙNG transaction với việc đổi `payment_status` và với ledger tài nguyên,
 * kèm `expectedVersion` chống ghi đè khi hai nhân viên thao tác song song.
 * Guard cũng được lặp lại ở tầng TS để trả lỗi rõ ràng mà không cần round-trip.
 */
async function confirmPayment(
  id: string,
  staffUserId: string,
  /**
   * Version nhân viên NHÌN THẤY lúc mở trang. Khi có, nó thắng version đọc
   * ngay trước khi ghi: nếu đơn đã đổi kể từ lúc trang được tải (người khác
   * vừa xác nhận, khách vừa gửi yêu cầu hủy) thì nhân viên nhận 409 và phải
   * tải lại, thay vì xác nhận dựa trên màn hình cũ.
   */
  expectedVersion?: number | null,
): Promise<AdminOrder> {
  const client = requireAdminClient();

  const { data: current, error: currentError } = await client
    .from("orders")
    .select("status, payment_method, payment_status, state_version")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    throw new Error(`Không tra được đơn hàng: ${currentError.message}`);
  }
  if (!current) {
    throw new NotFoundError("Đơn hàng");
  }
  if (current.payment_method !== "BANK_TRANSFER") {
    throw new BadRequestError("Chỉ xác nhận được đơn chuyển khoản ngân hàng.");
  }
  if (current.payment_status === "PAID") {
    throw new BadRequestError("Đơn hàng đã được xác nhận thanh toán.");
  }
  // GUARD MỚI (AC09) — đơn đã hủy/đã trả hàng KHÔNG thể trở thành PAID.
  if (TERMINAL_ORDER_STATUSES.includes(current.status as string)) {
    throw new ConflictError(
      "Không thể xác nhận thanh toán cho đơn đã hủy hoặc đã trả hàng.",
      "ORDER_STATE_CONFLICT",
    );
  }

  const currentVersion =
    (current as { state_version: number | null }).state_version ?? null;

  // Guard tầng TS cho version của client. Guard THẬT vẫn nằm trong RPC dưới
  // lock — cái này chỉ trả lỗi sớm và rõ ràng cho màn hình đã cũ.
  if (
    expectedVersion != null &&
    currentVersion != null &&
    expectedVersion !== currentVersion
  ) {
    throw new ConflictError(
      "Đơn hàng đã thay đổi, vui lòng tải lại trước khi xác nhận.",
      "ORDER_STATE_CONFLICT",
    );
  }

  try {
    await orderRepository.transition({
      orderId: id,
      action: "confirm_payment",
      actorId: staffUserId,
      actorType: "STAFF",
      // Optimistic concurrency: hai nhân viên cùng mở đơn, người thua nhận 409
      // thay vì âm thầm ghi đè kết luận của người kia.
      expectedVersion: expectedVersion ?? currentVersion,
      reason: "Staff xác nhận đã nhận chuyển khoản",
      reference: { source: "staff_confirm_payment", checked_by: staffUserId },
    });
  } catch (error) {
    if (!(error instanceof CheckoutRpcUnavailableError)) {
      throw error;
    }
    // Migration RFC-2 chưa được apply -> RPC không tồn tại. Rơi về UPDATE cũ,
    // NHƯNG có thêm điều kiện status: guard AC09 phải đúng ở CẢ HAI đường,
    // nếu không thì lỗi vẫn sống nguyên trong cửa sổ trước cutover.
    await confirmPaymentLegacyUpdate(id);
  }

  const { data: updatedOrder, error: readError } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    throw new Error(`Không đọc lại được đơn hàng: ${readError.message}`);
  }
  if (!updatedOrder) {
    throw new NotFoundError("Đơn hàng");
  }

  // Best-effort audit trail — dùng lại `audit_logs` sẵn có, không thêm cột mới.
  after(async () => {
    await auditLogRepository.record({
      userId: staffUserId,
      action: "UPDATE",
      tableName: "orders",
      recordId: id,
      oldData: { payment_status: "UNPAID" },
      newData: { payment_status: "PAID" },
    });
  });

  const logs = await fetchStatusLogs(id);
  return toAdminOrder(updatedOrder as OrderRow, logs);
}

/**
 * Đường tương thích khi RPC chưa tồn tại.
 *
 * `.eq("payment_status", "UNPAID")` chống double-confirm (2 nhân viên bấm cùng
 * lúc, chỉ 1 UPDATE khớp row). `.not("status", "in", ...)` là guard AC09 ở
 * mức atomic — không phải chỉ pre-check, vì đơn có thể bị hủy ngay giữa lúc
 * đọc và lúc ghi.
 */
async function confirmPaymentLegacyUpdate(id: string): Promise<void> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("orders")
    .update({ payment_status: "PAID" })
    .eq("id", id)
    .eq("payment_status", "UNPAID")
    .not("status", "in", `(${TERMINAL_ORDER_STATUSES.join(",")})`)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Không cập nhật được trạng thái thanh toán: ${error.message}`,
    );
  }
  if (!data) {
    throw new ConflictError(
      "Đơn hàng đã thay đổi trạng thái, không thể xác nhận thanh toán.",
      "ORDER_STATE_CONFLICT",
    );
  }
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
  confirmPayment,
};
