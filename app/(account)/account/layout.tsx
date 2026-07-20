"use client";

import { useEffect, useState } from "react";
import { AccountAuthGate } from "@/components/account/AccountAuthGate";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Guard account — guest thấy CTA đăng nhập; đã login render children.
 * Chờ mount để tránh flash gate khi session đọc từ localStorage.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
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
