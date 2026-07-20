"use client";

import { useSWRConfig } from "swr";
import { FillButton } from "@/components/ui/FillButton";

/**
 * Guest trên /account — CTA mở AuthModal.
 */
export function AccountAuthGate() {
  const { mutate } = useSWRConfig();

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-[480px] flex-col items-center justify-center px-6 pt-28 pb-16 text-center md:pt-32">
      <h1 className="font-display text-[clamp(26px,4vw,36px)] font-bold tracking-[-0.03em] text-ink">
        Đăng nhập để quản lý tài khoản
      </h1>
      <p className="mt-3 text-[15px] text-text-muted">
        Xem thông tin cá nhân, sổ địa chỉ và theo dõi đơn hàng của bạn.
      </p>
      <FillButton
        variant="ink"
        className="mt-6 px-7 py-3.5 text-base font-bold"
        onClick={() => mutate("auth-modal", true, { revalidate: false })}
      >
        Đăng nhập / Đăng ký
      </FillButton>
    </div>
  );
}
