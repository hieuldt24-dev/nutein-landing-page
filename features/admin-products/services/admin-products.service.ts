import { apiRequest } from "@/lib/api-client";
import type { AdminProduct, AdminProductUpdate } from "../types";

const BASE_PATH = "/api/staff/products";

/**
 * Admin product domain (S4) — client fetch wrapper gọi `app/api/staff/products`.
 * Business logic/DB thật nằm ở `admin-products.repository.ts` (server-only).
 */
export const adminProductsService = {
  async getProduct(): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(BASE_PATH);
  },

  async updateProduct(patch: AdminProductUpdate): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(BASE_PATH, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  /** Upload ảnh lên Cloudinary qua `/api/staff/uploads`, trả về URL để gán vào field ảnh. */
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const { url } = await apiRequest<{ url: string }>("/api/staff/uploads", {
      method: "POST",
      body: formData,
    });
    return url;
  },
};
