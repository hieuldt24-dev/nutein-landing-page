import { fileTypeFromBuffer } from "file-type";

/**
 * MIME ảnh được phép upload. Nguồn sự thật duy nhất cho cả sniffer lẫn thông
 * báo lỗi ở `app/api/staff/uploads/route.ts`.
 *
 * Cố ý KHÔNG `import "server-only"` — module này phải unit-test được dưới
 * jsdom (mặc định của vitest ở repo này).
 */
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

/**
 * Đọc magic bytes của buffer và trả về MIME thật nếu nằm trong allowlist,
 * ngược lại `null`. Không tin `file.type` do client gửi lên — header đó giả
 * mạo được.
 */
export async function sniffImageType(buffer: Buffer): Promise<AllowedImageMime | null> {
  if (!buffer || buffer.length === 0) return null;

  // `file-type` yêu cầu đúng `Uint8Array` của realm hiện tại; Buffer từ realm
  // khác (jsdom trong test) sẽ trượt `instanceof`. Copy sang Uint8Array thuần.
  const detected = await fileTypeFromBuffer(Uint8Array.from(buffer));
  if (!detected) return null;

  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(detected.mime)
    ? (detected.mime as AllowedImageMime)
    : null;
}
