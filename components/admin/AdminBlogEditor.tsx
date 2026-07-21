"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";
import {
  ADMIN_BLOG_SWR_KEY,
  adminBlogDetailSwrKey,
} from "@/features/admin-blog/constants";
import { adminBlogService } from "@/features/admin-blog/services/admin-blog.service";
import type { AdminBlogStatus } from "@/features/admin-blog/types";
import type { BlogCategoryId } from "@/features/blog/types";
import { notify } from "@/lib/toast";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium";

export function AdminBlogEditor({ postId }: { postId: string | "new" }) {
  const isNew = postId === "new";
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    isNew ? null : adminBlogDetailSwrKey(postId),
    () => adminBlogService.getById(postId),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<BlogCategoryId>("protein");
  const [coverImage, setCoverImage] = useState("/images/example.jpg");
  const [coverAlt, setCoverAlt] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [status, setStatus] = useState<AdminBlogStatus>("draft");
  const [readingMinutes, setReadingMinutes] = useState(5);
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setSlug(data.slug);
    setExcerpt(data.excerpt);
    setCategory(data.category);
    setCoverImage(data.coverImage);
    setCoverAlt(data.coverAlt);
    setBodyHtml(data.bodyHtml);
    setStatus(data.status);
    setReadingMinutes(data.readingMinutes);
    setTags((data.tags ?? []).join(", "));
  }, [data]);

  if (!isNew && isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
    );
  }
  if (!isNew && (error || !data)) {
    return <p className="text-sm font-semibold text-red-700">Không tìm thấy bài.</p>;
  }

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        title,
        slug,
        excerpt,
        category,
        coverImage,
        coverAlt,
        bodyHtml,
        status,
        publishedAt:
          status === "published"
            ? data?.publishedAt ?? new Date().toISOString().slice(0, 10)
            : null,
        readingMinutes,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        recipeFilters: data?.recipeFilters,
      };
      if (isNew) {
        const created = await adminBlogService.create(payload);
        await globalMutate(
          (key) => typeof key === "string" && key.startsWith(ADMIN_BLOG_SWR_KEY),
          undefined,
          { revalidate: true }
        );
        notify.success("Đã tạo bài.");
        router.replace(`/admin/blog/${created.id}`);
      } else {
        await adminBlogService.update(postId, payload);
        await globalMutate(adminBlogDetailSwrKey(postId));
        await globalMutate(
          (key) => typeof key === "string" && key.startsWith(ADMIN_BLOG_SWR_KEY),
          undefined,
          { revalidate: true }
        );
        notify.success("Đã lưu bài.");
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Tiêu đề
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Slug
        <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Excerpt
        <textarea
          className={inputClass}
          rows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
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
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Trạng thái
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminBlogStatus)}
          >
            <option value="draft">Nháp</option>
            <option value="published">Xuất bản</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Cover URL
        <input
          className={inputClass}
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Cover alt
        <input
          className={inputClass}
          value={coverAlt}
          onChange={(e) => setCoverAlt(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Body (HTML/Markdown plain)
        <textarea
          className={inputClass}
          rows={8}
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Tags (phẩy)
        <input className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Phút đọc
        <input
          type="number"
          min={1}
          className={inputClass}
          value={readingMinutes}
          onChange={(e) => setReadingMinutes(Number(e.target.value))}
        />
      </label>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void submit()}
        className="mt-2 inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Lưu
      </button>
    </div>
  );
}
