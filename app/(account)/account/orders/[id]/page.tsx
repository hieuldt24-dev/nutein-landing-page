"use client";

import { use } from "react";
import { AccountOrderDetail } from "@/components/account/AccountOrderDetail";
import { AccountShell } from "@/components/account/AccountShell";

/**
 * /account/orders/[id] — chi tiết một đơn của chính khách.
 * Dữ liệu fetch client-side theo JWT app (GET /api/account/orders/[id],
 * no-store) — không render trạng thái thanh toán trên server để tránh cache.
 */
export default function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AccountShell
      title="Chi tiết đơn"
      description="Trạng thái thanh toán và thao tác cho đơn của bạn."
    >
      <AccountOrderDetail orderId={id} />
    </AccountShell>
  );
}
