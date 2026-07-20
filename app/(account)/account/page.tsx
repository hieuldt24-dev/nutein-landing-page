"use client";

import { AccountAddressList } from "@/components/account/AccountAddressList";
import { AccountProfileForm } from "@/components/account/AccountProfileForm";
import { AccountShell } from "@/components/account/AccountShell";

/**
 * /account — thông tin cá nhân + sổ địa chỉ nhận hàng.
 */
export default function AccountPage() {
  return (
    <AccountShell
      title="Hồ sơ của bạn"
      description="Cập nhật thông tin và địa chỉ để thanh toán nhanh hơn lần sau."
    >
      <div className="flex flex-col gap-6">
        <AccountProfileForm />
        <AccountAddressList />
      </div>
    </AccountShell>
  );
}
