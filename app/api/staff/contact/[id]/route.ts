import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { NotFoundError } from "@/src/errors/app.error";
import { adminContactUpdateSchema } from "@/features/admin-contact/schemas/admin-contact.schema";
import { adminContactRepository } from "@/features/admin-contact/services/admin-contact.repository";

/**
 * GET /api/staff/contact/[id] — chỉ Staff.
 */
export const GET = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const message = await adminContactRepository.getById(id);
    if (!message) {
      throw new NotFoundError("Tin nhắn");
    }
    return successResponse(message);
  },
);

/**
 * PATCH /api/staff/contact/[id] — đánh dấu đã đọc/xử lý, lưu ghi chú nội bộ.
 */
export const PATCH = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const body = await req.json();
    const patch = adminContactUpdateSchema.parse(body);
    const message = await adminContactRepository.update(id, patch, user.userId);
    return successResponse(message);
  },
);
