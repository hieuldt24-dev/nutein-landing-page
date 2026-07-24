import { apiRequest } from "@/lib/api-client";
import type { AdminBlogInput, AdminBlogPost, AdminBlogStatus } from "../types";
import type { BlogCategoryId } from "@/features/blog/types";

const BASE_PATH = "/api/staff/blog";

function buildListQueryString(filter?: {
  category?: BlogCategoryId | "all";
  status?: AdminBlogStatus | "all";
}): string {
  const params = new URLSearchParams();
  if (filter?.category && filter.category !== "all") params.set("category", filter.category);
  if (filter?.status && filter.status !== "all") params.set("status", filter.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin blog domain (S8) — client fetch wrapper gọi `app/api/staff/blog/**`.
 * Business logic/DB thật nằm ở `admin-blog.repository.ts` (server-only).
 */
export const adminBlogService = {
  async list(filter?: {
    category?: BlogCategoryId | "all";
    status?: AdminBlogStatus | "all";
  }): Promise<AdminBlogPost[]> {
    return apiRequest<AdminBlogPost[]>(`${BASE_PATH}${buildListQueryString(filter)}`);
  },

  async getById(id: string): Promise<AdminBlogPost | null> {
    return apiRequest<AdminBlogPost>(`${BASE_PATH}/${id}`);
  },

  async create(input: AdminBlogInput): Promise<AdminBlogPost> {
    return apiRequest<AdminBlogPost>(BASE_PATH, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: Partial<AdminBlogInput>): Promise<AdminBlogPost> {
    return apiRequest<AdminBlogPost>(`${BASE_PATH}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};
