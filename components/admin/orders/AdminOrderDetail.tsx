"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Check, Loader2 } from "lucide-react";
import { AdminOrderStatusBadge } from "@/components/admin/orders/AdminOrderStatusBadge";
import { AdminBackLink } from "@/components/admin/ui/AdminBackLink";
import { FillButton } from "@/components/ui/FillButton";
import {
  ADMIN_ORDER_STATUS_LABEL,
  ADMIN_ORDER_STATUS_TRANSITIONS,
  adminOrderDetailSwrKey,
} from "@/features/admin-orders/constants";
import { adminOrdersService } from "@/features/admin-orders/services/admin-orders.service";
import type { AdminOrderStatus } from "@/features/admin-orders/types";
import { notify } from "@/lib/toast";
import { revalidateAfterOrderMutation } from "@/lib/admin-swr-revalidate";
import { cn, formatCurrencyVnd, formatDate } from "@/lib/utils";

interface AdminOrderDetailProps {
  orderId: string;
}

function transitionLabel(status: AdminOrderStatus): string {
  if (status === "cancelled") return "Hủy đơn";
  return ADMIN_ORDER_STATUS_LABEL[status];
}

/**
 * S3 — case file: identity band + 2 cột (khách/bước tiếp · sản phẩm/lịch sử).
 */
