import { apiRequest, type FetchError } from "@/lib/api-client";
import type { AdminStaticPage, AdminStaticSlug } from "../types";

const BASE_PATH = "/api/staff/content";

/**
 * Admin content domain (S7) — client fetch wrapper gọi `app/api/staff/content/**`.
 * Business logic/DB thật nằm ở `admin-content.repository.ts` (server-only).
 */
export const adminContentService = {
  async list(): Promise<AdminStaticPage[]> {
    return apiRequest<AdminStaticPage[]>(BASE_PATH);
  },

  async getPage(slug: AdminStaticSlug): Promise<AdminStaticPage | null> {
    try {
      return await apiRequest<AdminStaticPage>(`${BASE_PATH}/${slug}`);
    } catch (err) {
      if ((err as FetchError)?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  async updatePage(
    slug: AdminStaticSlug,
    patch: { title?: string; content?: string },
  ): Promise<AdminStaticPage> {
    return apiRequest<AdminStaticPage>(`${BASE_PATH}/${slug}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};
