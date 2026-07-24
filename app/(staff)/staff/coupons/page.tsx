"use client";

import { AdminCouponsList } from "@/components/admin/coupons/AdminCouponsList";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminCouponsPage() {
  return (
    <AdminPageFrame>
      <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
        Nội dung
      </p>
      <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
        Mã giảm giá
      </h1>
      <div className="mt-8">
        <AdminCouponsList />
      </div>
    </AdminPageFrame>
  );
}
