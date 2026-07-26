"use client";

import { AdminBlogList } from "@/components/admin/blog/AdminBlogList";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminBlogPage() {
  return (
    <AdminPageFrame>
      <AdminBlogList />
    </AdminPageFrame>
  );
}
