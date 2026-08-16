"use client";

import { AdminContactList } from "@/components/admin/contact/AdminContactList";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminContactPage() {
  return (
    <AdminPageFrame>
      <AdminContactList />
    </AdminPageFrame>
  );
}
