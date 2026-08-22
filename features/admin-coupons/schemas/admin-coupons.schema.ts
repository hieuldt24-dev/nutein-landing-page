import { z } from "zod";

const adminCouponBaseSchema = z.object({
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

/**
 * M2 — giảm theo % không thể vượt 100. Chỉ fire khi có ĐỦ cả hai field, nên
 * partial update (chỉ gửi `discount`) không bị chặn oan. `FIXED` không đụng tới
 * (giảm 500.000đ là hợp lệ).
 */
function percentageCapRefine(
  v: { discountType?: "FIXED" | "PERCENTAGE"; discount?: number },
  ctx: z.RefinementCtx,
) {
  if (v.discountType === "PERCENTAGE" && typeof v.discount === "number" && v.discount > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["discount"],
      message: "Giảm theo % không vượt quá 100.",
    });
  }
}

export const adminCouponInputSchema = adminCouponBaseSchema.superRefine(percentageCapRefine);

// `.partial()` chỉ tồn tại trên ZodObject thuần, không có trên ZodEffects mà
// `.superRefine()` sinh ra — vì vậy derive từ base, không phải từ input schema.
export const adminCouponUpdateSchema = adminCouponBaseSchema
  .partial()
  .superRefine(percentageCapRefine);

export type AdminCouponInputPayload = z.infer<typeof adminCouponInputSchema>;
export type AdminCouponUpdatePayload = z.infer<typeof adminCouponUpdateSchema>;
