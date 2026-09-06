import "server-only";

import { after } from "next/server";
import {
  DEFAULT_PRODUCT_VARIANT_ID,
  NUTEIN_PRODUCT_DB_ID,
} from "@/features/product/constants";
import { productService } from "@/features/product/services/product.service";
import { supabaseAdmin } from "@/lib/supabase";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import { normalizeCartLines } from "@/features/cart/pricing";
import { BadRequestError, ConflictError } from "@/src/errors/app.error";
import { auditLogRepository } from "@/features/admin-audit/services/audit-log.repository";
import { CHECKOUT_DB_ERROR_MAP, COUPON_TRIGGER_MESSAGES } from "../constants";
import type { PaymentReviewState } from "../types";

type DbOrderStatus =
  "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
/**
 * `PAYOS` giữ lại trong union chỉ để ĐỌC đơn lịch sử (enum DB vẫn còn giá trị
 * này) — không code path nào được GHI `PAYOS` nữa kể từ khi bỏ payOS.
 */
type DbPaymentMethod = "COD" | "BANK_TRANSFER" | "MOMO" | "VNPAY" | "PAYOS";
type DbShippingMethod = "STANDARD" | "EXPRESS";

export interface OrderShippingAddressSnapshot {
  fullName: string;
  phone: string;
  email: string;
  provinceCode: string;
  province: string;
  wardCode: string;
  ward: string;
  street: string;
  /** Legacy — dòng đầu (tương thích account list cũ). */
  variantId: string;
  variantLabel: string;
  /** Snapshot multi-line. */
  lines: { variantId: string; variantLabel: string; packQuantity: number }[];
  /**
   * Snapshot coupon lúc đặt hàng. `orders` chỉ có 1 cột `discount_amount` (đã
   * gộp cả giảm theo mốc voucher lẫn coupon) và 1 FK `coupon_id`, không có chỗ
   * lưu RIÊNG phần giảm của coupon — nên phần tách dòng cho lịch sử đơn nằm ở
   * đây, trong cột JSONB snapshot sẵn có (giống `variantId`/`lines`), không cần
   * migration mới.
   */
  couponCode?: string;
  couponDiscountAmount?: number;
  /**
   * Các con số CHỈ ĐỂ HIỂN THỊ mà `orders` không có cột riêng
   * (`quantity`/`unitPrice`/`discountPercent`).
   *
   * Lưu ở đây để một REPLAY dựng lại được response Y HỆT lần đầu từ dữ liệu
   * BẤT BIẾN. Nếu tính lại từ catalog hiện tại, khách bấm F5 sau khi staff đổi
   * giá sẽ thấy số khác với đơn đã đặt. Đơn legacy không có field này —
   * consumer phải chịu được `undefined`.
   */
  displaySummary?: {
    quantity: number;
    unitPrice: number;
    discountPercent: number;
  };
}

interface OrderInsertRow {
  id: string;
  order_code: string;
  status: DbOrderStatus;
  payment_method: DbPaymentMethod;
  payment_status: "UNPAID" | "PAID";
  shipping_method: DbShippingMethod;
  total_price: number;
  shipping_fee: number;
  discount_amount: number;
  final_price: number;
  shipping_address: OrderShippingAddressSnapshot;
  note: string | null;
  created_at: string;
}

/** Kết quả RPC `checkout_create_order_atomic`. */
export interface AtomicCreateResult {
  /** `true` = replay của một key đã dùng; KHÔNG có đơn mới nào được tạo. */
  replayed: boolean;
  orderId: string;
  orderCode: string;
  status: DbOrderStatus;
  paymentStatus: "UNPAID" | "PAID";
  reviewState: PaymentReviewState | null;
  paymentExpiresAt: string | null;
  stateVersion: number;
  createdAt: string;
}

