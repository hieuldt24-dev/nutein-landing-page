import { z } from "zod";

export const adminUsersListQuerySchema = z.object({
  q: z.string().trim().optional(),
  role: z.enum(["user", "staff", "admin", "all"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["user", "staff", "admin"]).optional(),
  locked: z.boolean().optional(),
});
