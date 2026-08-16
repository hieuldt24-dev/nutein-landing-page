import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BlogArticle } from "@/components/blog/BlogArticle";
import { BlogRelated } from "@/components/blog/BlogRelated";
import { blogService } from "@/features/blog/services/blog.service";
import { NotFoundError } from "@/src/errors/app.error";

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

// ISR — cache 1h, Staff sửa bài ở /staff/blog thấy ngay nhờ
// revalidatePath(`/blog/${slug}`) gọi trong PATCH app/api/staff/blog/[id]/route.ts.
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await blogService.listSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await blogService.getPostBySlug(slug);
    return {
      title: `${post.title} | Nutein`,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        locale: "vi_VN",
        type: "article",
        images: [{ url: post.coverImage, alt: post.coverAlt }],
      },
    };
  } catch {
    return { title: "Bài viết | Nutein" };
  }
}

/** Chi tiết bài viết — article + related. */
export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;

  let post;
  try {
    post = await blogService.getPostBySlug(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const related = await blogService.listRelated(slug, 4);

  return (
    <main className="bg-bg pt-32 md:pt-40">
      <div className="mx-auto max-w-[720px] px-6 pb-6 md:px-10">
        <Link
          href="/blog"
          className="text-[12px] font-extrabold tracking-[0.14em] text-ink/50 uppercase transition-colors hover:text-primary-deep"
        >
          ← Blog
        </Link>
      </div>

      <BlogArticle post={post} />
      <BlogRelated posts={related} />
    </main>
  );
}
