import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { BadRequestError } from "@/src/errors/app.error";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { blogService } from "@/features/blog/services/blog.service";

/**
 * GET /api/blog/[slug]
 */
export const GET = withErrorHandler(async (req: NextRequest, context) => {
  void req;
  const slug = (await context?.params)?.slug;
  if (!slug) {
    throw new BadRequestError("Thiếu slug bài viết");
  }
  const post = await blogService.getPostBySlug(slug);
  return successResponse(post);
});
