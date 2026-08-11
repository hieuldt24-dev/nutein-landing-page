import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createdResponse, successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import {
  adminBlogInputSchema,
  adminBlogListQuerySchema,
} from "@/features/admin-blog/schemas/admin-blog.schema";
import { adminBlogRepository } from "@/features/admin-blog/services/admin-blog.repository";

/**
 * GET /api/staff/blog?category=&status= — chỉ Staff.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const query = adminBlogListQuerySchema.parse({
    category: req.nextUrl.searchParams.get("category") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });
  const posts = await adminBlogRepository.list(query);
  return successResponse(posts);
});

/**
 * POST /api/staff/blog — tạo bài viết mới.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const body = await req.json();
  const input = adminBlogInputSchema.parse(body);
  const post = await adminBlogRepository.create(input);
  // Bài mới publish cần hiện ngay ở /blog và trang chi tiết của nó.
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return createdResponse(post);
});
