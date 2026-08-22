import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { BadRequestError, NotFoundError } from "@/src/errors/app.error";
import { sanitizeBlogHtml } from "@/lib/sanitize-blog-html";
import type { BlogCategoryId, RecipeFilterId } from "@/features/blog/types";
import type { AdminBlogInput, AdminBlogPost, AdminBlogStatus } from "../types";

type DbBlogCategory = "RECIPES" | "PROTEIN" | "HEALTHY_LIFESTYLE" | "NUTRITION";

interface BlogPostRow {
  id: string;
  category: DbBlogCategory;
  tags: string[] | null;
  title: string;
  slug: string;
  thumbnail: string | null;
  cover_alt: string | null;
  excerpt: string | null;
  content: string;
  is_published: boolean;
  published_at: string | null;
  reading_minutes: number;
  featured: boolean;
  favorite: boolean;
  recipe_filters: string[] | null;
  updated_at: string;
}

const POST_SELECT =
  "id, category, tags, title, slug, thumbnail, cover_alt, excerpt, content, is_published, published_at, reading_minutes, featured, favorite, recipe_filters, updated_at";

const CATEGORY_TO_DB: Record<BlogCategoryId, DbBlogCategory> = {
  recipes: "RECIPES",
  protein: "PROTEIN",
  lifestyle: "HEALTHY_LIFESTYLE",
  nutrition: "NUTRITION",
};

const CATEGORY_FROM_DB: Record<DbBlogCategory, BlogCategoryId> = {
  RECIPES: "recipes",
  PROTEIN: "protein",
  HEALTHY_LIFESTYLE: "lifestyle",
  NUTRITION: "nutrition",
};

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function toAdminBlogPost(row: BlogPostRow): AdminBlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    category: CATEGORY_FROM_DB[row.category],
    coverImage: row.thumbnail ?? "",
    coverAlt: row.cover_alt ?? "",
    bodyHtml: row.content,
    status: row.is_published ? "published" : "draft",
    publishedAt: row.published_at,
    readingMinutes: row.reading_minutes,
    featured: row.featured,
    favorite: row.favorite,
    recipeFilters: (row.recipe_filters ?? undefined) as RecipeFilterId[] | undefined,
    tags: row.tags ?? undefined,
    updatedAt: row.updated_at,
  };
}

function toInsertPayload(input: AdminBlogInput) {
  return {
    category: CATEGORY_TO_DB[input.category],
    tags: input.tags ?? [],
    title: input.title,
    slug: input.slug,
    thumbnail: input.coverImage || null,
    cover_alt: input.coverAlt || null,
    excerpt: input.excerpt || null,
    // F3 — sanitize ngay trước khi giá trị vào payload ghi DB (write-time).
    content: sanitizeBlogHtml(input.bodyHtml),
    is_published: input.status === "published",
    published_at: input.status === "published" ? input.publishedAt ?? new Date().toISOString() : null,
    reading_minutes: input.readingMinutes,
    featured: input.featured ?? false,
    favorite: input.favorite ?? false,
    recipe_filters: input.recipeFilters ?? [],
  };
}

function toUpdatePayload(input: Partial<AdminBlogInput>) {
  const payload: Record<string, unknown> = {};
  if (input.category !== undefined) payload.category = CATEGORY_TO_DB[input.category];
  if (input.tags !== undefined) payload.tags = input.tags;
  if (input.title !== undefined) payload.title = input.title;
  if (input.slug !== undefined) payload.slug = input.slug;
  if (input.coverImage !== undefined) payload.thumbnail = input.coverImage || null;
  if (input.coverAlt !== undefined) payload.cover_alt = input.coverAlt || null;
  if (input.excerpt !== undefined) payload.excerpt = input.excerpt || null;
  // F3 — sanitize write-time, dùng CHUNG allowlist với read-time.
  if (input.bodyHtml !== undefined) payload.content = sanitizeBlogHtml(input.bodyHtml);
  if (input.readingMinutes !== undefined) payload.reading_minutes = input.readingMinutes;
  if (input.featured !== undefined) payload.featured = input.featured;
  if (input.favorite !== undefined) payload.favorite = input.favorite;
  if (input.recipeFilters !== undefined) payload.recipe_filters = input.recipeFilters;
  if (input.status !== undefined) {
    payload.is_published = input.status === "published";
    payload.published_at =
      input.status === "published" ? input.publishedAt ?? new Date().toISOString() : null;
  }
  return payload;
}

/** slug UNIQUE ở DB — 23505 = duplicate key. */
function isDuplicateSlugError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function list(filter?: {
  category?: BlogCategoryId | "all";
  status?: AdminBlogStatus | "all";
}): Promise<AdminBlogPost[]> {
  const client = requireAdminClient();
  let builder = client.from("blog_posts").select(POST_SELECT);

  if (filter?.category && filter.category !== "all") {
    builder = builder.eq("category", CATEGORY_TO_DB[filter.category]);
  }
  if (filter?.status && filter.status !== "all") {
    builder = builder.eq("is_published", filter.status === "published");
  }

  const { data, error } = await builder.order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Không tải được danh sách bài viết: ${error.message}`);
  }
  return ((data as BlogPostRow[]) ?? []).map(toAdminBlogPost);
}

async function getById(id: string): Promise<AdminBlogPost | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Không tải được bài viết: ${error.message}`);
  }
  return data ? toAdminBlogPost(data as BlogPostRow) : null;
}

async function create(input: AdminBlogInput): Promise<AdminBlogPost> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("blog_posts")
    .insert(toInsertPayload(input))
    .select(POST_SELECT)
    .single();

  if (error) {
    if (isDuplicateSlugError(error)) {
      throw new BadRequestError("Slug đã tồn tại.");
    }
    throw new Error(`Không tạo được bài viết: ${error.message}`);
  }
  return toAdminBlogPost(data as BlogPostRow);
}

async function update(id: string, input: Partial<AdminBlogInput>): Promise<AdminBlogPost> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("blog_posts")
    .update(toUpdatePayload(input))
    .eq("id", id)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    if (isDuplicateSlugError(error)) {
      throw new BadRequestError("Slug đã tồn tại.");
    }
    throw new Error(`Không cập nhật được bài viết: ${error.message}`);
  }
  if (!data) {
    throw new NotFoundError("Bài viết");
  }
  return toAdminBlogPost(data as BlogPostRow);
}

export const adminBlogRepository = {
  list,
  getById,
  create,
  update,
};
