import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { blogListQuerySchema } from "@/features/blog/schemas/blog-query.schema";
import { blogService } from "@/features/blog/services/blog.service";

/**
 * GET /api/blog?category=&q=&recipeFilter=
 * List bài viết — hiện mock; khi có CMS giữ chữ ký service.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const raw = {
    category: req.nextUrl.searchParams.get("category") ?? undefined,
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    recipeFilter: req.nextUrl.searchParams.get("recipeFilter") ?? undefined,
  };
  const query = blogListQuerySchema.parse(raw);
  const posts = await blogService.listPosts(query);
  return successResponse(posts);
});
