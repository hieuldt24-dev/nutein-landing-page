"use client";

import { AdminDashboardSummary } from "@/components/admin/dashboard/AdminDashboardSummary";
import { DashboardAttentionList } from "@/components/admin/dashboard/DashboardAttentionList";
import { DashboardRevenuePanel } from "@/components/admin/dashboard/DashboardRevenuePanel";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";
import { FillButton } from "@/components/ui/FillButton";

/** /staff — S2 Dashboard: 1 chart doanh thu + vận hành + cần chú ý. */
export default function StaffHomePage() {
  return (
    <AdminPageFrame>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
            Tổng quan
          </h1>
        </div>
        <FillButton
          href="/staff/orders"
          variant="ink-solid"
          className="h-11 w-full shrink-0 px-[22px] text-[13px] font-bold sm:w-auto"
        >
          Quản lý đơn hàng
        </FillButton>
      </div>

      <section className="mt-6 sm:mt-7">
        <DashboardRevenuePanel />
      </section>

      <section className="mt-7 sm:mt-8">
        <h2 className="mb-3 font-display text-lg font-bold tracking-[-0.02em] text-ink">
          Vận hành
        </h2>
        <AdminDashboardSummary />
      </section>

      <section className="mt-7 sm:mt-8">
        <h2 className="mb-3 font-display text-lg font-bold tracking-[-0.02em] text-ink">
          Cần chú ý
        </h2>
        <DashboardAttentionList />
      </section>
    </AdminPageFrame>
  );
}
