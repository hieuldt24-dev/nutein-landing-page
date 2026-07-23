"use client";

import { AdminContentEditor } from "@/components/admin/content/AdminContentEditor";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminContentPage() {
  return (
    <AdminPageFrame>
      <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
        Nội dung
      </p>
      <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
        Nội dung tĩnh
      </h1>
      <div className="mt-8">
        <AdminContentEditor />
      </div>
    </AdminPageFrame>
  );
}
