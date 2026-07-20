import Image from "next/image";
import Link from "next/link";
import { BLOG_CATEGORIES } from "@/features/blog/constants";
import type { BlogCategoryId, BlogPostSummary } from "@/features/blog/types";
import { cn } from "@/lib/utils";

/** Nền tint theo chuyên mục — giữ nguyên. */
const TINT: Record<BlogCategoryId, string> = {
  recipes: "bg-primary-soft",
  protein: "bg-sky",
  lifestyle: "bg-lime",
  nutrition: "bg-sage",
};

function categoryLabel(id: BlogCategoryId): string {
  return BLOG_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function RelatedTile({ post }: { post: BlogPostSummary }) {
  const href = `/blog/${post.slug}`;

  return (
    <Link href={href} className="group flex min-w-[240px] flex-col sm:min-w-0">
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-[var(--radius-xl)]",
          TINT[post.category]
        )}
      >
        <Image
          src={post.coverImage}
          alt={post.coverAlt}
          fill
          sizes="(max-width: 640px) 70vw, (max-width: 1024px) 25vw, 22vw"
          className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <h3 className="mt-3.5 font-display text-[17px] font-black leading-[1.15] tracking-[-0.03em] text-ink uppercase md:text-[18px] lg:text-[20px]">
        {post.title}
      </h3>
      <p className="mt-1 text-[12px] font-extrabold tracking-[0.06em] text-ink uppercase md:text-[13px]">
        {categoryLabel(post.category)}
        <span className="mx-1.5 opacity-35">·</span>
        {post.readingMinutes} phút
      </p>
    </Link>
  );
}

/**
 * Related — Joy Rush PDP (verified tropical-tangerine):
 * title trái lớn + 4 cột; ảnh lớn (full cột). Không đổi cover/tint.
 */
export function BlogRelated({ posts }: { posts: BlogPostSummary[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-16 border-t border-ink/10 pt-16 pb-20 md:mt-24 md:pt-24 md:pb-28">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 md:px-10 lg:grid lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-center lg:gap-12">
        <h2 className="font-display text-[clamp(40px,5.2vw,60px)] font-black uppercase leading-[0.92] tracking-[-0.05em] text-ink">
          <span className="block">Bài viết</span>
          <span className="block">liên quan</span>
        </h2>

        <div className="-mx-6 flex gap-5 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 md:grid-cols-4 md:gap-5 lg:gap-6 [&::-webkit-scrollbar]:hidden">
          {posts.map((post) => (
            <RelatedTile key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
