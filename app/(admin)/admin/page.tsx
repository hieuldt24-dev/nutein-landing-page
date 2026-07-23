"use client";

import useSWR from "swr";
import {
  AdminHomeAuditPanel,
  AdminHomeUsersPanel,
} from "@/components/admin/dashboard/AdminHomePanels";
import { AdminPageFrame } from "@/components/admin/shell/AdminShell";
import { DashboardRevenuePanel } from "@/components/admin/dashboard/DashboardRevenuePanel";
import { ADMIN_HOME_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";

function HomeSkeleton() {
  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle sm:h-[96px]"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle" />
    </div>
  );
}

/** /admin — Tổng quan Admin: doanh thu + users + audit. */
export default function AdminHomePage() {
  const { data, error, isLoading } = useSWR(
    ADMIN_HOME_SWR_KEY,
    () => adminDashboardService.getAdminHome(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  return (
    <AdminPageFrame>
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(26px,6vw,36px)] font-bold tracking-[-0.03em] text-ink">
          Tổng quan
        </h1>
      </div>

      {isLoading ? <HomeSkeleton /> : null}

      {error ? (
        <p className="mt-6 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700 sm:mt-8">
          Không tải được tổng quan. Thử tải lại trang.
        </p>
      ) : null}

      {data ? (
        <div className="mt-6 flex flex-col gap-8 sm:mt-8 sm:gap-10">
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink">
              Doanh thu
            </h2>
            <DashboardRevenuePanel revenue={data.revenue} />
          </section>
          <AdminHomeUsersPanel users={data.users} />
          <AdminHomeAuditPanel recentAudit={data.recentAudit} />
        </div>
      ) : null}
    </AdminPageFrame>
  );
}
