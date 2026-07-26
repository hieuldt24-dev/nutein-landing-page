"use client";

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
      <AdminCouponForm couponId={id} />
    </AdminPageFrame>
  );
}
