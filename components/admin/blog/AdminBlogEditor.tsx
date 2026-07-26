"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";
import { AdminBackLink } from "@/components/admin/ui/AdminBackLink";
import { FillButton } from "@/components/ui/FillButton";
import { adminBlogDetailSwrKey } from "@/features/admin-blog/constants";
import { adminBlogService } from "@/features/admin-blog/services/admin-blog.service";
import type { AdminBlogStatus } from "@/features/admin-blog/types";
import type { BlogCategoryId } from "@/features/blog/types";
import { revalidateAfterBlogMutation } from "@/lib/admin-swr-revalidate";
import { notify } from "@/lib/toast";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-[14px] border border-ink/20 bg-bg px-3.5 py-2.5 text-[14px] font-medium text-ink";

const EMPTY_SNAPSHOT = JSON.stringify({
  title: "",
  slug: "",
  excerpt: "",
  category: "protein",
  coverImage: "",
  coverAlt: "",
  bodyHtml: "",
  status: "draft",
  readingMinutes: 5,
  featured: false,
  favorite: false,
  tags: "",
});

function blogSnapshot(fields: {
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategoryId;
  coverImage: string;
  coverAlt: string;
  bodyHtml: string;
  status: AdminBlogStatus;
  readingMinutes: number;
  featured: boolean;
  favorite: boolean;
  tags: string;
}): string {
  return JSON.stringify(fields);
}

