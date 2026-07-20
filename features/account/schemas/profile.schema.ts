import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^(0|\+84)[0-9]{9}$/, "Số điện thoại không hợp lệ");

/** PATCH profile — client RHF + contract API tương lai. */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên phải có ít nhất 2 ký tự")
    .max(100, "Họ tên không được vượt quá 100 ký tự"),
  phone: phoneSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
