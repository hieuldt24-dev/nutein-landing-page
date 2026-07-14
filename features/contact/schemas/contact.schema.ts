import { z } from "zod";

/**
 * Schema validate dữ liệu form liên hệ gửi từ client.
 * Được dùng cả ở client (real-time validation) và server (bảo vệ API).
 */
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, "Họ tên phải có ít nhất 2 ký tự")
    .max(100, "Họ tên không được vượt quá 100 ký tự"),

  email: z
    .string()
    .email("Email không hợp lệ"),

  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9}$/, "Số điện thoại không hợp lệ")
    .optional(),

  message: z
    .string()
    .min(10, "Nội dung phải có ít nhất 10 ký tự")
    .max(1000, "Nội dung không được vượt quá 1000 ký tự"),

  subject: z
    .string()
    .min(1, "Vui lòng chọn chủ đề")
    .optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
