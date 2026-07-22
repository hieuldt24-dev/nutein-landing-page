"use client";

import Link from "next/link";
import { use } from "react";
import { AdminBlogEditor } from "@/components/admin/AdminBlogEditor";
import { AdminPageFrame } from "@/components/admin/AdminShell";
import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";

export default function AdminBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AdminPageFrame>
      <StaffOnlyGate>
        <Link
          href="/admin/blog"
          className="text-[13px] font-bold text-primary-deep underline-offset-2 hover:underline"
        >
          ← Danh sách bài
        </Link>
        <h1 className="mt-2 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
          {id === "new" ? "Bài mới" : "Sửa bài"}
        </h1>
        <div className="mt-8">
          <AdminBlogEditor postId={id} />
        </div>
      </StaffOnlyGate>
    </AdminPageFrame>
  );
}
