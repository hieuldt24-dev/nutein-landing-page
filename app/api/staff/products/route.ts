import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";
import { adminProductUpdateSchema } from "@/features/admin-products/schemas/admin-products.schema";
import { adminProductsRepository } from "@/features/admin-products/services/admin-products.repository";

/**
 * GET /api/staff/products — single-SKU, không cần [id]. Chỉ Staff.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const product = await adminProductsRepository.getProduct();
  return successResponse(product);
});

/**
 * PATCH /api/staff/products — cập nhật sản phẩm chủ lực.
 */
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  requireRole(user, "STAFF");

  const body = await req.json();
  const patch = adminProductUpdateSchema.parse(body);
  const product = await adminProductsRepository.updateProduct(patch, user.userId);
  // PDP dùng ISR (revalidate 1h) — invalidate ngay để khách thấy giá/tồn
  // kho mới mà không phải chờ hết chu kỳ cache.
  revalidatePath("/product");
  return successResponse(product);
});
