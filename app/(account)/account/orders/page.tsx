"use client";

import { AccountOrderList } from "@/components/account/AccountOrderList";
import { AccountShell } from "@/components/account/AccountShell";

/**
 * /account/orders — lịch sử + trạng thái đơn (SWR → GET /api/account/orders).
 */
export default function AccountOrdersPage() {
  return (
    <AccountShell
      title="Đơn hàng"
      description="Theo dõi trạng thái: đang xử lý, đang giao, thành công."
    >
      <AccountOrderList />
    </AccountShell>
  );
}