/** Snapshot đơn dùng để dựng lại response cho một replay. */
export interface OrderReplaySnapshot {
  orderId: string;
  orderCode: string;
  status: DbOrderStatus;
  paymentMethod: DbPaymentMethod;
  paymentStatus: "UNPAID" | "PAID";
  shippingMethod: DbShippingMethod;
  totalPrice: number;
  shippingFee: number;
  discountAmount: number;
  finalPrice: number;
  shippingAddress: OrderShippingAddressSnapshot;
  note: string | null;
  reviewState: PaymentReviewState | null;
  paymentExpiresAt: string | null;
  stateVersion: number;
  createdAt: string;
  requestHash: string;
  hashVersion: number;
}

interface PostgrestErrorLike {
  code?: string;
  message: string;
}

/**
 * Dịch lỗi Postgres của RPC sang AppError.
 *
 * `error.code` là SQLSTATE — với các mã tuỳ biến (NTCAP/NTIDM/...) supabase-js
 * chuyển nguyên vẹn. Message tiếng Việt do RPC raise được GIỮ NGUYÊN để hiển thị
 * cho khách; không bọc thêm tiền tố kỹ thuật, không lộ SQL.
 */
/**
 * RPC chưa tồn tại trên database đang chạy (migration RFC-2 chưa apply).
 *
 * Tách thành class riêng để caller PHÂN BIỆT được "RPC từ chối thao tác" với
 * "RPC không có ở đây" — hai tình huống cần xử lý ngược nhau: cái đầu phải báo
 * lỗi cho staff, cái sau phải rơi về đường cũ để back-office không chết trong
 * cửa sổ trước cutover.
 */
export class CheckoutRpcUnavailableError extends Error {
  constructor(fnName: string) {
    super(`RPC ${fnName} chưa có trên database hiện tại`);
    this.name = "CheckoutRpcUnavailableError";
  }
}

/** PGRST202 = PostgREST không thấy function; 42883 = Postgres undefined_function. */
function isRpcMissing(error: PostgrestErrorLike): boolean {
  return error.code === "PGRST202" || error.code === "42883";
}

