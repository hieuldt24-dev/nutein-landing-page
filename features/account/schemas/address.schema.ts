import { z } from "zod";

/** Chỉ địa điểm giao — họ tên/SĐT nằm ở hồ sơ cá nhân. */
export const shippingAddressFieldsSchema = z.object({
  label: z.string().trim().max(40, "Nhãn quá dài").optional(),
  provinceCode: z.string().trim().min(1, "Vui lòng chọn tỉnh/thành"),
  province: z.string().trim().min(2, "Vui lòng chọn tỉnh/thành"),
  wardCode: z.string().trim().min(1, "Vui lòng chọn phường/xã"),
  ward: z.string().trim().min(2, "Vui lòng chọn phường/xã"),
  street: z.string().trim().min(3, "Vui lòng nhập số nhà, đường"),
  isDefault: z.boolean().optional(),
});

export const upsertAddressSchema = shippingAddressFieldsSchema.extend({
  id: z.string().trim().min(1).optional(),
});

export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;
export type ShippingAddressFields = z.infer<typeof shippingAddressFieldsSchema>;
