import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { updateProfileSchema } from "@/features/account/schemas/profile.schema";
import { profileService } from "@/features/account/services/profile.service";

/** GET /api/account/profile — hồ sơ user đang đăng nhập. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const profile = await profileService.getProfile(user.userId);
  return successResponse(profile);
});

/** PATCH /api/account/profile — cập nhật họ tên / SĐT. */
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const body = await req.json();
  const input = updateProfileSchema.parse(body);
  const profile = await profileService.updateProfile(user.userId, input);
  return successResponse(profile);
});
