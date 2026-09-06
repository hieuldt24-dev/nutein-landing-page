import "server-only";

import type {
  AccountOrder,
  AccountOrderAction,
  AccountOrderDetail,
  AccountOrderStatus,
} from "../types";
import { supabaseAdmin } from "@/lib/supabase";
import { buildVietQrImageUrl } from "@/lib/vietqr";
import { NotFoundError } from "@/src/errors/app.error";

type DbOrderStatus =
  "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";

interface OrderListRow {
  id: string;
  order_code: string;
  status: DbOrderStatus;
  shipping_method: "STANDARD" | "EXPRESS";
  final_price: number | string;
  created_at: string;
  /**
   * Bất đối xứng có chủ đích: `PAYOS` chỉ còn ở đường ĐỌC này để đơn lịch sử
   * (đặt trước khi bỏ payOS) không làm vỡ mapper. Đường GHI trong
   * `features/checkout/services/order.repository.ts` không bao giờ ghi `PAYOS` nữa.
   */
  payment_method: "COD" | "BANK_TRANSFER" | "MOMO" | "VNPAY" | "PAYOS";
  payment_status: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
  shipping_address: {
    variantLabel?: string;
    couponCode?: string;
    couponDiscountAmount?: number;
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
  /** Đơn giản hoá về UNPAID/PAID — khớp cách checkoutService.getPaymentStatusForUser đã làm. */
  const paymentStatus: "UNPAID" | "PAID" =
    row.payment_status === "PAID" ? "PAID" : "UNPAID";

  return {
    id: row.id,
    orderCode: row.order_code,
    status,
    createdAt: row.created_at,
    quantity: jarTotal,
    variantLabel,
    total: Number(row.final_price),
    estimatedDeliveryLabel: estimatedDeliveryLabel(row.shipping_method, status),
    paymentStatus,
    // Snapshot lúc đặt hàng — `shipping_address` JSONB đã nằm sẵn trong SELECT,
    // không cần thêm cột nào.
    ...(row.shipping_address?.couponCode
      ? { couponCode: row.shipping_address.couponCode }
      : {}),
    ...(typeof row.shipping_address?.couponDiscountAmount === "number"
      ? { couponDiscountAmount: row.shipping_address.couponDiscountAmount }
      : {}),
  };
}

interface OrderDetailRow extends OrderListRow {
  payment_review_state: string | null;
  payment_expires_at: string | null;
  state_version: number | null;
}

/**
 * Đơn còn thanh toán được hay không — cùng định nghĩa với
 * `features/checkout/services/checkout.service.ts` (`canStillPay`): chuyển
 * khoản, chưa trả, chưa huỷ/trả hàng, chưa quá hạn. Quá hạn thì ẨN QR nhưng
 * KHÔNG tự huỷ đơn (plan §Vòng đời chuyển khoản).
 */
function canStillPay(row: OrderDetailRow): boolean {
  if (row.payment_method !== "BANK_TRANSFER") return false;
  if (row.payment_status === "PAID") return false;
  if (row.status === "CANCELLED" || row.status === "RETURNED") return false;
  if (
    row.payment_expires_at &&
    new Date(row.payment_expires_at) <= new Date()
  ) {
    return false;
  }
  return true;
}

/**
 * Hành động khách được phép. Đây là gợi ý cho UI — nguồn sự thật vẫn là RPC
 * `checkout_transition_order_state`, nó tự guard lại dưới lock. Client không
 * bao giờ được tin danh sách này thay cho kiểm tra server.
 */
function resolveAllowedActions(row: OrderDetailRow): AccountOrderAction[] {
  const actions: AccountOrderAction[] = [];
  const unpaidAndOpen =
    row.payment_status !== "PAID" &&
    row.status !== "CANCELLED" &&
    row.status !== "RETURNED";

  if (
    row.payment_method === "BANK_TRANSFER" &&
    unpaidAndOpen &&
    row.payment_review_state !== "PAYMENT_CLAIMED"
  ) {
    actions.push("claim_payment");
  }
  if (unpaidAndOpen && row.payment_review_state !== "CANCEL_REQUESTED") {
    actions.push("request_cancel");
  }
  return actions;
}

function toAccountOrderDetail(row: OrderDetailRow): AccountOrderDetail {
  const base = toAccountOrder(row);
  const qrImageUrl = canStillPay(row)
    ? buildVietQrImageUrl({
        amount: Number(row.final_price),
        addInfo: row.order_code,
      })
    : null;

  return {
    ...base,
    paymentMethod: row.payment_method,
    paymentExpiresAt: row.payment_expires_at ?? null,
    reviewState: row.payment_review_state ?? null,
    stateVersion: row.state_version ?? 0,
    ...(qrImageUrl ? { qrImageUrl } : {}),
    allowedActions: resolveAllowedActions(row),
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
        payment_method,
        payment_status,
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

  /**
   * Chi tiết một đơn CỦA CHÍNH user.
   *
   * Lọc `id AND user_id` trong CÙNG một query rồi ném 404 khi không khớp
   * (plan §Security — "IDOR/order enumeration"). KHÔNG đọc đơn trước rồi so
   * chủ sở hữu sau: cách đó phân biệt được "đơn không tồn tại" với "đơn của
   * người khác", biến endpoint thành oracle liệt kê đơn. 404 chứ không 403.
   */
  async getOwnedOrderDetail(
    userId: string,
    orderId: string,
  ): Promise<AccountOrderDetail> {
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
        payment_method,
        payment_status,
        payment_review_state,
        payment_expires_at,
        state_version,
        shipping_address,
        order_items ( quantity, variant_info )
      `,
      )
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // 42703 = cột chưa tồn tại (migration RFC-2 chưa apply). Không làm hỏng
      // trang chi tiết trong cửa sổ trước cutover: đọc lại bản tối thiểu.
      if ((error as { code?: string }).code === "42703") {
        return this.getOwnedOrderDetailLegacy(userId, orderId);
      }
      throw new Error(`Không tải được đơn hàng: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundError("Đơn hàng");
    }

    return toAccountOrderDetail(data as OrderDetailRow);
  },

  /** Fallback khi các cột RFC-2 chưa tồn tại trên database đang chạy. */
  async getOwnedOrderDetailLegacy(
    userId: string,
    orderId: string,
  ): Promise<AccountOrderDetail> {
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
        payment_method,
        payment_status,
        shipping_address,
        order_items ( quantity, variant_info )
      `,
      )
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Không tải được đơn hàng: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundError("Đơn hàng");
    }

    return toAccountOrderDetail({
      ...(data as OrderListRow),
      payment_review_state: null,
      payment_expires_at: null,
      state_version: null,
    });
  },
};