function translateRpcError(error: PostgrestErrorLike): Error {
  const mapped = error.code ? CHECKOUT_DB_ERROR_MAP[error.code] : undefined;
  if (mapped) {
    const message =
      error.message.replace(/^.*\bERROR:\s*/i, "").trim() ||
      "Không tạo được đơn hàng";
    return mapped.statusCode === 409
      ? new ConflictError(message, mapped.code)
      : new BadRequestError(message);
  }

  // 23505 trên unique(user_id, idempotency_key): hai request cùng key chạy song
  // song, request kia commit trước. Đây KHÔNG phải lỗi hệ thống — client nên
  // retry và sẽ nhận replay.
  if (error.code === "23505" && error.message.includes("checkout_requests")) {
    return new ConflictError(
      "Yêu cầu đặt hàng này đang được xử lý — vui lòng thử lại sau giây lát.",
      "IDEMPOTENCY_CONFLICT",
    );
  }

  // Fallback tương thích: nếu migration RFC-2 CHƯA được apply, trigger coupon cũ
  // vẫn còn sống và raise text tiếng Việt không kèm SQLSTATE riêng.
  const triggerMessage = COUPON_TRIGGER_MESSAGES.find((message) =>
    error.message.includes(message),
  );
  if (triggerMessage) {
    return new BadRequestError(triggerMessage);
  }

  return new Error(`Không tạo được đơn hàng: ${error.message}`);
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function mapPaymentMethod(
  method: CreateOrderRequest["paymentMethod"],
): DbPaymentMethod {
  return method === "cod" ? "COD" : "BANK_TRANSFER";
}

function mapShippingMethod(
  method: CreateOrderRequest["shippingMethod"],
): DbShippingMethod {
  return method === "express" ? "EXPRESS" : "STANDARD";
}

export function buildOrderCode(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NT-${y}${m}${d}-${suffix}`;
}

/**
 * Dựng snapshot địa chỉ/dòng hàng ghi vào `orders.shipping_address` (JSONB).
 * Tách riêng để `createAtomic` và test dùng chung một nguồn sự thật.
 */
function buildShippingAddressSnapshot(
  input: CreateOrderRequest,
  coupon?: {
    couponCode?: string;
    couponDiscountAmount?: number;
  },
  displaySummary?: {
    quantity: number;
    unitPrice: number;
    discountPercent: number;
  },
): {
  snapshot: OrderShippingAddressSnapshot;
  lines: { variantId: string; quantity: number }[];
} {
  const lines = normalizeCartLines(input.lines);
  const detail = productService.getProductDetail();
  const first = lines[0];
  const firstVariant = productService.resolveVariant(
    detail,
    first?.variantId ?? DEFAULT_PRODUCT_VARIANT_ID,
  );

  const lineSnapshots = lines.map((line) => {
    const variant = productService.resolveVariant(detail, line.variantId);
    return {
      variantId: line.variantId,
      variantLabel: variant.label,
      packQuantity: line.quantity,
    };
  });

  return {
    lines,
    snapshot: {
      fullName: input.buyer.fullName.trim(),
      phone: input.buyer.phone.trim(),
      email: input.buyer.email.trim().toLowerCase(),
      provinceCode: input.address.provinceCode.trim(),
      province: input.address.province.trim(),
      wardCode: input.address.wardCode.trim(),
      ward: input.address.ward.trim(),
      street: input.address.street.trim(),
      variantId: first?.variantId ?? DEFAULT_PRODUCT_VARIANT_ID,
      variantLabel: firstVariant.label,
      lines: lineSnapshots,
      ...(coupon?.couponCode ? { couponCode: coupon.couponCode } : {}),
      ...(coupon?.couponDiscountAmount !== undefined
        ? { couponDiscountAmount: coupon.couponDiscountAmount }
        : {}),
      ...(displaySummary ? { displaySummary } : {}),
    },
  };
}

/**
 * Persist đơn theo schema E2E: nhiều `order_items` (mỗi gói 1 dòng).
 * quantity DB = số hũ để trừ kho đúng.
 */
export const orderRepository = {
  /**
   * Tạo đơn ATOMIC qua RPC `checkout_create_order_atomic` (migration
   * 20260906000000).
   *
   * Thay thế hoàn toàn đường hai-write cũ (INSERT orders -> INSERT order_items,
   * lỗi thì `orders.delete()` bù trừ). Đường cũ RÒ RỈ lượt coupon: trigger
   * BEFORE INSERT tăng `coupons.used_count`, còn compensating delete KHÔNG giảm
   * lại và không có decrement path nào trong schema — mỗi lần create hỏng giữa
   * chừng mất vĩnh viễn một lượt. Bản sửa là XOÁ HẲN đường đó, không vá thêm
   * decrement: một transaction DB duy nhất giữ order + items + stock + coupon +
   * ledger + idempotency key, lỗi ở bất kỳ đâu rollback toàn bộ.
   */
  async createAtomic(params: {
    userId: string;
    input: CreateOrderRequest;
    money: {
      unitPrice: number;
      subtotal: number;
      discountAmount: number;
      shippingFee: number;
      total: number;
    };
    meta: {
      orderCode: string;
      status: DbOrderStatus;
      paymentStatus: "UNPAID" | "PAID";
    };
    idempotency: { key: string; requestHash: string; hashVersion: number };
    policy: {
      protectionVersion: number;
      bankActiveCap: number;
      codActiveCap: number | null;
      dailyQuota: number | null;
      paymentTtlSeconds: number | null;
    };
    coupon?: {
      couponId?: string;
      couponCode?: string;
      couponDiscountAmount?: number;
    };
    displaySummary?: {
      quantity: number;
      unitPrice: number;
      discountPercent: number;
    };
  }): Promise<AtomicCreateResult> {
    const { userId, input, money, meta, idempotency, policy, coupon } = params;
    const { snapshot, lines } = buildShippingAddressSnapshot(
      input,
      coupon,
      params.displaySummary,
    );
    const detail = productService.getProductDetail();
    const jarUnitPrice = productService.getCatalogProduct().price;
    const productName = productService.getCatalogProduct().name;

    const items = lines.map((line) => {
      const variant = productService.resolveVariant(detail, line.variantId);
      return {
        product_id: NUTEIN_PRODUCT_DB_ID,
        product_name: productName,
        variant_info: variant.label,
        price: jarUnitPrice,
        quantity: line.quantity * variant.units,
      };
    });

    const client = requireAdminClient();
    const { data, error } = await client.rpc("checkout_create_order_atomic", {
      p_payload: {
        user_id: userId,
        idempotency_key: idempotency.key,
        request_hash: idempotency.requestHash,
        hash_version: idempotency.hashVersion,

        order_code: meta.orderCode,
        status: meta.status,
        payment_status: meta.paymentStatus,
        payment_method: mapPaymentMethod(input.paymentMethod),
        shipping_method: mapShippingMethod(input.shippingMethod),

        total_price: money.subtotal,
        shipping_fee: money.shippingFee,
        discount_amount: money.discountAmount,
        final_price: money.total,

        shipping_address: snapshot,
        note: input.note?.trim() || null,

        // RPC tự tra coupon theo CODE và tự khoá row — KHÔNG gửi coupon_id lên
        // để DB không phải tin một id do tầng trên chọn.
        coupon_code: coupon?.couponCode ?? null,
        coupon_discount_amount: coupon?.couponDiscountAmount ?? 0,

        protection_version: policy.protectionVersion,
        bank_active_cap: policy.bankActiveCap,
        cod_active_cap: policy.codActiveCap,
        daily_quota: policy.dailyQuota,
        payment_ttl_seconds: policy.paymentTtlSeconds,

        items,
      },
    });

    if (error) {
      throw translateRpcError(error as PostgrestErrorLike);
    }

    const row = data as {
      replayed: boolean;
      order_id: string;
      order_code: string;
      status: DbOrderStatus;
      payment_status: "UNPAID" | "PAID";
      payment_review_state: PaymentReviewState | null;
      payment_expires_at: string | null;
      state_version: number;
      created_at: string;
    };

    const result: AtomicCreateResult = {
      replayed: row.replayed,
      orderId: row.order_id,
      orderCode: row.order_code,
      status: row.status,
      paymentStatus: row.payment_status,
      reviewState: row.payment_review_state ?? null,
      paymentExpiresAt: row.payment_expires_at ?? null,
      stateVersion: row.state_version ?? 0,
      createdAt: row.created_at,
    };

    // Audit CHỈ cho đơn mới. Replay không được ghi log lần hai — nếu không, một
    // khách bấm F5 mười lần sẽ tạo mười dòng audit "CREATE" cho cùng một đơn.
    if (!result.replayed) {
      after(async () => {
        await auditLogRepository.record({
          userId,
          action: "CREATE",
          tableName: "orders",
          recordId: result.orderId,
          newData: {
            order_code: result.orderCode,
            status: result.status,
            payment_method: mapPaymentMethod(input.paymentMethod),
            final_price: money.total,
          },
        });
      });
    }

    return result;
  },

  /**
   * Tra idempotency key TRƯỚC khi tính giá.
   *
   * Trả `null` khi key chưa dùng. Trả snapshot đơn cũ khi đã dùng — kể cả đơn đã
   * huỷ/hết hạn: replay luôn trỏ về ĐÚNG đơn cũ, không bao giờ tạo đơn thay thế.
   * So khớp hash là việc của tầng service (409 khi lệch).
   */
  async findReplay(
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderReplaySnapshot | null> {
    const client = requireAdminClient();
    const { data, error } = await client
      .from("checkout_requests")
      .select(
        "request_hash, hash_version, orders!inner(id, order_code, status, payment_method, payment_status, shipping_method, total_price, shipping_fee, discount_amount, final_price, shipping_address, note, payment_review_state, payment_expires_at, state_version, created_at)",
      )
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) {
      // 42P01 = bảng chưa tồn tại (migration RFC-2 chưa apply). KHÔNG ném lỗi:
      // trong cửa sổ tương thích, thiếu bảng nghĩa là chưa có replay protection,
      // không phải checkout hỏng.
      if ((error as PostgrestErrorLike).code === "42P01") {
        return null;
      }
      throw new Error(`Không đọc được idempotency key: ${error.message}`);
    }
    if (!data) return null;

    const record = data as unknown as {
      request_hash: string;
      hash_version: number;
      orders: {
        id: string;
        order_code: string;
        status: DbOrderStatus;
        payment_method: DbPaymentMethod;
        payment_status: "UNPAID" | "PAID";
        shipping_method: DbShippingMethod;
        total_price: number;
        shipping_fee: number;
        discount_amount: number;
        final_price: number;
        shipping_address: OrderShippingAddressSnapshot;
        note: string | null;
        payment_review_state: PaymentReviewState | null;
        payment_expires_at: string | null;
        state_version: number | null;
        created_at: string;
      };
    };
    const order = record.orders;

    return {
      orderId: order.id,
      orderCode: order.order_code,
      status: order.status,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      shippingMethod: order.shipping_method,
      totalPrice: Number(order.total_price),
      shippingFee: Number(order.shipping_fee),
      discountAmount: Number(order.discount_amount),
      finalPrice: Number(order.final_price),
      shippingAddress: order.shipping_address,
      note: order.note,
      reviewState: order.payment_review_state ?? null,
      paymentExpiresAt: order.payment_expires_at ?? null,
      stateVersion: order.state_version ?? 0,
      createdAt: order.created_at,
      requestHash: record.request_hash,
      hashVersion: record.hash_version,
    };
  },

  /**
   * Chuyển trạng thái thanh toán qua RPC `checkout_transition_order_state`.
   * Cùng thứ tự khoá với create (user -> order -> ledger -> products), nên
   * confirm/claim/cancel/worker không deadlock lẫn nhau và không có đường nào
   * hoàn kho hai lần.
   *
   * RFC-2 chỉ cung cấp wrapper; việc thay các UPDATE trực tiếp ở
   * `features/admin-orders` bằng wrapper này thuộc RFC-3.
   */
  async transition(params: {
    orderId: string;
    action:
      | "confirm_payment"
      | "claim_payment"
      | "mark_review_required"
      | "request_cancel"
      | "resolve_no_transfer"
      | "mark_late_transfer";
    actorId?: string | null;
    actorType?: "CUSTOMER" | "STAFF" | "SYSTEM";
    expectedVersion?: number | null;
    reason?: string | null;
    reference?: Record<string, unknown>;
  }): Promise<{
    orderId: string;
    changed: boolean;
    status: DbOrderStatus;
    paymentStatus: "UNPAID" | "PAID";
    reviewState: PaymentReviewState | null;
    stateVersion: number;
  }> {
    const client = requireAdminClient();
    const { data, error } = await client.rpc(
      "checkout_transition_order_state",
      {
        p_payload: {
          order_id: params.orderId,
          action: params.action,
          actor_id: params.actorId ?? null,
          actor_type: params.actorType ?? "SYSTEM",
          expected_version: params.expectedVersion ?? null,
          reason: params.reason ?? null,
          reference: params.reference ?? {},
        },
      },
    );

    if (error) {
      if (isRpcMissing(error as PostgrestErrorLike)) {
        throw new CheckoutRpcUnavailableError(
          "checkout_transition_order_state",
        );
      }
      throw translateRpcError(error as PostgrestErrorLike);
    }

    const row = data as {
      order_id: string;
      changed: boolean;
      status: DbOrderStatus;
      payment_status: "UNPAID" | "PAID";
      payment_review_state?: PaymentReviewState | null;
      state_version: number;
    };

    return {
      orderId: row.order_id,
      changed: row.changed,
      status: row.status,
      paymentStatus: row.payment_status,
      reviewState: row.payment_review_state ?? null,
      stateVersion: row.state_version,
    };
  },

  /**
   * Tồn kho thật (đơn vị hũ) của sản phẩm chủ lực — single-SKU nên chỉ 1
   * dòng `products`. checkoutService gọi trước khi tạo đơn để chặn đặt
   * hàng vượt tồn kho.
   */
  async getAvailableStock(): Promise<number> {
    const client = requireAdminClient();
    const { data, error } = await client
      .from("products")
      .select("stock")
      .eq("id", NUTEIN_PRODUCT_DB_ID)
      .single();

    if (error) {
      throw new Error(`Không đọc được tồn kho: ${error.message}`);
    }
    return data.stock as number;
  },
};

export type { OrderInsertRow, DbOrderStatus };
