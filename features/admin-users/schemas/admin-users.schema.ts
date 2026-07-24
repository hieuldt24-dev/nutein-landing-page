import { z } from "zod";

export const adminUsersListQuerySchema = z.object({
  q: z.string().trim().optional(),
  role: z.enum(["user", "staff", "admin", "all"]).optional(),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["user", "staff", "admin"]).optional(),
  locked: z.boolean().optional(),
});
