/**
 * Domain types — Blog / Kiến thức.
 * Summary dùng cho list; BlogPost thêm body cho detail.
 */

export type BlogCategoryId =
  | "recipes"
  | "protein"
  | "lifestyle"
  | "nutrition";

/** Bộ lọc lồng trong chuyên mục Công thức (§3.5). */
export type RecipeFilterId =
  | "breakfast"
  | "post_workout"
  | "snack"
  | "eat_clean"
  | "vegan";

export type BlogCategory = {
  id: BlogCategoryId;
  label: string;
};

export type RecipeFilter = {
  id: RecipeFilterId;
  label: string;
};

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategoryId;
  coverImage: string;
  coverAlt: string;
  publishedAt: string;
  readingMinutes: number;
  featured?: boolean;
  /** Curated “Công thức yêu thích” trên list. */
  favorite?: boolean;
  /** Recipe meal-type filters + free tags. */
  recipeFilters?: RecipeFilterId[];
  tags?: string[];
};

export type BlogPost = BlogPostSummary & {
  bodyHtml: string;
};

export type BlogListQuery = {
  category?: BlogCategoryId | "all";
  q?: string;
  /** Chỉ áp khi category = recipes (hoặc lọc recipes). */
  recipeFilter?: RecipeFilterId;
};
