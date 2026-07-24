"use client";

import { use } from "react";
import { AdminOrderDetail } from "@/components/admin/orders/AdminOrderDetail";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AdminPageFrame>
      <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
        Vận hành
      </p>
      <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
        Chi tiết đơn
      </h1>
      <div className="mt-8">
        <AdminOrderDetail orderId={id} />
      </div>
    </AdminPageFrame>
  );
}
