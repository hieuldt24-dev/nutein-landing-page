"use client";

import { AccountProfileForm } from "@/components/account/AccountProfileForm";
import { AccountShell } from "@/components/account/AccountShell";

/**
 * /account — thông tin cá nhân.
 * Sổ địa chỉ nằm ở tab riêng `/account/addresses`.
 */
export default function AccountPage() {
  return (
    <AccountShell
      title="Hồ sơ của bạn"
      description="Cập nhật họ tên và số điện thoại để thanh toán nhanh hơn lần sau."
    >
      <AccountProfileForm />
    </AccountShell>
  );
}
