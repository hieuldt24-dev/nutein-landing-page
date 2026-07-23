"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";
import { AdminOrderStatusBadge } from "@/components/admin/AdminOrderStatusBadge";
import { FillButton } from "@/components/ui/FillButton";
import {
  ADMIN_ORDER_STATUS_LABEL,
  ADMIN_ORDER_STATUS_TRANSITIONS,
  ADMIN_ORDERS_SWR_KEY,
  adminOrderDetailSwrKey,
} from "@/features/admin-orders/constants";
import { adminOrdersService } from "@/features/admin-orders/services/admin-orders.service";
import type { AdminOrderStatus } from "@/features/admin-orders/types";
import { useAuthStore } from "@/lib/useAuthStore";
import { notify } from "@/lib/toast";
import { formatCurrencyVnd, formatDate } from "@/lib/utils";

interface AdminOrderDetailProps {
  orderId: string;
}

/**
 * S3 — chi tiết đơn + chuyển trạng thái + lịch sử.
 */
export function AdminOrderDetail({ orderId }: AdminOrderDetailProps) {
  const { mutate: globalMutate } = useSWRConfig();
  const { user } = useAuthStore();
  const detailKey = adminOrderDetailSwrKey(orderId);

  const { data: order, error, isLoading, mutate } = useSWR(
    detailKey,
    () => adminOrdersService.getById(orderId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const [nextStatus, setNextStatus] = useState<AdminOrderStatus | "">("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
        <div className="h-56 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-red-700">
          Không tìm thấy đơn hàng hoặc lỗi tải dữ liệu.
        </p>
        <FillButton
          href="/admin/orders"
          variant="ink"
          className="mt-4 px-5 py-2.5 text-[13px] font-bold"
        >
          Về danh sách
        </FillButton>
      </div>
    );
  }

  const transitions = ADMIN_ORDER_STATUS_TRANSITIONS[order.status];

  const handleUpdateStatus = async () => {
    if (!nextStatus) {
      notify.error("Chọn trạng thái mới.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await adminOrdersService.updateStatus(order.id, nextStatus, {
        note,
        actorLabel: user?.fullName || user?.email || "Staff",
      });
      await mutate(updated, { revalidate: false });
      await globalMutate(
        (key) => typeof key === "string" && key.startsWith(ADMIN_ORDERS_SWR_KEY),
        undefined,
        { revalidate: true }
      );
      notify.success(`Đã chuyển sang «${ADMIN_ORDER_STATUS_LABEL[nextStatus]}».`);
      setNextStatus("");
      setNote("");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Cập nhật thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/orders"
            className="text-[13px] font-bold text-primary-deep underline-offset-2 hover:underline"
          >
            ← Danh sách đơn
          </Link>
          <h2 className="mt-2 font-display text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.03em] text-ink">
            {order.orderCode}
          </h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Tạo {formatDate(order.createdAt)} · Cập nhật {formatDate(order.updatedAt)}
          </p>
        </div>
        <AdminOrderStatusBadge status={order.status} />
      </div>

      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5 md:px-6">
        <h3 className="font-display text-lg font-bold text-ink">Khách hàng</h3>
        <dl className="mt-3 grid gap-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Họ tên
            </dt>
            <dd className="mt-1 font-semibold text-ink">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              SĐT
            </dt>
            <dd className="mt-1 font-semibold text-ink">{order.customerPhone}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Email
            </dt>
            <dd className="mt-1 font-semibold text-ink">{order.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Thanh toán
            </dt>
            <dd className="mt-1 font-semibold text-ink">{order.paymentMethodLabel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Địa chỉ giao
            </dt>
            <dd className="mt-1 font-semibold text-ink">{order.shippingAddressLabel}</dd>
          </div>
          {order.note ? (
            <div className="sm:col-span-2">
              <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
                Ghi chú khách
              </dt>
              <dd className="mt-1 font-semibold text-ink">{order.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5 md:px-6">
        <h3 className="font-display text-lg font-bold text-ink">Sản phẩm</h3>
        <ul className="mt-3 m-0 list-none space-y-3 p-0">
          {order.lines.map((line, i) => (
            <li
              key={`${line.productName}-${i}`}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-[15px] font-semibold text-ink">{line.productName}</p>
                <p className="text-[13px] text-text-muted">
                  {line.variantLabel} · SL {line.quantity} ·{" "}
                  {formatCurrencyVnd(line.unitPrice)}/sp
                </p>
              </div>
              <p className="text-[15px] font-bold text-ink">
                {formatCurrencyVnd(line.lineTotal)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Tạm tính</dt>
            <dd className="font-semibold text-ink">{formatCurrencyVnd(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Phí ship</dt>
            <dd className="font-semibold text-ink">{formatCurrencyVnd(order.shippingFee)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Giảm giá</dt>
            <dd className="font-semibold text-ink">
              −{formatCurrencyVnd(order.discountAmount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 pt-1 text-[16px]">
            <dt className="font-bold text-ink">Tổng</dt>
            <dd className="font-bold text-ink">{formatCurrencyVnd(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5 md:px-6">
        <h3 className="font-display text-lg font-bold text-ink">Chuyển trạng thái</h3>
        {transitions.length === 0 ? (
          <p className="mt-2 text-[14px] text-text-muted">
            Đơn đã ở trạng thái kết thúc — không chuyển tiếp.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3 sm:max-w-md">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
              Trạng thái mới
              <select
                value={nextStatus}
                onChange={(e) =>
                  setNextStatus((e.target.value || "") as AdminOrderStatus | "")
                }
                className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium"
              >
                <option value="">Chọn…</option>
                {transitions.map((s) => (
                  <option key={s} value={s}>
                    {ADMIN_ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
              Ghi chú nội bộ (tuỳ chọn)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium"
                placeholder="Ví dụ: đã gọi xác nhận khách"
              />
            </label>
            <button
              type="button"
              disabled={isSubmitting || !nextStatus}
              onClick={() => {
                void handleUpdateStatus();
              }}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Cập nhật trạng thái
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5 md:px-6">
        <h3 className="font-display text-lg font-bold text-ink">Lịch sử trạng thái</h3>
        <ol className="mt-3 m-0 list-none space-y-3 p-0">
          {[...order.statusHistory].reverse().map((log) => (
            <li
              key={log.id}
              className="border-b border-ink/10 pb-3 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <AdminOrderStatusBadge status={log.status} />
                <span className="text-[12px] text-text-muted">
                  {formatDate(log.createdAt, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-text-muted">
                {log.changedByLabel}
                {log.note ? ` — ${log.note}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
