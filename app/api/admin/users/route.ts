import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminUsersListQuerySchema } from "@/features/admin-users/schemas/admin-users.schema";
import { adminUsersRepository } from "@/features/admin-users/services/admin-users.repository";

/**
 * GET /api/admin/users?q=&role= — chỉ ADMIN (khớp RLS "Admin can update
 * any profile"; mục Users chỉ có trong nav Admin, Staff không có).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "ADMIN");

  const query = adminUsersListQuerySchema.parse({
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    role: req.nextUrl.searchParams.get("role") ?? undefined,
  });
  const users = await adminUsersRepository.list(query);
  return successResponse(users);
});
