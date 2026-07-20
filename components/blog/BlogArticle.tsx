import Image from "next/image";
import Link from "next/link";
import { BLOG_CATEGORIES } from "@/features/blog/constants";
import type { BlogPost } from "@/features/blog/types";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function categoryLabel(id: BlogPost["category"]): string {
  return BLOG_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Reading layout — meta + title + cover + body HTML (mock tin cậy). */
export function BlogArticle({ post }: { post: BlogPost }) {
  return (
    <article className="mx-auto max-w-[720px] px-6 md:px-10">
      <p className="text-[12px] font-extrabold tracking-[0.12em] text-ink/55 uppercase">
        <Link href={`/blog?category=${post.category}`} className="hover:text-primary-deep">
          {categoryLabel(post.category)}
        </Link>
        <span className="mx-2 text-ink/30">·</span>
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        <span className="mx-2 text-ink/30">·</span>
        {post.readingMinutes} phút đọc
      </p>

      <h1 className="mt-4 font-display text-[clamp(32px,5vw,52px)] font-black uppercase leading-[1.02] tracking-[-0.04em] text-ink">
        {post.title}
      </h1>

      <p className="mt-4 text-base leading-relaxed text-ink/70 md:text-lg">
        {post.excerpt}
      </p>

      <div className="relative mt-8 aspect-[16/10] overflow-hidden rounded-[var(--radius-xl)] bg-ink/5">
        <Image
          src={post.coverImage}
          alt={post.coverAlt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-cover"
        />
      </div>

      <div
        className="blog-prose mt-10 text-[15px] leading-[1.7] text-ink md:text-base"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
      />
    </article>
  );
}
