"use client";

import { AccountAddressList } from "@/components/account/AccountAddressList";
import { AccountShell } from "@/components/account/AccountShell";

/**
 * /account/addresses — sổ địa chỉ nhận hàng (tách khỏi hồ sơ để giảm scroll).
 */
export default function AccountAddressesPage() {
  return (
    <AccountShell
      title="Sổ địa chỉ"
      description="Địa chỉ mặc định sẽ được điền sẵn ở trang thanh toán."
    >
      <AccountAddressList />
    </AccountShell>
  );
}
