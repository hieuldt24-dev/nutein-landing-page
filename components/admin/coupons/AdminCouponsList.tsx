"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import { AdminToggle } from "@/components/admin/ui/AdminToggle";
import { FillButton } from "@/components/ui/FillButton";
import { ADMIN_COUPONS_SWR_KEY } from "@/features/admin-coupons/constants";
import { adminCouponsService } from "@/features/admin-coupons/services/admin-coupons.service";
import { notify } from "@/lib/toast";
import { formatCurrencyVnd, formatDate } from "@/lib/utils";

export function AdminCouponsList() {
  const { data, error, isLoading, mutate } = useSWR(
    ADMIN_COUPONS_SWR_KEY,
    () => adminCouponsService.list(),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được coupon.
      </p>
    );
  }

  const toggle = async (id: string, isActive: boolean) => {
    setBusyId(id);
    try {
      await adminCouponsService.setActive(id, !isActive);
      await mutate();
      notify.success(isActive ? "Đã tắt coupon." : "Đã bật coupon.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
          Coupon
        </h1>
        <FillButton
          href="/staff/coupons/new"
          variant="ink-solid"
          className="h-11 w-full px-5 text-[13px] font-bold sm:w-auto"
        >
          Tạo coupon
        </FillButton>
      </div>

      {data.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-text-muted">
          Chưa có coupon.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((c) => (
            <li key={c.id}>
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-ink/10 bg-surface px-4 py-4 shadow-sm md:px-5 ${
                  c.isActive ? "" : "opacity-75"
                }`}
              >
                <Link
                  href={`/staff/coupons/${c.id}`}
                  className="min-w-0 flex-1 transition-colors hover:opacity-90"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[16px] font-extrabold tracking-wide text-ink">
                      {c.code}
                    </p>
                    <ChevronRight
                      size={16}
                      className="text-text-faint"
                      aria-hidden
                    />
                  </div>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {c.discountType === "PERCENTAGE"
                      ? `Giảm ${c.discount}%`
                      : `Giảm ${formatCurrencyVnd(c.discount)}`}
                    {c.minOrderValue != null
                      ? ` · Đơn từ ${formatCurrencyVnd(c.minOrderValue)}`
                      : ""}
                    {c.expiresAt
                      ? ` · Hết ${formatDate(c.expiresAt)}`
                      : " · Không hết hạn"}
                    {` · ${c.usedCount}${c.usageLimit != null ? `/${c.usageLimit}` : ""} lượt`}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                      c.isActive
                        ? "bg-lime/50 text-forest"
                        : "bg-ink/10 text-text-muted"
                    }`}
                  >
                    {c.isActive ? "Đang bật" : "Tắt"}
                  </span>
                  <AdminToggle
                    checked={c.isActive}
                    disabled={busyId === c.id}
                    label={c.isActive ? "Tắt coupon" : "Bật coupon"}
                    onChange={() => void toggle(c.id, c.isActive)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
