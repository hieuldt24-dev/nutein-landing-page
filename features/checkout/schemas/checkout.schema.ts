import { z } from "zod";
import { MAX_CART_QUANTITY, MIN_CART_QUANTITY } from "@/features/cart/constants";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^(0|\+84)[0-9]{9}$/, "Số điện thoại không hợp lệ");

/**
 * Request tạo đơn — dùng client (RHF) + server (API route).
 * Địa chỉ 2 cấp (Tỉnh → Phường/Xã) theo NQ 202/2025 — không còn quận/huyện.
 * Server tính lại tiền từ `quantity`; không tin total client.
 */
export const createOrderRequestSchema = z.object({
  quantity: z
    .number()
    .int("Số lượng phải là số nguyên")
    .min(MIN_CART_QUANTITY + 1, "Giỏ hàng trống")
    .max(MAX_CART_QUANTITY, `Số lượng tối đa là ${MAX_CART_QUANTITY}`),

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

  note: z.string().trim().max(500, "Ghi chú không được vượt quá 500 ký tự").optional(),

  shippingMethod: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["cod", "bank_transfer", "ewallet"]),

  /** Chỉ UI — không bắt buộc gửi; server bỏ qua. */
  saveInfo: z.boolean().optional(),
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

/** Form checkout = request trừ quantity (quantity lấy từ cart store). */
export const checkoutFormSchema = createOrderRequestSchema.omit({ quantity: true });

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
