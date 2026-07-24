"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/useAuthStore";
import { notify } from "@/lib/toast";

/**
 * A1/A2 — chỉ Admin. Staff bị redirect về /staff (dashboard Staff).
 * Không phải Staff/Admin (chưa đăng nhập hoặc role USER) → "/".
 */
export function AdminOnlyGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { role, isReady } = useAuthStore();
  const warned = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (role === "admin") return;
    if (!warned.current) {
      warned.current = true;
      notify.error("Chỉ Admin mới truy cập được khu vực này.");
    }
    router.replace(role === "staff" ? "/staff" : "/");
  }, [isReady, role, router]);

  if (!isReady || role !== "admin") {
    return (
      <div className="flex min-h-[30vh] items-center justify-center px-6">
        <p className="text-sm font-semibold text-text-muted">Đang kiểm tra quyền Admin…</p>
      </div>
    );
  }

  return <>{children}</>;
}
