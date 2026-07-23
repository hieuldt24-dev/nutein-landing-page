"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboardSummary } from "@/components/admin/AdminDashboardSummary";
import { AdminPageFrame } from "@/components/admin/AdminShell";
import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";
import { FillButton } from "@/components/ui/FillButton";
import { useAuthStore } from "@/lib/useAuthStore";

/** /admin — S2 Dashboard (Staff). Admin → /admin/users. */
export default function AdminHomePage() {
  const router = useRouter();
  const { user, role, isReady } = useAuthStore();

  useEffect(() => {
    if (!isReady) return;
    if (role === "admin") {
      router.replace("/admin/users");
    }
  }, [isReady, role, router]);

  if (!isReady || role === "admin") {
    return (
      <AdminPageFrame>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm font-semibold text-text-muted">Đang chuyển hướng…</p>
        </div>
      </AdminPageFrame>
    );
  }

  return (
    <AdminPageFrame>
      <StaffOnlyGate>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
              Vận hành
            </p>
            <h1 className="mt-1 font-display text-[clamp(28px,3.5vw,36px)] font-bold tracking-[-0.03em] text-ink">
              Tổng quan
            </h1>
            <p className="mt-1 max-w-[520px] text-[14px] text-text-muted">
              Nắm nhanh đơn hàng, liên hệ và tồn kho.
            </p>
          </div>
          <FillButton
            href="/admin/orders"
            variant="ink-solid"
            className="mt-3 h-11 shrink-0 px-5 text-[13px] font-bold sm:mt-0"
          >
            Quản lý đơn hàng
          </FillButton>
        </div>

        <section className="mt-6 rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
            <div className="flex flex-wrap items-baseline gap-2">
              <dt className="font-bold text-text-muted">Email</dt>
              <dd className="font-semibold text-ink">{user?.email ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="font-bold text-text-muted">Vai trò</dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-extrabold tracking-[0.04em] text-primary-deep uppercase">
                  Staff
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">
            Chỉ số hôm nay
          </h2>
          <AdminDashboardSummary />
        </section>
      </StaffOnlyGate>
    </AdminPageFrame>
  );
}
