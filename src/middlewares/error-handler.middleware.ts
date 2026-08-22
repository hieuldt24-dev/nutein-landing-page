import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/src/errors/app.error";
import { errorResponse } from "@/src/api/response";
import { logger } from "@/src/logging/logger";

/**
 * Handler type cho Next.js App Router API Route (Next.js 16+).
 * Lưu ý: Từ Next.js 15+, `context.params` là Promise<Record<string, string>>.
 * Generic theo `T` — route tĩnh dùng mặc định (không cần params); route động
 * truyền `withErrorHandler<{ id: string }>(...)` để có `params` gõ kiểu đúng.
 */
type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>;
};

type RouteHandler<T extends Record<string, string> = Record<string, string>> = (
  req: NextRequest,
  context: RouteContext<T>
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
export function withErrorHandler<T extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<T>
): (req: NextRequest, context?: RouteContext<T>) => Promise<NextResponse> {
  return async (req: NextRequest, context?: RouteContext<T>) => {
    try {
      return await handler(req, context as RouteContext<T>);
    } catch (error) {
      // Lỗi do validate dữ liệu (Zod)
      if (error instanceof ZodError) {
        const messages = error.issues.map((e) => e.message).join(", ");
        logger.warn({ path: req.nextUrl.pathname, issues: error.issues }, "Validation error");
        return errorResponse(`Dữ liệu không hợp lệ: ${messages}`, "VALIDATION_ERROR", 400);
      }

      // Lỗi nghiệp vụ đã được định nghĩa (AppError)
      if (error instanceof AppError) {
        logger.warn(
          { path: req.nextUrl.pathname, code: error.code, details: error.details },
          error.message
        );
        return errorResponse(error.message, error.code, error.statusCode);
      }

      // Lỗi không mong muốn
      logger.error({ path: req.nextUrl.pathname, err: error }, "Unexpected error in API route");
      return errorResponse("Đã xảy ra lỗi máy chủ nội bộ", "INTERNAL_SERVER_ERROR", 500);
    }
  };
}
