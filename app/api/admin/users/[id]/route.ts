import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { BadRequestError } from "@/src/errors/app.error";
import { adminUserUpdateSchema } from "@/features/admin-users/schemas/admin-users.schema";
import { adminUsersRepository } from "@/features/admin-users/services/admin-users.repository";

/**
 * PATCH /api/admin/users/[id] — đổi vai trò và/hoặc khóa/mở khóa. Chỉ ADMIN.
 */
export const PATCH = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "ADMIN");

    const { id } = await params;
    if (id === user.userId) {
      throw new BadRequestError(
        "Không thể tự đổi vai trò hoặc khóa tài khoản của chính mình.",
      );
    }

    const body = await req.json();
    const patch = adminUserUpdateSchema.parse(body);

    let updated = null;
    if (patch.role !== undefined) {
      updated = await adminUsersRepository.setRole(id, patch.role);
    }
    if (patch.locked !== undefined) {
      updated = await adminUsersRepository.setLocked(id, patch.locked);
    }
    if (!updated) {
      throw new BadRequestError("Không có trường nào để cập nhật.");
    }

    return successResponse(updated);
  },
);
