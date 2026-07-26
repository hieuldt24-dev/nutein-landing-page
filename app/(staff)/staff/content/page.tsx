"use client";

import { AdminContentEditor } from "@/components/admin/content/AdminContentEditor";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminContentPage() {
  return (
    <AdminPageFrame>
      <AdminContentEditor />
    </AdminPageFrame>
  );
}
