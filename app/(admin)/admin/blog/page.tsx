"use client";

import { AdminBlogList } from "@/components/admin/AdminBlogList";
import { AdminPageFrame } from "@/components/admin/AdminShell";
import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";

export default function AdminBlogPage() {
  return (
    <AdminPageFrame>
      <StaffOnlyGate>
        <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
          Nội dung
        </p>
        <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
          Blog CMS
        </h1>
        <p className="mt-2 text-[14px] text-text-muted">
          Storefront vẫn dùng mock posts riêng cho đến khi gắn API chung.
        </p>
        <div className="mt-8">
          <AdminBlogList />
        </div>
      </StaffOnlyGate>
    </AdminPageFrame>
  );
}
