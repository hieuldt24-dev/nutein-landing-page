"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import useSWR from "swr";
import { ADMIN_DASHBOARD_OPS_SWR_KEY } from "@/features/admin-dashboard/constants";
import { adminDashboardService } from "@/features/admin-dashboard/services/admin-dashboard.service";
import { cn } from "@/lib/utils";

function formatAttentionTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const KIND_LABEL: Record<string, string> = {
  order: "Đơn hàng",
  contact: "Liên hệ",
  product: "Sản phẩm",
};

function AttentionSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-ink/10 bg-surface shadow-sm">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse border-b border-ink/5 bg-border-subtle/60 last:border-0"
        />
      ))}
    </div>
  );
}

/**
 * List “Cần chú ý” — Staff home (design mock). Data từ API.
 */
export function DashboardAttentionList() {
  const { data, error, isLoading } = useSWR(
    ADMIN_DASHBOARD_OPS_SWR_KEY,
    () => adminDashboardService.getStaffOps(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  if (isLoading) {
    return <AttentionSkeleton />;
  }

  if (error) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được danh sách cần chú ý.
      </p>
    );
  }

  const items = data?.attention ?? [];

  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-text-muted">
        Không có việc cần xử lý ngay.
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[var(--radius-lg)] border border-ink/10 bg-surface p-0 shadow-sm">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            index < items.length - 1 && "border-b border-ink/5",
          )}
        >
          <Link
            href={item.href}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink/[0.02]"
          >
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                item.urgent ? "bg-danger" : "bg-primary",
              )}
            />
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">
              {item.message}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-text-muted">
              {formatAttentionTime(item.createdAt)} · {KIND_LABEL[item.kind]}
            </span>
            <ChevronRight
              size={16}
              strokeWidth={2.2}
              className="shrink-0 text-text-faint"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
