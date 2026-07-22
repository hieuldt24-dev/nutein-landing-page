"use client";

import { AdminOrdersList } from "@/components/admin/AdminOrdersList";
import { AdminPageFrame } from "@/components/admin/AdminShell";
import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";

export default function AdminOrdersPage() {
  return (
    <AdminPageFrame>
      <StaffOnlyGate>
        <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
          Vận hành
        </p>
        <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
          Quản lý đơn hàng
        </h1>
        <p className="mt-2 max-w-[560px] text-[14px] text-text-muted">
          Lọc theo trạng thái / ngày, mở chi tiết để chuyển trạng thái.
        </p>
        <div className="mt-8">
          <AdminOrdersList />
        </div>
      </StaffOnlyGate>
    </AdminPageFrame>
  );
}
