import "server-only";

import {
  DEFAULT_PRODUCT_VARIANT_ID,
  NUTEIN_PRODUCT_DB_ID,
} from "@/features/product/constants";
import { productService } from "@/features/product/services/product.service";
import { supabaseAdmin } from "@/lib/supabase";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import { normalizeCartLines } from "@/features/cart/pricing";

type DbOrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";
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
  payos_order_code: number | null;
  payos_payment_link_id: string | null;
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
  if (method === "cod") return "COD";
  if (method === "bank_transfer") return "PAYOS";
  return "MOMO";
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
 * Persist đơn theo schema E2E: nhiều `order_items` (mỗi gói 1 dòng).
 * quantity DB = số hũ để trừ kho đúng.
 */
export const orderRepository = {
  async create(
    userId: string,
    input: CreateOrderRequest,
    money: {
      unitPrice: number;
      subtotal: number;
      discountAmount: number;
      shippingFee: number;
      total: number;
    },
    meta: {
      orderCode: string;
      status: DbOrderStatus;
      paymentStatus: "UNPAID" | "PAID";
      payosOrderCode?: number;
      payosPaymentLinkId?: string;
    },
  ): Promise<OrderInsertRow> {
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

    const shippingAddress: OrderShippingAddressSnapshot = {
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
    };

    const client = requireAdminClient();
    const { data: order, error: orderError } = await client
      .from("orders")
      .insert({
        user_id: userId,
        order_code: meta.orderCode,
        status: meta.status,
        payment_method: mapPaymentMethod(input.paymentMethod),
        payment_status: meta.paymentStatus,
        shipping_method: mapShippingMethod(input.shippingMethod),
        total_price: money.subtotal,
        shipping_fee: money.shippingFee,
        discount_amount: money.discountAmount,
        final_price: money.total,
        shipping_address: shippingAddress,
        note: input.note?.trim() || null,
        payos_order_code: meta.payosOrderCode ?? null,
        payos_payment_link_id: meta.payosPaymentLinkId ?? null,
      })
      .select(
        "id, order_code, status, payment_method, payment_status, shipping_method, total_price, shipping_fee, discount_amount, final_price, shipping_address, note, created_at, payos_order_code, payos_payment_link_id",
      )
      .single();

    if (orderError) {
      throw new Error(`Không tạo được đơn hàng: ${orderError.message}`);
    }

    const row = order as OrderInsertRow;
    const jarUnitPrice = productService.getCatalogProduct().price;
    const productName = productService.getCatalogProduct().name;

    const orderItems = lines.map((line) => {
      const variant = productService.resolveVariant(detail, line.variantId);
      return {
        order_id: row.id,
        product_id: NUTEIN_PRODUCT_DB_ID,
        product_name: productName,
        variant_info: variant.label,
        price: jarUnitPrice,
        quantity: line.quantity * variant.units,
      };
    });

    const { error: itemError } = await client.from("order_items").insert(orderItems);

    if (itemError) {
      await client.from("orders").delete().eq("id", row.id);
      throw new Error(`Không lưu được dòng đơn: ${itemError.message}`);
    }

    return row;
  },

  /**
   * Trang /checkout/success (đối soát) và retryPayment (thanh toán lại) gọi
   * — tra đơn theo order_code + user.
   */
  async findByOrderCodeForUser(
    orderCode: string,
    userId: string,
  ): Promise<Pick<
    OrderInsertRow,
    | "id"
    | "payment_status"
    | "payment_method"
    | "payos_order_code"
    | "payos_payment_link_id"
    | "final_price"
    | "shipping_address"
  > | null> {
    const client = requireAdminClient();
    const { data, error } = await client
      .from("orders")
      .select(
        "id, payment_status, payment_method, payos_order_code, payos_payment_link_id, final_price, shipping_address",
      )
      .eq("order_code", orderCode)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Không tra được đơn hàng: ${error.message}`);
    }
    return data ?? null;
  },

  /**
   * Compare-and-swap: chỉ update khi `payos_order_code` hiện tại còn khớp
   * `previousPayosOrderCode` đã đọc lúc đầu. Chặn race 2 request retry song
   * song ghi đè lẫn nhau (webhook sẽ tra nhầm theo code "thua" nếu không có
   * điều kiện này). Trả `false` nếu 0 dòng khớp — bên gọi tự huỷ link vừa
   * tạo và báo lỗi cho client thử lại.
   */
  async updatePayosLink(
    orderId: string,
    previousPayosOrderCode: number | null,
    nextPayosOrderCode: number,
    nextPayosPaymentLinkId: string,
  ): Promise<boolean> {
    const client = requireAdminClient();
    let query = client
      .from("orders")
      .update({
        payos_order_code: nextPayosOrderCode,
        payos_payment_link_id: nextPayosPaymentLinkId,
      })
      .eq("id", orderId);

    query =
      previousPayosOrderCode === null
        ? query.is("payos_order_code", null)
        : query.eq("payos_order_code", previousPayosOrderCode);

    const { data, error } = await query.select("id");

    if (error) {
      throw new Error(`Không cập nhật được link thanh toán: ${error.message}`);
    }
    return Array.isArray(data) && data.length > 0;
  },

  /**
   * Update idempotent trong 1 round-trip: webhook payOS có thể gọi lại
   * nhiều lần cùng đơn — `neq payment_status 'PAID'` đảm bảo chỉ update lần
   * đầu, các lần sau là no-op an toàn (không lỗi, không side-effect kép).
   */
  async markPaidByPayosOrderCode(
    payosOrderCode: number,
  ): Promise<{ orderId: string } | null> {
    const client = requireAdminClient();
    const { data, error } = await client
      .from("orders")
      .update({ payment_status: "PAID" })
      .eq("payos_order_code", payosOrderCode)
      .neq("payment_status", "PAID")
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Không cập nhật được trạng thái thanh toán: ${error.message}`);
    }
    return data ? { orderId: data.id } : null;
  },
};

export type { OrderInsertRow, DbOrderStatus };
