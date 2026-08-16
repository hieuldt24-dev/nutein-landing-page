import { getProductDetailServer } from "@/features/product/services/product-catalog.server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";

// Cart pricing/stock should always reflect staff updates, not a route cache.
export const dynamic = "force-dynamic";

/** Public read-only catalog for browser cart/pricing state. */
export const GET = withErrorHandler(async () => {
  const product = await getProductDetailServer();
  const response = successResponse(product);
  response.headers.set("Cache-Control", "no-store");
  return response;
});
