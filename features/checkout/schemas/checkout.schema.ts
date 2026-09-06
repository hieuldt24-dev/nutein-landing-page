import { z } from "zod";
import {
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
} from "@/features/cart/constants";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^(0|\+84)[0-9]{9}$/, "Số điện thoại không hợp lệ");

const orderLineSchema = z.object({
  variantId: z.string().trim().min(1),
  quantity: z
    .number()
    .int("Số lượng phải là số nguyên")
    .min(MIN_CART_QUANTITY + 1, "Số lượng không hợp lệ")
    .max(MAX_CART_QUANTITY, `Số lượng tối đa là ${MAX_CART_QUANTITY}`),
});

/**
 * Request tạo đơn — dùng client (RHF) + server (API route).
 * `lines` = các gói trong giỏ; server tính tiền theo giá gói và quy đổi hũ khi ghi DB.
 */
export const createOrderRequestSchema = z.object({
  lines: z
    .array(orderLineSchema)
    .min(1, "Giỏ hàng trống")
    .max(10, "Quá nhiều dòng trong giỏ"),

  buyer: z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Họ tên phải có ít nhất 2 ký tự")
      .max(100, "Họ tên không được vượt quá 100 ký tự"),
    phone: phoneSchema,
    email: z.string().trim().email("Email không hợp lệ"),
  }),

  address: z.object({
    provinceCode: z.string().trim().min(1, "Vui lòng chọn tỉnh/thành"),
    province: z.string().trim().min(2, "Vui lòng chọn tỉnh/thành"),
    wardCode: z.string().trim().min(1, "Vui lòng chọn phường/xã"),
    ward: z.string().trim().min(2, "Vui lòng chọn phường/xã"),
    street: z.string().trim().min(3, "Vui lòng nhập số nhà, đường"),
  }),

  note: z
    .string()
    .trim()
    .max(500, "Ghi chú không được vượt quá 500 ký tự")
    .optional(),

  shippingMethod: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["cod", "bank_transfer"]),

  /**
   * Mã giảm giá khách nhập — 1 chuỗi optional, KHÔNG phải mảng: shape này khoá
   * "mỗi đơn tối đa 1 coupon" ngay ở tầng schema. Server luôn tự tra + tự tính
   * lại số tiền giảm từ DB; client không bao giờ gửi số tiền giảm lên.
   */
  couponCode: z.string().trim().min(1).max(50).optional(),

  /** Chỉ UI — không bắt buộc gửi; server bỏ qua. */
  saveInfo: z.boolean().optional(),
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

/**
 * Giá trị header `Idempotency-Key` — UUID do BROWSER sinh khi bắt đầu một lần
 * submit, giữ nguyên qua mọi retry mạng / refresh token / reload.
 *
 * KHÔNG nằm trong `createOrderRequestSchema`: đây là header, không phải business
 * payload, và nó bị LOẠI khỏi canonical hash một cách có chủ đích — key là thứ
 * ĐỊNH DANH request, không phải một phần nội dung request.
 *
 * RFC-2 chỉ định nghĩa kiểu; việc bắt buộc header ở route thuộc RFC-3 và phải
 * theo cửa sổ tương thích (client ship trước, server warn+log, enforce sau).
 */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .uuid("Idempotency-Key phải là UUID");

export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;

/**
 * Form checkout = request trừ `lines` (lấy từ cart store) và `couponCode`
 * (state riêng của CheckoutCouponField, không do RHF quản lý).
 */
export const checkoutFormSchema = createOrderRequestSchema.omit({
  lines: true,
  couponCode: true,
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
