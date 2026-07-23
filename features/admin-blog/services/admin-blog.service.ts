import { sleep } from "@/lib/utils";
import { ADMIN_BLOG_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_BLOG_POSTS } from "../data/posts.mock";
import type { AdminBlogInput, AdminBlogPost, AdminBlogStatus } from "../types";
import type { BlogCategoryId } from "@/features/blog/types";

let store: AdminBlogPost[] = structuredClone(MOCK_ADMIN_BLOG_POSTS);

export const adminBlogService = {
  async list(filter?: {
    category?: BlogCategoryId | "all";
    status?: AdminBlogStatus | "all";
  }): Promise<AdminBlogPost[]> {
    await sleep(ADMIN_BLOG_MOCK_LATENCY_MS);
    let rows = [...store];
    if (filter?.category && filter.category !== "all") {
      rows = rows.filter((p) => p.category === filter.category);
    }
    if (filter?.status && filter.status !== "all") {
      rows = rows.filter((p) => p.status === filter.status);
    }
    return rows.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getById(id: string): Promise<AdminBlogPost | null> {
    await sleep(ADMIN_BLOG_MOCK_LATENCY_MS);
    return store.find((p) => p.id === id) ?? null;
  },

  async create(input: AdminBlogInput): Promise<AdminBlogPost> {
    await sleep(ADMIN_BLOG_MOCK_LATENCY_MS);
    const slug = input.slug.trim();
    if (!slug || !input.title.trim()) throw new Error("Tiêu đề và slug bắt buộc.");
    if (store.some((p) => p.slug === slug)) throw new Error("Slug đã tồn tại.");
    const row: AdminBlogPost = {
      ...input,
      id: `post-adm-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    store = [row, ...store];
    return structuredClone(row);
  },

  async update(id: string, input: Partial<AdminBlogInput>): Promise<AdminBlogPost> {
    await sleep(ADMIN_BLOG_MOCK_LATENCY_MS);
    const idx = store.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Không tìm thấy bài.");
    const current = store[idx];
    if (input.slug && store.some((p) => p.slug === input.slug && p.id !== id)) {
      throw new Error("Slug đã tồn tại.");
    }
    const updated: AdminBlogPost = {
      ...current,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    store = [...store.slice(0, idx), updated, ...store.slice(idx + 1)];
    return structuredClone(updated);
  },
};
