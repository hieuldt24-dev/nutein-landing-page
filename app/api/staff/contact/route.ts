import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminContactFilterSchema } from "@/features/admin-contact/schemas/admin-contact.schema";
import { adminContactRepository } from "@/features/admin-contact/services/admin-contact.repository";

/**
 * GET /api/staff/contact?filter=all|unread|open|handled — chỉ Staff.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const filter = adminContactFilterSchema.parse(
    req.nextUrl.searchParams.get("filter") ?? undefined,
  );
  const messages = await adminContactRepository.list(filter);
  return successResponse(messages);
});
