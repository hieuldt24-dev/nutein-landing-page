"use client";

import { AccountAuthGate } from "@/components/account/AccountAuthGate";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Guard account — guest thấy CTA đăng nhập; đã login render children.
 * Chờ `isReady` (AuthProvider đã xác định xong session Supabase thật) chứ
 * KHÔNG chờ "đã mount" (1 tick sau mount) — session đọc cookie có độ trễ
 * mạng, còn effect mount thì luôn chạy ngay; nếu chỉ chờ mount, guard chốt
 * isLoggedIn=false (giá trị mặc định) trước khi AuthProvider kịp resolve
 * session, gây chập chờn hiện/mất trạng thái đăng nhập ngẫu nhiên mỗi lần
 * F5 (bug thật đã gặp — xem components/providers/AuthProvider.tsx).
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, isReady } = useAuthStore();

  if (!isReady) {
    return (
      <div className="mx-auto max-w-[960px] px-6 pt-28 pb-16 md:pt-32">
        <div className="h-10 w-48 animate-pulse rounded-md bg-ink/5" />
        <div className="mt-6 h-40 animate-pulse rounded-[var(--radius-lg)] bg-ink/5" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AccountAuthGate />;
  }

  return children;
}
