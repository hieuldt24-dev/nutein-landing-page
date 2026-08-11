"use client";

import { AdminPageFrame } from "@/components/admin/shell/AdminShell";
import { AdminProductEditor } from "@/components/admin/products/AdminProductEditor";

export default function AdminProductsPage() {
  return (
    <AdminPageFrame>
      <AdminProductEditor />
    </AdminPageFrame>
  );
}
