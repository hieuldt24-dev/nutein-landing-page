import { MOCK_BLOG_POSTS } from "@/features/blog/data/posts.mock";
import type { AdminBlogPost } from "../types";

/** Lấy vài bài đầu từ storefront mock — admin store tách. */
export const MOCK_ADMIN_BLOG_POSTS: AdminBlogPost[] = MOCK_BLOG_POSTS.slice(0, 5).map(
  (p, i) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    coverImage: p.coverImage,
    coverAlt: p.coverAlt,
    bodyHtml: p.bodyHtml,
    status: i === 4 ? ("draft" as const) : ("published" as const),
    publishedAt: i === 4 ? null : p.publishedAt,
    readingMinutes: p.readingMinutes,
    recipeFilters: p.recipeFilters,
    tags: p.tags,
    updatedAt: `${p.publishedAt ?? "2026-07-01"}T12:00:00.000Z`,
  })
);
