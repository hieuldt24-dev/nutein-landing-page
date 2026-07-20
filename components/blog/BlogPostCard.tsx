import Image from "next/image";
import Link from "next/link";
import { BLOG_CATEGORIES } from "@/features/blog/constants";
import type { BlogPostSummary } from "@/features/blog/types";
import { CtaCluster } from "@/components/ui/CtaCluster";

function categoryLabel(id: BlogPostSummary["category"]): string {
  return BLOG_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Card JR collection-style: ảnh + title + CtaCluster 2 pills — không khung card dày. */
export function BlogPostCard({ post }: { post: BlogPostSummary }) {
  const href = `/blog/${post.slug}`;

  return (
    <article className="group flex flex-col">
      <Link
        href={href}
        className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] bg-ink/5"
      >
        <Image
          src={post.coverImage}
          alt={post.coverAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </Link>

      <p className="mt-4 text-[11px] font-extrabold tracking-[0.12em] text-ink/55 uppercase">
        {categoryLabel(post.category)}
        {post.featured ? (
          <span className="ml-2 text-primary-deep">· Nổi bật</span>
        ) : null}
        {post.favorite ? (
          <span className="ml-2 text-primary-deep">· Yêu thích</span>
        ) : null}
      </p>

      <h2 className="mt-1.5 font-display text-[clamp(18px,1.6vw,22px)] font-bold leading-[1.15] tracking-[-0.03em] text-ink">
        <Link href={href} className="hover:text-primary-deep">
          {post.title}
        </Link>
      </h2>

      <div className="mt-4">
        <CtaCluster
          label="Đọc tiếp"
          href={href}
          size={44}
          fontSize={13}
          iconSize={18}
          labelPaddingX="1.25rem"
        />
      </div>
    </article>
  );
}
