"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/features/auth/services/auth.service";
import { useAuthStore } from "@/lib/useAuthStore";
import { notify } from "@/lib/toast";

/**
 * Client gate — phase 0: chờ AuthProvider (`isReady`) rồi kiểm tra role.
 * Production thật: bổ sung middleware + cookie (xem docs/admin-portal-roadmap.md).
 */
export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoggedIn, isReady } = useAuthStore();
  const [allowed, setAllowed] = useState(false);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (!isReady) {
      setAllowed(false);
      return;
    }

    if (authService.canAccessAdmin(user)) {
      deniedRef.current = false;
      setAllowed(true);
      return;
    }

    setAllowed(false);
    if (!deniedRef.current) {
      deniedRef.current = true;
      if (!isLoggedIn || (user && !authService.canAccessAdmin(user))) {
        notify.error("Bạn không có quyền truy cập khu vực quản trị.");
      }
      router.replace("/");
    }
  }, [isLoggedIn, isReady, router, user]);

  if (!isReady || !allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm font-semibold text-text-muted">Đang kiểm tra quyền…</p>
      </div>
    );
  }

  return <>{children}</>;
}
