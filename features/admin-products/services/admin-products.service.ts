import { sleep } from "@/lib/utils";
import { ADMIN_PRODUCTS_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_PRODUCT } from "../data/product.mock";
import type { AdminProduct, AdminProductUpdate } from "../types";

let productStore: AdminProduct = structuredClone(MOCK_ADMIN_PRODUCT);

/**
 * S4 — single-SKU admin product.
 * Swap: `getProduct` / `updateProduct` → API/Supabase `products`.
 */
export const adminProductsService = {
  async getProduct(): Promise<AdminProduct> {
    await sleep(ADMIN_PRODUCTS_MOCK_LATENCY_MS);
    return structuredClone(productStore);
  },

  async updateProduct(patch: AdminProductUpdate): Promise<AdminProduct> {
    await sleep(ADMIN_PRODUCTS_MOCK_LATENCY_MS);
    if (patch.unitPrice !== undefined && patch.unitPrice < 0) {
      throw new Error("Giá không hợp lệ.");
    }
    if (patch.stock !== undefined && patch.stock < 0) {
      throw new Error("Tồn kho không hợp lệ.");
    }
    productStore = {
      ...productStore,
      ...patch,
      gallery: patch.gallery ? structuredClone(patch.gallery) : productStore.gallery,
      specs: patch.specs ? structuredClone(patch.specs) : productStore.specs,
      variants: patch.variants
        ? structuredClone(patch.variants)
        : productStore.variants,
      updatedAt: new Date().toISOString(),
    };
    return structuredClone(productStore);
  },
};
