"use client";

import { use } from "react";
import { AdminBlogEditor } from "@/components/admin/blog/AdminBlogEditor";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AdminPageFrame>
      <AdminBlogEditor postId={id} />
    </AdminPageFrame>
  );
}
