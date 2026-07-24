import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { NotFoundError } from "@/src/errors/app.error";
import {
  adminContentUpdateSchema,
  adminStaticSlugSchema,
} from "@/features/admin-content/schemas/admin-content.schema";
import { adminContentRepository } from "@/features/admin-content/services/admin-content.repository";

/**
 * GET /api/staff/content/[slug] — chỉ Staff.
 */
export const GET = withErrorHandler<{ slug: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { slug } = await params;
    const parsedSlug = adminStaticSlugSchema.parse(slug);
    const page = await adminContentRepository.getPage(parsedSlug);
    if (!page) {
      throw new NotFoundError("Trang");
    }
    return successResponse(page);
  },
);

/**
 * PATCH /api/staff/content/[slug] — upsert tiêu đề/nội dung.
 */
export const PATCH = withErrorHandler<{ slug: string }>(
  async (req: NextRequest, { params }) => {
    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { slug } = await params;
    const parsedSlug = adminStaticSlugSchema.parse(slug);
    const body = await req.json();
    const patch = adminContentUpdateSchema.parse(body);
    const page = await adminContentRepository.updatePage(parsedSlug, patch);
    return successResponse(page);
  },
);
