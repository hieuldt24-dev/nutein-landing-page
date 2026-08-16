"use client";

import { AdminOrdersList } from "@/components/admin/orders/AdminOrdersList";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";

export default function AdminOrdersPage() {
  return (
    <AdminPageFrame>
      <AdminOrdersList />
    </AdminPageFrame>
  );
}
