import type { NextRequest } from "next/server";

/**
 * Đọc JSON body có thể VẮNG MẶT.
 *
 * `req.json()` ném `SyntaxError` khi body rỗng, và `SyntaxError` không phải
 * `AppError`/`ZodError` nên `withErrorHandler` sẽ trả 500 cho một request hợp
 * lệ (POST không body). Trả `{}` để schema `.strict()` với toàn field optional
 * tự quyết định — schema là nơi duy nhất định nghĩa "body nào hợp lệ".
 */
export async function readOptionalJsonBody(req: NextRequest): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
