"use client";

import { AdminDashboardSummary } from "@/components/admin/dashboard/AdminDashboardSummary";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";
import { DashboardOrderStatusPanel } from "@/components/admin/dashboard/DashboardOrderStatusPanel";
import { DashboardOrdersByDayPanel } from "@/components/admin/dashboard/DashboardOrdersByDayPanel";
import { DashboardRevenuePanel } from "@/components/admin/dashboard/DashboardRevenuePanel";
import { FillButton } from "@/components/ui/FillButton";

/** /staff — S2 Dashboard (Staff): doanh thu chính + vận hành phụ. */
export default function StaffHomePage() {
  return (
    <AdminPageFrame>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(26px,6vw,36px)] font-bold tracking-[-0.03em] text-ink">
            Tổng quan
          </h1>
        </div>
        <FillButton
          href="/staff/orders"
          variant="ink-solid"
          className="h-11 w-full shrink-0 px-5 text-[13px] font-bold sm:mt-0 sm:w-auto"
        >
          Quản lý đơn hàng
        </FillButton>
      </div>

      <section className="mt-6 sm:mt-8">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">
          Doanh thu
        </h2>
        <DashboardRevenuePanel />
      </section>

      <section className="mt-8 sm:mt-10">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">
          Đơn theo ngày
        </h2>
        <DashboardOrdersByDayPanel />
      </section>

      <div className="mt-8 grid gap-8 sm:mt-10 lg:grid-cols-2 lg:items-start lg:gap-6">
        <section className="min-w-0">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">
            Trạng thái đơn
          </h2>
          <DashboardOrderStatusPanel />
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">
            Cần chú ý
          </h2>
          <AdminDashboardSummary />
        </section>
      </div>
    </AdminPageFrame>
  );
}
