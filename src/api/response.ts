import { NextResponse } from "next/server";

/**
 * Kiểu dữ liệu chuẩn hoá cho mọi API response.
 * Frontend luôn nhận được cùng một cấu trúc JSON.
 */
export interface ApiResponse<T = null> {
  success: boolean;
  data: T | null;
  error: {
    message: string;
    code: string;
  } | null;
  meta?: Record<string, unknown>;
}

/**
 * Tạo response thành công (200 OK)
 *
 * Ví dụ:
 *   return successResponse({ id: 1, name: "Nutein" });
 *   // => { success: true, data: { id: 1, name: "Nutein" }, error: null }
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, error: null, ...(meta && { meta }) },
    { status },
  );
}

/**
 * Tạo response tạo mới thành công (201 Created)
 */
export function createdResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return successResponse(data, undefined, 201);
}

/**
 * Tạo response lỗi
 *
 * Ví dụ:
 *   return errorResponse("Không tìm thấy sản phẩm", "NOT_FOUND", 404);
 */
export function errorResponse(
  message: string,
  code: string = "INTERNAL_SERVER_ERROR",
  status: number = 500,
  /**
   * Header phụ. Cần cho 429 `CHECKOUT_RATE_LIMITED` — `Retry-After` là một
   * header HTTP chuẩn, không thể nhét vào body và vẫn đúng contract.
   */
  headers?: Record<string, string>,
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { success: false, data: null, error: { message, code } },
    { status, ...(headers && { headers }) },
  );
}

/**
 * Tạo response thành công không có nội dung (204 No Content)
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
