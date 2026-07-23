"use client";

import { AdminContactList } from "@/components/admin/contact/AdminContactList";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminContactPage() {
  return (
    <AdminPageFrame>
      <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
        Vận hành
      </p>
      <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
        Hộp thư Liên hệ
      </h1>
      <div className="mt-8">
        <AdminContactList />
      </div>
    </AdminPageFrame>
  );
}
