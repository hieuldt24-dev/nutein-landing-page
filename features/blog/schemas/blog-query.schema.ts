import { z } from "zod";

const categoryEnum = z.enum([
  "all",
  "recipes",
  "protein",
  "lifestyle",
  "nutrition",
]);

const recipeFilterEnum = z.enum([
  "breakfast",
  "post_workout",
  "snack",
  "eat_clean",
  "vegan",
]);

/**
 * Query list blog — GET /api/blog và searchParams /blog.
 */
export const blogListQuerySchema = z.object({
  category: categoryEnum.optional(),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  recipeFilter: recipeFilterEnum.optional(),
});

export type BlogListQueryInput = z.infer<typeof blogListQuerySchema>;
