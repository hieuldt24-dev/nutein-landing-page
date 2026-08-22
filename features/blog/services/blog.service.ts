import "server-only";

import { getSupabaseClient } from "@/lib/supabase";
import { NotFoundError } from "@/src/errors/app.error";
import { sanitizeBlogHtml } from "@/lib/sanitize-blog-html";
import type {
  BlogCategoryId,
  BlogListQuery,
  BlogPost,
  BlogPostSummary,
  RecipeFilterId,
} from "../types";

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
  published_at: string | null;
  reading_minutes: number;
  featured: boolean;
  favorite: boolean;
  recipe_filters: string[] | null;
}

const POST_SELECT =
  "id, category, tags, title, slug, thumbnail, cover_alt, excerpt, content, published_at, reading_minutes, featured, favorite, recipe_filters";

const CATEGORY_FROM_DB: Record<DbBlogCategory, BlogCategoryId> = {
  RECIPES: "recipes",
  PROTEIN: "protein",
  HEALTHY_LIFESTYLE: "lifestyle",
  NUTRITION: "nutrition",
};

function toBlogPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    category: CATEGORY_FROM_DB[row.category],
    coverImage: row.thumbnail ?? "",
    coverAlt: row.cover_alt ?? "",
    publishedAt: row.published_at ?? "",
    readingMinutes: row.reading_minutes,
    featured: row.featured,
    favorite: row.favorite,
    recipeFilters: (row.recipe_filters ?? undefined) as RecipeFilterId[] | undefined,
    tags: row.tags ?? undefined,
    // F3 — sanitize read-time (defense in depth cho các bài đã lưu TRƯỚC khi
    // có sanitize write-time). Cùng allowlist với admin-blog.repository.
    bodyHtml: sanitizeBlogHtml(row.content),
  };
}

function toSummary(post: BlogPost): BlogPostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt,
    publishedAt: post.publishedAt,
    readingMinutes: post.readingMinutes,
    featured: post.featured,
    favorite: post.favorite,
    recipeFilters: post.recipeFilters,
    tags: post.tags,
  };
}

function matchesQuery(post: BlogPost, q: string): boolean {
  const hay = [post.title, post.excerpt, ...(post.tags ?? [])]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function sortByDateDesc(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Đọc tất cả bài đã publish — RLS ("Public can view published posts") đã
 * tự giới hạn is_published = true cho anon client, filter category/tìm
 * kiếm/sort vẫn xử lý in-memory như bản mock cũ (dataset nhỏ, giữ nguyên
 * logic đã có thay vì viết lại bằng SQL).
 */
async function fetchPublishedPosts(): Promise<BlogPost[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("is_published", true);

  if (error) {
    throw new Error(`Không tải được danh sách bài viết: ${error.message}`);
  }
  return ((data as BlogPostRow[]) ?? []).map(toBlogPost);
}

function applyListFilters(posts: BlogPost[], query: BlogListQuery): BlogPost[] {
  let filtered = [...posts];

  const category = query.category;
  if (category && category !== "all") {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (query.recipeFilter) {
    filtered = filtered.filter(
      (p) => p.category === "recipes" && p.recipeFilters?.includes(query.recipeFilter!)
    );
  }

  const q = query.q?.trim();
  if (q) {
    filtered = filtered.filter((p) => matchesQuery(p, q));
  }

  return sortByDateDesc(filtered);
}

/**
 * Blog domain — đọc bảng `blog_posts` thật qua anon client (RLS lo phần
 * is_published). Khi gắn CMS khác: đổi thân hàm, giữ chữ ký để page/UI/API
 * không đổi.
 */
export const blogService = {
  async listPosts(query: BlogListQuery = {}): Promise<BlogPostSummary[]> {
    const posts = await fetchPublishedPosts();
    return applyListFilters(posts, query).map(toSummary);
  },

  async listFeatured(limit = 4): Promise<BlogPostSummary[]> {
    const posts = await fetchPublishedPosts();
    return sortByDateDesc(posts.filter((p) => p.featured))
      .slice(0, limit)
      .map(toSummary);
  },

  async listLatest(limit = 6): Promise<BlogPostSummary[]> {
    const posts = await fetchPublishedPosts();
    return sortByDateDesc(posts).slice(0, limit).map(toSummary);
  },

  async listFavoriteRecipes(limit = 4): Promise<BlogPostSummary[]> {
    const posts = await fetchPublishedPosts();
    return sortByDateDesc(posts.filter((p) => p.category === "recipes" && p.favorite))
      .slice(0, limit)
      .map(toSummary);
  },

  /** true khi đang lọc/tìm — list page hiện lưới thay vì section curated. */
  hasActiveFilters(query: BlogListQuery): boolean {
    return Boolean(
      (query.category && query.category !== "all") || query.q?.trim() || query.recipeFilter
    );
  },

  async getPostBySlug(slug: string): Promise<BlogPost> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("blog_posts")
      .select(POST_SELECT)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      throw new Error(`Không tải được bài viết: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundError("Bài viết");
    }
    return toBlogPost(data as BlogPostRow);
  },

  async listRelated(slug: string, limit = 3): Promise<BlogPostSummary[]> {
    const posts = await fetchPublishedPosts();
    const current = posts.find((p) => p.slug === slug);
    if (!current) return [];

    const sameCategory = posts.filter((p) => p.slug !== slug && p.category === current.category);
    const others = posts.filter((p) => p.slug !== slug && p.category !== current.category);

    return [...sameCategory, ...others].slice(0, limit).map(toSummary);
  },

  async listSlugs(): Promise<string[]> {
    const posts = await fetchPublishedPosts();
    return posts.map((p) => p.slug);
  },
};
