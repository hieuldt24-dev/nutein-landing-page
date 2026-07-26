"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { FillButton } from "@/components/ui/FillButton";
import { ADMIN_BLOG_SWR_KEY } from "@/features/admin-blog/constants";
import { adminBlogService } from "@/features/admin-blog/services/admin-blog.service";
import type { AdminBlogStatus } from "@/features/admin-blog/types";
import type { BlogCategoryId } from "@/features/blog/types";
import { cn, formatDate } from "@/lib/utils";

const CATEGORIES: { value: BlogCategoryId | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "recipes", label: "Công thức" },
  { value: "protein", label: "Protein" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "nutrition", label: "Dinh dưỡng" },
];

const STATUSES: { value: AdminBlogStatus | "all"; label: string }[] = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "published", label: "Xuất bản" },
  { value: "draft", label: "Nháp" },
];

const CATEGORY_LABEL: Record<BlogCategoryId, string> = {
  recipes: "Công thức",
  protein: "Protein",
  lifestyle: "Lifestyle",
  nutrition: "Dinh dưỡng",
};

export function AdminBlogList() {
  const [category, setCategory] = useState<BlogCategoryId | "all">("all");
  const [status, setStatus] = useState<AdminBlogStatus | "all">("all");
  const key = useMemo(
    () => `${ADMIN_BLOG_SWR_KEY}:${category}:${status}`,
    [category, status],
  );
  const { data, error, isLoading } = useSWR(
    key,
    () => adminBlogService.list({ category, status }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const { data: allPosts } = useSWR(
    `${ADMIN_BLOG_SWR_KEY}:counts`,
    () => adminBlogService.list({ category: "all", status: "all" }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const draftCount = allPosts?.filter((p) => p.status === "draft").length ?? 0;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
          Blog
        </h1>
        <FillButton
          href="/staff/blog/new"
          variant="ink-solid"
          className="h-11 w-full px-5 text-[13px] font-bold sm:w-auto"
        >
          Viết bài
        </FillButton>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((opt) => (
          <AdminFilterChip
            key={opt.value}
            active={category === opt.value}
            onClick={() => setCategory(opt.value)}
          >
            {opt.label}
          </AdminFilterChip>
        ))}
        {STATUSES.filter((s) => s.value !== "all").map((opt) => (
          <AdminFilterChip
            key={opt.value}
            active={status === opt.value}
            onClick={() =>
              setStatus(status === opt.value ? "all" : opt.value)
            }
          >
            {opt.label}
            {opt.value === "draft" && draftCount > 0 ? ` · ${draftCount}` : ""}
          </AdminFilterChip>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[20px] border border-ink/10 bg-border-subtle" />
      ) : null}
      {error ? (
        <p className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được bài viết.
        </p>
      ) : null}
      {!isLoading && !error && data && data.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-text-muted">
          Chưa có bài nào.
        </p>
      ) : null}
      {data && data.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((p) => (
            <li key={p.id}>
              <Link
                href={`/staff/blog/${p.id}`}
                className="flex items-center gap-4 rounded-[20px] border border-ink/15 bg-surface px-4 py-4 transition-colors hover:border-ink/30 hover:bg-ink/[0.02] md:px-5"
              >
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[12px] bg-primary-soft">
                  {p.coverImage ? (
                    <Image
                      src={p.coverImage}
                      alt={p.coverAlt || p.title}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-[11px] font-semibold text-text-muted">
                      Không ảnh
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{p.title}</p>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.04em] uppercase",
                        p.status === "published"
                          ? "bg-lime/50 text-forest"
                          : "bg-ink/10 text-text-muted",
                      )}
                    >
                      {p.status === "published" ? "Xuất bản" : "Nháp"}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {CATEGORY_LABEL[p.category] ?? p.category} ·{" "}
                    {formatDate(p.updatedAt)}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-text-faint"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
