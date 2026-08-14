import type { BlogCategory, RecipeFilter } from "./types";

export const BLOG_PAGE_META = {
  title: "Blog | Nutein",
  description:
    "Công thức, protein thực vật, healthy lifestyle và dinh dưỡng — kiến thức giúp bạn nuôi dưỡng lối sống lành mạnh cùng Nutein.",
} as const;

/** 4 chuyên mục theo PROJECT_REQUIREMENTS §3.5 */
export const BLOG_CATEGORIES: readonly BlogCategory[] = [
  { id: "recipes", label: "Công thức" },
  { id: "protein", label: "Protein" },
  { id: "lifestyle", label: "Healthy Lifestyle" },
  { id: "nutrition", label: "Dinh dưỡng" },
] as const;

export const BLOG_CATEGORY_ALL = { id: "all" as const, label: "Tất cả" };

/** Bộ lọc lồng Công thức — §3.5 */
export const RECIPE_FILTERS: readonly RecipeFilter[] = [
  { id: "breakfast", label: "Bữa sáng" },
  { id: "post_workout", label: "Sau tập luyện" },
  { id: "snack", label: "Ăn nhẹ" },
  { id: "eat_clean", label: "Eat Clean" },
  { id: "vegan", label: "Thuần chay" },
] as const;
