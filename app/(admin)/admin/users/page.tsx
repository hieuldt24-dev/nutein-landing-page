"use client";

import { AdminPageFrame } from "@/components/admin/shell/AdminShell";
import { AdminUsersPanel } from "@/components/admin/users/AdminUsersPanel";

export default function AdminUsersPage() {
  return (
    <AdminPageFrame>
      <AdminUsersPanel />
    </AdminPageFrame>
  );
}
