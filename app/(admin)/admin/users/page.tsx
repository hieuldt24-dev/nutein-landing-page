"use client";

import { AdminPageFrame } from "@/components/admin/AdminShell";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";

export default function AdminUsersPage() {
  return (
    <AdminPageFrame>
      <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
        Hệ thống
      </p>
      <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
        Quản lý người dùng
      </h1>
      <div className="mt-8">
        <AdminUsersPanel />
      </div>
    </AdminPageFrame>
  );
}
