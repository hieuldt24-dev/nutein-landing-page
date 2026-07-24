import { z } from "zod";

export const adminAuditListQuerySchema = z.object({
  action: z.enum(["CREATE", "UPDATE", "DELETE", "all"]).optional(),
  actor: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});
