"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/useAuthStore";
import { notify } from "@/lib/toast";

/**
 * S2–S8 — chỉ Staff. Admin bị redirect về /admin (Tổng quan).
 * Không phải Staff/Admin (chưa đăng nhập hoặc role USER) → "/".
 */
export function StaffOnlyGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { role, isReady } = useAuthStore();
  const warned = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (role === "staff") return;
    if (!warned.current) {
      warned.current = true;
      if (role === "admin") {
        notify.error("Khu vực này dành cho Staff.");
      }
    }
    router.replace(role === "admin" ? "/admin" : "/");
  }, [isReady, role, router]);

  if (!isReady || role !== "staff") {
    return (
      <div className="flex min-h-[30vh] items-center justify-center px-6">
        <p className="text-sm font-semibold text-text-muted">Đang tải…</p>
      </div>
    );
  }

  return <>{children}</>;
}
