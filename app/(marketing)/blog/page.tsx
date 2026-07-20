import type { Metadata } from "next";
import { BlogHero } from "@/components/blog/BlogHero";
import { BlogPostGrid } from "@/components/blog/BlogPostGrid";
import { BlogSection } from "@/components/blog/BlogSection";
import { BlogToolbar } from "@/components/blog/BlogToolbar";
import { BLOG_PAGE_META } from "@/features/blog/constants";
import { blogListQuerySchema } from "@/features/blog/schemas/blog-query.schema";
import { blogService } from "@/features/blog/services/blog.service";

export const metadata: Metadata = {
  title: BLOG_PAGE_META.title,
  description: BLOG_PAGE_META.description,
  openGraph: {
    title: BLOG_PAGE_META.title,
    description: BLOG_PAGE_META.description,
    locale: "vi_VN",
    type: "website",
  },
};

type BlogPageProps = {
  searchParams: Promise<{
    category?: string;
    q?: string;
    recipeFilter?: string;
  }>;
};

/**
 * Kiến thức list — §3.5:
 * Hero + search/filter → (Nổi bật / Mới nhất / Công thức yêu thích)
 * hoặc lưới kết quả khi đang lọc.
 */
export default async function BlogPage({ searchParams }: BlogPageProps) {
  const raw = await searchParams;
  const query = blogListQuerySchema.parse({
    category: raw.category,
    q: raw.q,
    recipeFilter: raw.recipeFilter,
  });

  const filtering = blogService.hasActiveFilters(query);

  const [filtered, featured, latest, favorites] = await Promise.all([
    filtering ? blogService.listPosts(query) : Promise.resolve([]),
    !filtering ? blogService.listFeatured(4) : Promise.resolve([]),
    !filtering ? blogService.listLatest(8) : Promise.resolve([]),
    !filtering ? blogService.listFavoriteRecipes(4) : Promise.resolve([]),
  ]);

  return (
    <main className="bg-bg pt-32 md:pt-40">
      <BlogHero />
      <BlogToolbar
        category={query.category ?? "all"}
        q={query.q ?? ""}
        recipeFilter={query.recipeFilter}
      />

      {filtering ? (
        <div className="pt-10 md:pt-12">
          <BlogPostGrid posts={filtered} hasFilters />
        </div>
      ) : (
        <div className="pt-10 md:pt-12">
          <BlogSection title="Bài viết nổi bật" posts={featured} />
          <BlogSection title="Bài viết mới nhất" posts={latest} />
          <BlogSection title="Công thức yêu thích" posts={favorites} />
        </div>
      )}
    </main>
  );
}
