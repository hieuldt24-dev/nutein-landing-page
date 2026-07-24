import { z } from "zod";

const galleryImageSchema = z.object({
  id: z.string(),
  src: z.string(),
  alt: z.string(),
});

const specSchema = z.object({
  id: z.string(),
  value: z.string(),
  label: z.string(),
});

const variantSchema = z.object({
  id: z.string(),
  label: z.string(),
  units: z.number().int().min(1, "Số hũ / gói phải >= 1."),
  price: z.number().min(0).optional(),
});

export const adminProductUpdateSchema = z.object({
  name: z.string().trim().min(1, "Tên bắt buộc.").optional(),
  tagline: z.string().trim().optional(),
  description: z.string().trim().optional(),
  unitPrice: z.number().min(0, "Giá không hợp lệ.").optional(),
  stock: z.number().int().min(0, "Tồn kho không hợp lệ.").optional(),
  unitLabel: z.string().trim().optional(),
  image: z.string().trim().optional(),
  imageAlt: z.string().trim().optional(),
  defaultVariantId: z.string().trim().optional(),
  gallery: z.array(galleryImageSchema).optional(),
  specs: z.array(specSchema).optional(),
  variants: z.array(variantSchema).min(1, "Cần ít nhất 1 gói biến thể.").optional(),
});
