import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { NotFoundError } from "@/src/errors/app.error";
import { adminBlogUpdateSchema } from "@/features/admin-blog/schemas/admin-blog.schema";
import { adminBlogRepository } from "@/features/admin-blog/services/admin-blog.repository";

/**
 * GET /api/staff/blog/[id] — chỉ Staff.
 */
export const GET = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const post = await adminBlogRepository.getById(id);
    if (!post) {
      throw new NotFoundError("Bài viết");
    }
    return successResponse(post);
  },
);

/**
 * PATCH /api/staff/blog/[id] — cập nhật một phần.
 */
export const PATCH = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const body = await req.json();
    const input = adminBlogUpdateSchema.parse(body);
    const post = await adminBlogRepository.update(id, input);
    // Trang chi tiết dùng ISR (revalidate 1h) — invalidate ngay để độc giả
    // thấy bản sửa mới nhất thay vì đợi hết chu kỳ cache.
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    return successResponse(post);
  },
);
