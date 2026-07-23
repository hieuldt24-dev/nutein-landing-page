"use client";

import { AdminPageFrame } from "@/components/admin/AdminShell";
import { AdminProductEditor } from "@/components/admin/AdminProductEditor";
import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";

export default function AdminProductsPage() {
  return (
    <AdminPageFrame>
      <StaffOnlyGate>
        <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
          Vận hành
        </p>
        <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
          Quản lý sản phẩm
        </h1>
        <p className="mt-2 max-w-[560px] text-[14px] text-text-muted">
          Single-SKU Nutein + biến thể gói, giá và tồn kho.
        </p>
        <div className="mt-8">
          <AdminProductEditor />
        </div>
      </StaffOnlyGate>
    </AdminPageFrame>
  );
}
