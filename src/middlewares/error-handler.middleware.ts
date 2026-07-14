import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/src/errors/AppError";
import { errorResponse } from "@/src/api/response";
import { logger } from "@/src/logging/logger";

/**
 * Handler type cho Next.js App Router API Route (Next.js 16+).
 * Lưu ý: Từ Next.js 15+, `context.params` là Promise<Record<string, string>>
 */
type RouteContext = { params: Promise<Record<string, string>> };

type RouteHandler = (
  req: NextRequest,
  context?: RouteContext
) => Promise<NextResponse>;

/**
 * withErrorHandler - Higher-Order Function bọc quanh API route handlers.
 *
 * Tự động bắt mọi lỗi được throw trong handler và mapping ra HTTP response
 * chuẩn mà không cần try/catch lặp đi lặp lại ở mỗi route.
 *
 * Ví dụ sử dụng trong route.ts:
 *   export const GET = withErrorHandler(async (req) => {
 *     const data = await someService.getData();
 *     return successResponse(data);
 *   });
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: RouteContext) => {
    try {
      return await handler(req, context);
    } catch (error) {
      // Lỗi do validate dữ liệu (Zod)
      if (error instanceof ZodError) {
        const messages = error.issues.map((e) => e.message).join(", ");
        logger.warn({ path: req.nextUrl.pathname, issues: error.issues }, "Validation error");
        return errorResponse(`Dữ liệu không hợp lệ: ${messages}`, "VALIDATION_ERROR", 400);
      }

      // Lỗi nghiệp vụ đã được định nghĩa (AppError)
      if (error instanceof AppError) {
        if (error.isOperational) {
          logger.warn({ path: req.nextUrl.pathname, code: error.errorCode }, error.message);
        } else {
          logger.error({ path: req.nextUrl.pathname, err: error }, "Non-operational AppError");
        }
        return errorResponse(error.message, error.errorCode, error.statusCode);
      }

      // Lỗi không mong muốn
      logger.error({ path: req.nextUrl.pathname, err: error }, "Unexpected error in API route");
      return errorResponse("Đã xảy ra lỗi máy chủ nội bộ", "INTERNAL_SERVER_ERROR", 500);
    }
  };
}
