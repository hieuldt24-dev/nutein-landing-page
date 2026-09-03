import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^(0|\+84)[0-9]{9}$/, "Số điện thoại không hợp lệ");

/**
 * Form schema (client UX) — cả hai trường bắt buộc, dùng cho `zodResolver` của
 * `AccountProfileForm`. Nguồn duy nhất cho quy tắc từng trường.
 */
export const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên phải có ít nhất 2 ký tự")
    .max(100, "Họ tên không được vượt quá 100 ký tự"),
  phone: phoneSchema,
});

/**
 * API schema (partial update contract) — chấp nhận bất kỳ tập con không rỗng
 * của `{fullName, phone}`. Derive từ `profileFormSchema` để không lệch quy tắc.
 */
export const updateProfileSchema = profileFormSchema
  .partial()
  .refine((v) => v.fullName !== undefined || v.phone !== undefined, {
    message: "Cần ít nhất một trường để cập nhật",
  });

export type ProfileFormInput = z.infer<typeof profileFormSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
