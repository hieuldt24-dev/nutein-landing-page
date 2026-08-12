import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyPageView } from "@/components/policies/PolicyPageView";
import { policyService } from "@/features/policies/services/policy.service";
import { isPolicySlug } from "@/features/policies/types";

interface PolicyPageProps {
  params: Promise<{ slug: string }>;
}

// ISR — cache 1h, Staff sửa ở /staff/content thấy ngay nhờ
// revalidatePath(`/policies/${slug}`) gọi trong PATCH app/api/staff/content/[slug]/route.ts.
export const revalidate = 3600;

export async function generateStaticParams() {
  return policyService.listSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await policyService.getBySlug(slug);
  if (!page) {
    return { title: "Không tìm thấy | Nutein" };
  }
  return {
    title: `${page.title} | Nutein`,
    description: page.content.slice(0, 140).replace(/\n/g, " "),
    openGraph: {
      title: `${page.title} | Nutein`,
      locale: "vi_VN",
      type: "website",
    },
  };
}

/**
 * Trang chính sách động `/policies/[slug]` — data qua policyService (mock → API sau).
 */
export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  if (!isPolicySlug(slug)) notFound();

  const page = await policyService.getBySlug(slug);
  if (!page) notFound();

  return <PolicyPageView page={page} />;
}
