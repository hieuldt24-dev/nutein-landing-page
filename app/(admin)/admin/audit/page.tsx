"use client";

import { AdminAuditPanel } from "@/components/admin/audit/AdminAuditPanel";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminAuditPage() {
  return (
    <AdminPageFrame>
      <AdminAuditPanel />
    </AdminPageFrame>
  );
}
