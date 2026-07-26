import { z } from "zod";

const ADMIN_ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export const adminOrderListQuerySchema = z.object({
  status: z.enum([...ADMIN_ORDER_STATUSES, "all"]).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const adminOrderStatusUpdateSchema = z.object({
  status: z.enum(ADMIN_ORDER_STATUSES),
  note: z.string().trim().max(500, "Ghi chú không được vượt quá 500 ký tự").optional(),
});
