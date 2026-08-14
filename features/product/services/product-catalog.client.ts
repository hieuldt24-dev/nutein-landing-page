"use client";

import { apiRequest } from "@/lib/api-client";
import type { ProductDetail } from "../types";
import { productService } from "./product.service";

/**
 * Refreshes client cart data through the application API. Never instantiate a
 * second browser Supabase client sharing the auth session storage key.
 */
export async function refreshProductCatalogClient(): Promise<ProductDetail | null> {
  try {
    const product = await apiRequest<ProductDetail>("/api/product/catalog", {
      cache: "no-store",
    });
    productService.setProductDetail(product);
    return product;
  } catch {
    // Keep current cached values so cart UI remains usable when offline.
    return null;
  }
}
