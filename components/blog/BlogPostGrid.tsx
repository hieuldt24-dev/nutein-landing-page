import Link from "next/link";
import type { BlogPostSummary } from "@/features/blog/types";
import { BlogPostCard } from "./BlogPostCard";
import { FillButton } from "@/components/ui/FillButton";

type BlogPostGridProps = {
  posts: BlogPostSummary[];
  hasFilters?: boolean;
};

/** Lưới 2→3→4 cột — empty state khi không có kết quả. */
export function BlogPostGrid({ posts, hasFilters }: BlogPostGridProps) {
  if (posts.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-16 text-center md:px-10">
        <p className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
          Không tìm thấy bài viết phù hợp.
        </p>
        <p className="mt-2 text-sm text-ink/65">
          Thử đổi từ khóa hoặc chọn chuyên mục khác.
        </p>
        {hasFilters ? (
          <FillButton
            href="/blog"
            variant="ink"
            className="mt-6 inline-flex h-[44px] px-6 text-[13px] font-bold uppercase"
          >
            Xóa bộ lọc
          </FillButton>
        ) : (
          <Link
            href="/blog"
            className="mt-6 inline-block text-sm font-bold text-primary-deep underline-offset-2 hover:underline"
          >
            Về trang Kiến thức
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-6 gap-y-12 px-6 pb-20 sm:grid-cols-2 md:px-10 lg:grid-cols-3 xl:grid-cols-4">
      {posts.map((post) => (
        <BlogPostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
