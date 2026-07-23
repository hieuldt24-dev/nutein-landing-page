"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ADMIN_BLOG_SWR_KEY } from "@/features/admin-blog/constants";
import { adminBlogService } from "@/features/admin-blog/services/admin-blog.service";
import type { AdminBlogStatus } from "@/features/admin-blog/types";
import type { BlogCategoryId } from "@/features/blog/types";
import { formatDate } from "@/lib/utils";

export function AdminBlogList() {
  const [category, setCategory] = useState<BlogCategoryId | "all">("all");
  const [status, setStatus] = useState<AdminBlogStatus | "all">("all");
  const key = useMemo(
    () => `${ADMIN_BLOG_SWR_KEY}:${category}:${status}`,
    [category, status]
  );
  const { data, error, isLoading } = useSWR(
    key,
    () => adminBlogService.list({ category, status }),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-bold">
            Chuyên mục
            <select
              className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value as BlogCategoryId | "all")}
            >
              <option value="all">Tất cả</option>
              <option value="recipes">Công thức</option>
              <option value="protein">Protein</option>
              <option value="lifestyle">Lifestyle</option>
              <option value="nutrition">Dinh dưỡng</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-bold">
            Trạng thái
            <select
              className="rounded-[var(--radius-md)] border border-ink/20 bg-surface px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as AdminBlogStatus | "all")}
            >
              <option value="all">Tất cả</option>
              <option value="published">Xuất bản</option>
              <option value="draft">Nháp</option>
            </select>
          </label>
        </div>
        <Link
          href="/staff/blog/new"
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-bg"
        >
          Bài mới
        </Link>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-red-700">Không tải được bài.</p>
      ) : null}
      {data ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((p) => (
            <li key={p.id}>
              <Link
                href={`/staff/blog/${p.id}`}
                className="block rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-4 py-4 hover:border-ink/30"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-bold text-ink">{p.title}</p>
                  <span className="text-[11px] font-extrabold uppercase text-text-muted">
                    {p.status === "published" ? "Xuất bản" : "Nháp"}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-text-muted">
                  {p.category} · {formatDate(p.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
