import "server-only";

import { getSupabaseClient } from "@/lib/supabase";
import { NUTEIN_PRODUCT_DB_ID } from "../constants";
import type { ProductDetail } from "../types";
import {
  productService,
  rowToProductDetail,
  type ProductRow,
} from "./product.service";

const PRODUCT_SELECT = "id, sku, slug, name, description, price, marketing_meta, stock";

/**
 * Server-only product reader. It keeps Supabase out of the browser bundle and
 * preserves the previous best-effort cache plus live-stock behavior.
 */
export async function refreshProductCatalogServer(): Promise<{ stock: number } | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", NUTEIN_PRODUCT_DB_ID)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as ProductRow;
    productService.setProductDetail(rowToProductDetail(row));
    return { stock: Number(row.stock) };
  } catch {
    // Preserve last valid data (or the mock fallback) if DB access is unavailable.
    return null;
  }
}

/** PDP/API snapshot with the same failure fallback as the previous service. */
export async function getProductDetailServer(): Promise<ProductDetail> {
  await refreshProductCatalogServer();
  return productService.getProductDetail();
}