export function AdminOrderDetail({ orderId }: AdminOrderDetailProps) {
  const { mutate: globalMutate } = useSWRConfig();
  const detailKey = adminOrderDetailSwrKey(orderId);

  const { data: order, error, isLoading, mutate } = useSWR(
    detailKey,
    () => adminOrdersService.getById(orderId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const [nextStatus, setNextStatus] = useState<AdminOrderStatus | "">("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-28 animate-pulse rounded-full bg-border-subtle" />
        <div className="h-24 animate-pulse rounded-[20px] bg-border-subtle" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-[20px] bg-border-subtle" />
          <div className="h-64 animate-pulse rounded-[20px] bg-border-subtle" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-red-700">
          Không tìm thấy đơn hàng hoặc lỗi tải dữ liệu.
        </p>
        <FillButton
          href="/staff/orders"
          variant="ink"
          className="mt-4 px-5 py-2.5 text-[13px] font-bold"
        >
          Về danh sách
        </FillButton>
      </div>
    );
  }

  const transitions = ADMIN_ORDER_STATUS_TRANSITIONS[order.status];
  const history = [...order.statusHistory].reverse();

  const handleUpdateStatus = async () => {
    if (!nextStatus) {
      notify.error("Chọn trạng thái mới.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await adminOrdersService.updateStatus(order.id, nextStatus, {
        note,
      });
      await mutate(updated, { revalidate: false });
      await revalidateAfterOrderMutation(globalMutate);
      notify.success(`Đã chuyển sang ${ADMIN_ORDER_STATUS_LABEL[nextStatus]}.`);
      setNextStatus("");
      setNote("");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Cập nhật thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chuyển khoản VietQR không có webhook — nhân viên đối chiếu sao kê ngân
  // hàng rồi tự xác nhận. Đây là state machine RIÊNG, tách khỏi trạng thái đơn.
  const canConfirmPayment =
    order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "unpaid";

  const handleConfirmPayment = async () => {
    setIsSubmitting(true);
    try {
      const updated = await adminOrdersService.confirmPayment(order.id);
      await mutate(updated, { revalidate: false });
      await revalidateAfterOrderMutation(globalMutate);
      notify.success("Đã xác nhận nhận được thanh toán.");
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Xác nhận thanh toán thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      <AdminBackLink href="/staff/orders">Đơn hàng</AdminBackLink>

      {/* Identity band */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[clamp(24px,4vw,30px)] font-bold tracking-[-0.03em] text-ink">
              {order.orderCode}
            </h1>
            <AdminOrderStatusBadge status={order.status} />
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-[5px] text-[11px] font-extrabold tracking-[0.02em] uppercase",
                order.paymentStatus === "paid"
                  ? "bg-lime/50 text-forest"
                  : "bg-ink/10 text-text-muted",
              )}
            >
              {order.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
            </span>
          </div>
          <p className="mt-2 text-[13px] font-medium text-text-muted">
            Tạo {formatDate(order.createdAt, { hour: "2-digit", minute: "2-digit" })} ·
            Cập nhật{" "}
            {formatDate(order.updatedAt, { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {order.paymentMethodLabel}
          </p>
        </div>
        <p className="font-display text-[clamp(22px,4vw,28px)] font-bold tracking-[-0.03em] text-ink">
          {formatCurrencyVnd(order.total)}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-6">
            <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
              Khách hàng
            </h3>
            <dl className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
              <Meta label="Họ tên" value={order.customerName} />
              <Meta label="SĐT" value={order.customerPhone} />
              <Meta label="Email" value={order.customerEmail} className="sm:col-span-2" />
              <Meta
                label="Địa chỉ giao"
                value={order.shippingAddressLabel}
                className="sm:col-span-2"
              />
              {order.note ? (
                <Meta
                  label="Ghi chú khách"
                  value={order.note}
                  className="sm:col-span-2"
                />
              ) : null}
            </dl>
          </section>

          {canConfirmPayment ? (
            <section className="rounded-[20px] border-[1.5px] border-lime/60 bg-lime/10 px-5 py-[22px] shadow-sm md:px-6">
              <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
                Thanh toán chuyển khoản
              </h3>
              <p className="mt-1.5 text-[13px] font-medium text-text-muted">
                Đơn chuyển khoản chưa được xác nhận. Kiểm tra sao kê ngân hàng với
                nội dung <span className="font-bold text-ink">{order.orderCode}</span>{" "}
                rồi xác nhận. Thao tác này chỉ đổi trạng thái thanh toán, không đổi
                trạng thái đơn.
              </p>
              <FillButton
                type="button"
                variant="ink-solid"
                disabled={isSubmitting}
                onClick={() => {
                  void handleConfirmPayment();
                }}
                className="mt-3.5 h-11 justify-center px-[22px] text-[13px] font-bold"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Xác nhận đã nhận thanh toán
              </FillButton>
            </section>
          ) : null}

          <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-6">
            <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
              Bước tiếp theo
            </h3>
            {transitions.length === 0 ? (
              <p className="mt-1.5 text-[13px] font-medium text-text-muted">
                Đơn đã hoàn tất.
              </p>
            ) : (
              <>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {transitions.map((s) => {
                    const selected = nextStatus === s;
                    const isCancel = s === "cancelled";
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNextStatus(selected ? "" : s)}
                        className={cn(
                          "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-[18px] text-[13px] font-bold transition-colors",
                          isCancel
                            ? selected
                              ? "border-[1.5px] border-danger bg-danger/10 text-danger"
                              : "border-[1.5px] border-danger/40 text-danger hover:bg-danger/5"
                            : selected
                              ? "border-[1.5px] border-ink bg-ink text-bg"
                              : "border-[1.5px] border-ink/20 text-ink hover:bg-ink/[0.04]",
                        )}
                      >
                        {selected && !isCancel ? (
                          <Check
                            size={14}
                            strokeWidth={2.4}
                            aria-hidden
                          />
                        ) : null}
                        {transitionLabel(s)}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3.5 flex flex-col gap-1.5 text-[13px] font-bold text-ink">
                  Ghi chú
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Ví dụ: đã gọi xác nhận khách"
                    className="rounded-[14px] border border-ink/20 bg-bg px-3.5 py-2.5 text-[14px] font-medium text-ink placeholder:text-text-faint"
                  />
                </label>
                <FillButton
                  type="button"
                  variant="ink-solid"
                  disabled={isSubmitting || !nextStatus}
                  onClick={() => {
                    void handleUpdateStatus();
                  }}
                  className="mt-3.5 h-11 justify-center px-[22px] text-[13px] font-bold"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Cập nhật trạng thái
                </FillButton>
              </>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-6">
            <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
              Sản phẩm
            </h3>
            <ul className="mt-3.5 m-0 list-none space-y-0 p-0">
              {order.lines.map((line, i) => (
                <li
                  key={`${line.productName}-${i}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-[15px] font-semibold text-ink">
                      {line.productName}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-text-muted">
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
            <dl className="mt-3.5 space-y-2 text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-text-muted">Tạm tính</dt>
                <dd className="font-semibold text-ink">
                  {formatCurrencyVnd(order.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-text-muted">Phí ship</dt>
                <dd className="font-semibold text-ink">
                  {formatCurrencyVnd(order.shippingFee)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-text-muted">Giảm giá</dt>
                <dd className="font-semibold text-forest">
                  −{formatCurrencyVnd(order.discountAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
                <dt className="text-[15px] font-bold text-ink">Tổng</dt>
                <dd className="text-[16px] font-bold text-ink">
                  {formatCurrencyVnd(order.total)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-6">
            <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
              Lịch sử
            </h3>
            <ol className="mt-3.5 m-0 list-none p-0">
              {history.map((log, index) => {
                const isLatest = index === 0;
                const isLast = index === history.length - 1;
                return (
                  <li key={log.id} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-[5px] size-2.5 shrink-0 rounded-full",
                          isLatest ? "bg-primary" : "bg-ink/20",
                        )}
                      />
                      {!isLast ? (
                        <span className="w-0.5 flex-1 bg-ink/10" />
                      ) : null}
                    </div>
                    <div className={cn(!isLast && "pb-4")}>
                      <p className="text-[13.5px] font-bold text-ink">
                        {ADMIN_ORDER_STATUS_LABEL[log.status]}{" "}
                        <span className="font-medium text-text-muted">
                          ·{" "}
                          {formatDate(log.createdAt, {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium text-text-muted">
                        {log.changedByLabel}
                        {log.note ? ` — ${log.note}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