export function AdminBlogEditor({ postId }: { postId: string | "new" }) {
  const isNew = postId === "new";
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    isNew ? null : adminBlogDetailSwrKey(postId),
    () => adminBlogService.getById(postId),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<BlogCategoryId>("protein");
  const [coverImage, setCoverImage] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [status, setStatus] = useState<AdminBlogStatus>("draft");
  const [readingMinutes, setReadingMinutes] = useState(5);
  const [featured, setFeatured] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [baseline, setBaseline] = useState(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!data) return;
    const next = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      category: data.category,
      coverImage: data.coverImage,
      coverAlt: data.coverAlt,
      bodyHtml: data.bodyHtml,
      status: data.status,
      readingMinutes: data.readingMinutes,
      featured: data.featured ?? false,
      favorite: data.favorite ?? false,
      tags: (data.tags ?? []).join(", "),
    };
    setTitle(next.title);
    setSlug(next.slug);
    setExcerpt(next.excerpt);
    setCategory(next.category);
    setCoverImage(next.coverImage);
    setCoverAlt(next.coverAlt);
    setBodyHtml(next.bodyHtml);
    setStatus(next.status);
    setReadingMinutes(next.readingMinutes);
    setFeatured(next.featured);
    setFavorite(next.favorite);
    setTags(next.tags);
    setBaseline(blogSnapshot(next));
  }, [data]);

  const currentSnapshot = blogSnapshot({
    title,
    slug,
    excerpt,
    category,
    coverImage,
    coverAlt,
    bodyHtml,
    status,
    readingMinutes,
    featured,
    favorite,
    tags,
  });
  const dirty = !isSubmitting && currentSnapshot !== baseline;
  const { dialog: leaveDialog } = useUnsavedChangesGuard(dirty);

  const buildPayload = (nextStatus: AdminBlogStatus) => ({
    title,
    slug,
    excerpt,
    category,
    coverImage,
    coverAlt,
    bodyHtml: bodyHtml || "<p></p>",
    status: nextStatus,
    publishedAt:
      nextStatus === "published"
        ? (data?.publishedAt ?? new Date().toISOString().slice(0, 10))
        : null,
    readingMinutes,
    featured,
    favorite,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    recipeFilters: data?.recipeFilters,
  });

  const submit = async (nextStatus: AdminBlogStatus) => {
    setIsSubmitting(true);
    setStatus(nextStatus);
    try {
      const payload = buildPayload(nextStatus);
      if (isNew) {
        const created = await adminBlogService.create(payload);
        await revalidateAfterBlogMutation(globalMutate);
        setBaseline(
          blogSnapshot({
            title,
            slug,
            excerpt,
            category,
            coverImage,
            coverAlt,
            bodyHtml,
            status: nextStatus,
            readingMinutes,
            featured,
            favorite,
            tags,
          }),
        );
        notify.success(
          nextStatus === "published" ? "Đã xuất bản bài." : "Đã lưu nháp.",
        );
        router.replace(`/staff/blog/${created.id}`);
      } else {
        await adminBlogService.update(postId, payload);
        await globalMutate(adminBlogDetailSwrKey(postId));
        await revalidateAfterBlogMutation(globalMutate);
        setBaseline(
          blogSnapshot({
            title,
            slug,
            excerpt,
            category,
            coverImage,
            coverAlt,
            bodyHtml,
            status: nextStatus,
            readingMinutes,
            featured,
            favorite,
            tags,
          }),
        );
        notify.success(
          nextStatus === "published" ? "Đã xuất bản bài." : "Đã lưu nháp.",
        );
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-[20px] bg-border-subtle" />
    );
  }
  if (!isNew && (error || !data)) {
    return (
      <p className="text-sm font-semibold text-red-700">Không tìm thấy bài.</p>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      {leaveDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminBackLink href="/staff/blog">Blog</AdminBackLink>
        <div className="flex flex-wrap gap-2">
          <FillButton
            type="button"
            variant="ink"
            disabled={isSubmitting}
            onClick={() => void submit("draft")}
            className="h-10 px-5 text-[13px] font-bold"
          >
            {isSubmitting && status === "draft" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Lưu nháp
          </FillButton>
          <FillButton
            type="button"
            variant="ink-solid"
            disabled={isSubmitting}
            onClick={() => void submit("published")}
            className="h-10 px-5 text-[13px] font-bold"
          >
            {isSubmitting && status === "published" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Xuất bản
          </FillButton>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4 rounded-[20px] border border-ink/10 bg-surface px-5 py-5 shadow-sm md:px-6">
          <input
            className="w-full border-0 bg-transparent font-display text-[clamp(24px,4vw,30px)] font-bold tracking-[-0.03em] text-ink outline-none placeholder:text-text-faint"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề bài viết…"
          />
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Tóm tắt
            <textarea
              className={inputClass}
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Một–hai câu dẫn khách vào bài…"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Nội dung
            <textarea
              className={cn(inputClass, "min-h-[280px] leading-relaxed")}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Viết nội dung bài…"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Đường dẫn (slug)
            <input
              className={inputClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Thẻ
            <input
              className={inputClass}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="VD: protein, công thức"
            />
          </label>
        </div>

        <aside className="flex flex-col gap-4 rounded-[20px] border border-ink/10 bg-surface px-5 py-5 shadow-sm">
          <div>
            <p className="mb-1.5 text-[12.5px] font-bold text-ink">Trạng thái</p>
            <div className="flex gap-1.5">
              {(
                [
                  ["draft", "Nháp"],
                  ["published", "Xuất bản"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={cn(
                    "h-9 flex-1 cursor-pointer rounded-full text-[12.5px] font-bold",
                    status === value
                      ? "bg-ink text-bg"
                      : "border border-ink/15 text-text-body",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink">
            Chuyên mục
            <select
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value as BlogCategoryId)}
            >
              <option value="recipes">Công thức</option>
              <option value="protein">Protein</option>
              <option value="lifestyle">Lifestyle</option>
              <option value="nutrition">Dinh dưỡng</option>
            </select>
          </label>

          <div>
            <p className="mb-1.5 text-[12.5px] font-bold text-ink">Ảnh bìa</p>
            <div className="relative aspect-video overflow-hidden rounded-[14px] bg-primary-soft">
              {coverImage ? (
                <Image
                  src={coverImage}
                  alt={coverAlt || "Ảnh bìa"}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-[12px] font-semibold text-primary-deep">
                  Chưa có ảnh
                </span>
              )}
            </div>
            <label className="mt-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-ink/20 px-4 text-[12.5px] font-bold text-ink hover:bg-ink/[0.04]">
              {uploadingCover ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {coverImage ? "Đổi ảnh" : "Chọn ảnh"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingCover}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploadingCover(true);
                  void adminBlogService
                    .uploadImage(file)
                    .then((url) => {
                      setCoverImage(url);
                      notify.success("Đã tải ảnh bìa lên.");
                    })
                    .catch((err) => {
                      notify.error(
                        err instanceof Error
                          ? err.message
                          : "Tải ảnh lên thất bại.",
                      );
                    })
                    .finally(() => setUploadingCover(false));
                }}
              />
            </label>
            <input
              className={cn(inputClass, "mt-2")}
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="Hoặc dán link ảnh"
            />
            <input
              className={cn(inputClass, "mt-2")}
              value={coverAlt}
              onChange={(e) => setCoverAlt(e.target.value)}
              placeholder="Mô tả ảnh"
            />
          </div>

          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-ink">
            Phút đọc
            <input
              type="number"
              min={1}
              className={inputClass}
              value={readingMinutes}
              onChange={(e) => setReadingMinutes(Number(e.target.value))}
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            Bài nổi bật
          </label>
          <label className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
            />
            Công thức yêu thích
          </label>
        </aside>
      </div>
    </div>
  );
}
