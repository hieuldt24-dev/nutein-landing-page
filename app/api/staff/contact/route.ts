import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminContactListQuerySchema } from "@/features/admin-contact/schemas/admin-contact.schema";
import { adminContactRepository } from "@/features/admin-contact/services/admin-contact.repository";

/**
 * GET /api/staff/contact?filter=all|unread|open|handled&limit=&offset= — chỉ Staff.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const query = adminContactListQuerySchema.parse({
    filter: req.nextUrl.searchParams.get("filter") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    offset: req.nextUrl.searchParams.get("offset") ?? undefined,
  });
  const result = await adminContactRepository.list(query);
  return successResponse(result);
});
