import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminAuditListQuerySchema } from "@/features/admin-audit/schemas/admin-audit.schema";
import { adminAuditRepository } from "@/features/admin-audit/services/admin-audit.repository";

/**
 * GET /api/admin/audit — chỉ ADMIN (khớp RLS "Only admin can view audit
 * log" trên bảng `audit_log`; Staff không có mục Audit trong nav).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "ADMIN");

  const query = adminAuditListQuerySchema.parse({
    action: req.nextUrl.searchParams.get("action") ?? undefined,
    actor: req.nextUrl.searchParams.get("actor") ?? undefined,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });

  const entries = await adminAuditRepository.list(query);
  return successResponse(entries);
});
