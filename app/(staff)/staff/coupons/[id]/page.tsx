"use client";

import Link from "next/link";
import { use } from "react";
import { AdminCouponForm } from "@/components/admin/coupons/AdminCouponForm";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminCouponDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AdminPageFrame>
      <Link
        href="/staff/coupons"
        className="text-[13px] font-bold text-primary-deep underline-offset-2 hover:underline"
      >
        ← Danh sách coupon
      </Link>
      <h1 className="mt-2 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
        {id === "new" ? "Tạo coupon" : "Sửa coupon"}
      </h1>
      <div className="mt-8">
        <AdminCouponForm couponId={id} />
      </div>
    </AdminPageFrame>
  );
}
