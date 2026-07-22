"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ADMIN_COUPONS_SWR_KEY } from "@/features/admin-coupons/constants";
import { adminCouponsService } from "@/features/admin-coupons/services/admin-coupons.service";
import { notify } from "@/lib/toast";
import { formatCurrencyVnd, formatDate } from "@/lib/utils";

export function AdminCouponsList() {
  const { data, error, isLoading, mutate } = useSWR(
    ADMIN_COUPONS_SWR_KEY,
    () => adminCouponsService.list(),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]"
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
    <div>
      <div className="mb-4 flex justify-end">
        <Link
          href="/admin/coupons/new"
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-bg"
        >
          Tạo coupon
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {data.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-4 py-4"
          >
            <div>
              <Link
                href={`/admin/coupons/${c.id}`}
                className="text-[15px] font-bold text-ink underline-offset-2 hover:underline"
              >
                {c.code}
              </Link>
              <p className="mt-1 text-[13px] text-text-muted">
                {c.discountType === "PERCENTAGE"
                  ? `${c.discount}%`
                  : formatCurrencyVnd(c.discount)}
                {c.expiresAt ? ` · Hết ${formatDate(c.expiresAt)}` : " · Không hết hạn"}
                {` · Dùng ${c.usedCount}${c.usageLimit != null ? `/${c.usageLimit}` : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                  c.isActive ? "bg-lime/50 text-forest" : "bg-ink/10 text-text-muted"
                }`}
              >
                {c.isActive ? "Active" : "Off"}
              </span>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => void toggle(c.id, c.isActive)}
                className="cursor-pointer rounded-full border border-ink/20 px-3 py-1.5 text-[12px] font-bold text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                {c.isActive ? "Tắt" : "Bật"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
