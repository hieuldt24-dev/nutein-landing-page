import type { BlogPostSummary } from "@/features/blog/types";
import { BlogPostCard } from "./BlogPostCard";

type BlogSectionProps = {
  title: string;
  posts: BlogPostSummary[];
  /** Số cột tối đa — featured/favorite thường 4. */
  columns?: "3" | "4";
};

/** Section tiêu đề + lưới bài (Nổi bật / Mới nhất / Yêu thích). */
export function BlogSection({
  title,
  posts,
  columns = "4",
}: BlogSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-14 md:px-10 md:pb-16">
      <h2 className="font-display text-[clamp(28px,3.5vw,40px)] font-black uppercase tracking-[-0.04em] text-ink">
        {title}
      </h2>
      <div
        className={
          columns === "3"
            ? "mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            : "mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }
      >
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
