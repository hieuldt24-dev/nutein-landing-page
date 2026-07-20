import "server-only";

import { NotFoundError } from "@/src/errors/app.error";
import { MOCK_BLOG_POSTS } from "../data/posts.mock";
import type {
  BlogListQuery,
  BlogPost,
  BlogPostSummary,
} from "../types";

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
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function applyListFilters(query: BlogListQuery): BlogPost[] {
  let posts = [...MOCK_BLOG_POSTS];

  const category = query.category;
  if (category && category !== "all") {
    posts = posts.filter((p) => p.category === category);
  }

  if (query.recipeFilter) {
    posts = posts.filter(
      (p) =>
        p.category === "recipes" &&
        p.recipeFilters?.includes(query.recipeFilter!)
    );
  }

  const q = query.q?.trim();
  if (q) {
    posts = posts.filter((p) => matchesQuery(p, q));
  }

  return sortByDateDesc(posts);
}

/**
 * Blog domain — hiện lọc mock từ constants.
 * Khi gắn API/CMS: đổi thân hàm, giữ chữ ký để page/UI/API không đổi.
 */
export const blogService = {
  async listPosts(query: BlogListQuery = {}): Promise<BlogPostSummary[]> {
    return applyListFilters(query).map(toSummary);
  },

  async listFeatured(limit = 4): Promise<BlogPostSummary[]> {
    return sortByDateDesc(MOCK_BLOG_POSTS.filter((p) => p.featured))
      .slice(0, limit)
      .map(toSummary);
  },

  async listLatest(limit = 6): Promise<BlogPostSummary[]> {
    return sortByDateDesc(MOCK_BLOG_POSTS).slice(0, limit).map(toSummary);
  },

  async listFavoriteRecipes(limit = 4): Promise<BlogPostSummary[]> {
    return sortByDateDesc(
      MOCK_BLOG_POSTS.filter((p) => p.category === "recipes" && p.favorite)
    )
      .slice(0, limit)
      .map(toSummary);
  },

  /** true khi đang lọc/tìm — list page hiện lưới thay vì section curated. */
  hasActiveFilters(query: BlogListQuery): boolean {
    return Boolean(
      (query.category && query.category !== "all") ||
        query.q?.trim() ||
        query.recipeFilter
    );
  },

  async getPostBySlug(slug: string): Promise<BlogPost> {
    const post = MOCK_BLOG_POSTS.find((p) => p.slug === slug);
    if (!post) {
      throw new NotFoundError("Bài viết");
    }
    return post;
  },

  async listRelated(slug: string, limit = 3): Promise<BlogPostSummary[]> {
    const current = MOCK_BLOG_POSTS.find((p) => p.slug === slug);
    if (!current) return [];

    const sameCategory = MOCK_BLOG_POSTS.filter(
      (p) => p.slug !== slug && p.category === current.category
    );
    const others = MOCK_BLOG_POSTS.filter(
      (p) => p.slug !== slug && p.category !== current.category
    );

    return [...sameCategory, ...others].slice(0, limit).map(toSummary);
  },

  async listSlugs(): Promise<string[]> {
    return MOCK_BLOG_POSTS.map((p) => p.slug);
  },
};
