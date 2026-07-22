import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { emailExistsInUsers } from "@/features/auth/services/auth-email.server";

const bodySchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
});

/**
 * POST /api/auth/email-status
 * Body `{ email }` → `{ exists: boolean }`.
 * Dùng AuthModal: email chưa có → chuyển tab Đăng ký (không đoán bừa trên checkout guest).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json();
  const { email } = bodySchema.parse(json);
  const exists = await emailExistsInUsers(email);
  return successResponse({ exists });
});
