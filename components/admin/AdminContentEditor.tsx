"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import {
  ADMIN_CONTENT_SWR_KEY,
  ADMIN_STATIC_PAGE_META,
  adminContentPageSwrKey,
} from "@/features/admin-content/constants";
import { adminContentService } from "@/features/admin-content/services/admin-content.service";
import type { AdminStaticSlug } from "@/features/admin-content/types";
import { notify } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { useSWRConfig } from "swr";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium";

export function AdminContentEditor() {
  const [slug, setSlug] = useState<AdminStaticSlug>("privacy");
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(
    adminContentPageSwrKey(slug),
    () => adminContentService.getPage(slug),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setContent(data.content);
  }, [data]);

  const save = async () => {
    setIsSubmitting(true);
    try {
      const saved = await adminContentService.updatePage(slug, { title, content });
      await mutate(saved, { revalidate: false });
      await globalMutate(ADMIN_CONTENT_SWR_KEY);
      notify.success("Đã lưu nội dung.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {ADMIN_STATIC_PAGE_META.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => setSlug(item.slug)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold ${
              slug === item.slug ? "bg-ink text-bg" : "bg-ink/5 text-ink/70"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
      ) : null}
      {error || (!isLoading && !data) ? (
        <p className="text-sm font-semibold text-red-700">Không tải được trang.</p>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
          <p className="text-[13px] text-text-muted">
            Cập nhật {formatDate(data.updatedAt, { hour: "2-digit", minute: "2-digit" })} ·
            Public pages gắn sau khi có route.
          </p>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Tiêu đề
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Nội dung
            <textarea
              className={inputClass}
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void save()}
            className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu
          </button>
        </div>
      ) : null}
    </div>
  );
}
