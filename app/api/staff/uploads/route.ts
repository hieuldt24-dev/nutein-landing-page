import { NextRequest } from "next/server";
import { createdResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { BadRequestError, InternalServerError } from "@/src/errors/app.error";
import { cloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/staff/uploads — multipart/form-data field `file`. Chỉ Staff.
 * Upload ảnh marketing (sản phẩm, blog cover...) lên Cloudinary, trả về
 * `secure_url` để lưu vào cột/JSONB tương ứng — không lưu file lên disk
 * server (khác `src/middlewares/upload.middleware.ts`, vốn ghi local
 * `public/uploads` và không phù hợp môi trường serverless).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  if (!isCloudinaryConfigured) {
    throw new InternalServerError(
      "Thiếu CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET — kiểm tra lại file .env",
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thiếu file ảnh.");
  }
  if (!file.type.startsWith("image/")) {
    throw new BadRequestError("Chỉ chấp nhận file ảnh.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestError("Ảnh tối đa 5MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    const result = await cloudinary.uploader.upload(base64, {
      folder: "nutein/products",
      resource_type: "image",
    });
    return createdResponse({ url: result.secure_url });
  } catch (err) {
    throw new InternalServerError(
      err instanceof Error ? err.message : "Upload ảnh thất bại.",
    );
  }
});
