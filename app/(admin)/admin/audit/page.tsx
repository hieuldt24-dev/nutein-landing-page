"use client";

import { AdminAuditPanel } from "@/components/admin/AdminAuditPanel";
import { AdminOnlyGate } from "@/components/admin/AdminOnlyGate";
import { AdminPageFrame } from "@/components/admin/AdminShell";

export default function AdminAuditPage() {
  return (
    <AdminPageFrame>
      <AdminOnlyGate>
        <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
          Hệ thống
        </p>
        <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
          Nhật ký hệ thống
        </h1>
        <div className="mt-8">
          <AdminAuditPanel />
        </div>
      </AdminOnlyGate>
    </AdminPageFrame>
  );
}
