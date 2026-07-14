import { NextRequest } from "next/server";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { successResponse } from "@/src/api/response";
import { contactFormSchema } from "@/features/contact/schemas/contact.schema";
import { contactService } from "@/features/contact/services/contact.service";

/**
 * POST /api/contact
 *
 * Nhận dữ liệu form liên hệ, validate và xử lý.
 * Route này cực kỳ mỏng - chỉ validate input, gọi service, và trả về response.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();

  // 1. Validate dữ liệu đầu vào
  const validatedData = contactFormSchema.parse(body);

  // 2. Gọi service xử lý nghiệp vụ
  const result = await contactService.submit(validatedData);

  // 3. Trả về response chuẩn
  return successResponse(result, undefined, 201);
});
