"use client";

import { AdminCouponsList } from "@/components/admin/coupons/AdminCouponsList";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminCouponsPage() {
  return (
    <AdminPageFrame>
      <AdminCouponsList />
    </AdminPageFrame>
  );
}
