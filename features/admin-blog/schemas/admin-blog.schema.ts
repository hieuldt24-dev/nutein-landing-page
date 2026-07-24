import { z } from "zod";

const BLOG_CATEGORIES = ["recipes", "protein", "lifestyle", "nutrition"] as const;
const RECIPE_FILTERS = ["breakfast", "post_workout", "snack", "eat_clean", "vegan"] as const;

export const adminBlogListQuerySchema = z.object({
  category: z.enum([...BLOG_CATEGORIES, "all"]).optional(),
  status: z.enum(["draft", "published", "all"]).optional(),
});

export const adminBlogInputSchema = z.object({
  slug: z.string().trim().min(1, "Slug bắt buộc."),
  title: z.string().trim().min(1, "Tiêu đề bắt buộc."),
  excerpt: z.string().trim(),
  category: z.enum(BLOG_CATEGORIES),
  coverImage: z.string().trim(),
  coverAlt: z.string().trim(),
  bodyHtml: z.string(),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().nullable(),
  readingMinutes: z.number().int().min(1, "Phút đọc phải >= 1."),
  featured: z.boolean().optional(),
  favorite: z.boolean().optional(),
  recipeFilters: z.array(z.enum(RECIPE_FILTERS)).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const adminBlogUpdateSchema = adminBlogInputSchema.partial();
