import { z } from "zod";

export const adminCouponInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã coupon bắt buộc.")
    .transform((v) => v.toUpperCase()),
  discountType: z.enum(["FIXED", "PERCENTAGE"]),
  discount: z.number().min(0, "Giá trị giảm không hợp lệ."),
  minOrderValue: z.number().min(0).nullable(),
  usageLimit: z.number().int().min(1).nullable(),
  usedCount: z.number().int().min(0).optional(),
  isActive: z.boolean(),
  expiresAt: z.string().trim().min(1).nullable(),
});

export const adminCouponUpdateSchema = adminCouponInputSchema.partial();

export type AdminCouponInputPayload = z.infer<typeof adminCouponInputSchema>;
export type AdminCouponUpdatePayload = z.infer<typeof adminCouponUpdateSchema>;
