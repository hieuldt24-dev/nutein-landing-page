import type { BlogCategoryId, RecipeFilterId } from "@/features/blog/types";

export type AdminBlogStatus = "draft" | "published";

export interface AdminBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategoryId;
  coverImage: string;
  coverAlt: string;
  bodyHtml: string;
  status: AdminBlogStatus;
  publishedAt: string | null;
  readingMinutes: number;
  /** Curation cho trang chủ/blog public — "Bài nổi bật" / "Công thức yêu thích". */
  featured?: boolean;
  favorite?: boolean;
  recipeFilters?: RecipeFilterId[];
  tags?: string[];
  updatedAt: string;
}

export type AdminBlogInput = Omit<AdminBlogPost, "id" | "updatedAt">;
