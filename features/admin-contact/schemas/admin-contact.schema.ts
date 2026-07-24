import { z } from "zod";

export const adminContactFilterSchema = z
  .enum(["all", "unread", "open", "handled"])
  .optional();

export const adminContactUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  isHandled: z.boolean().optional(),
  internalNote: z.string().trim().max(1000, "Ghi chú quá dài.").optional(),
});
