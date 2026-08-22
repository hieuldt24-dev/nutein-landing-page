"use client";

import { FillButton } from "@/components/ui/FillButton";
import type { CreateOrderResult } from "@/features/checkout/types";
import { PAYMENT_OPTIONS, SHIPPING_OPTIONS } from "@/features/checkout/constants";
import { formatCurrencyVnd } from "@/lib/utils";

interface CheckoutSuccessViewProps {
  order: CreateOrderResult;
  /** Trạng thái thanh toán payOS đối soát trực tiếp — chỉ có ý nghĩa khi paymentMethod = bank_transfer. */
  livePaymentStatus?: "UNPAID" | "PAID" | null;
}

export function CheckoutSuccessView({
  order,
  livePaymentStatus,
}: CheckoutSuccessViewProps) {
  const isPayos = order.paymentMethod === "bank_transfer";
  const isPayosPaid = isPayos && livePaymentStatus === "PAID";
  const shippingLabel =
    SHIPPING_OPTIONS.find((o) => o.value === order.shippingMethod)?.label ?? order.shippingMethod;
  const paymentLabel =
    PAYMENT_OPTIONS.find((o) => o.value === order.paymentMethod)?.label ?? order.paymentMethod;

  return (
    <div className="mx-auto max-w-[640px] px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
        Đặt hàng thành công
      </p>
      <h1 className="mt-3 font-display text-[clamp(32px,5vw,48px)] font-black uppercase leading-tight tracking-[-0.04em] text-ink">
        Cảm ơn bạn đã chọn Nutein
      </h1>
      <p className="mt-4 text-[14px] font-semibold text-text-body">
        Mã đơn hàng của bạn là{" "}
        <span className="font-extrabold text-ink">{order.orderCode}</span>. Chúng tôi sẽ liên hệ
        xác nhận qua SĐT hoặc email khi xử lý đơn.
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-ink/10 bg-surface p-6">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-ink">
          Thông tin giao hàng
        </h2>
        <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Người nhận</dt>
            <dd className="font-semibold text-ink">
              {order.buyer.fullName} · {order.buyer.phone}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Email</dt>
            <dd className="font-semibold text-ink">{order.buyer.email}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Địa chỉ</dt>
            <dd className="font-semibold text-ink">
              {order.address.street}, {order.address.ward}, {order.address.province}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Vận chuyển</dt>
            <dd className="font-semibold text-ink">
              {shippingLabel} — {order.estimatedDeliveryLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Thanh toán</dt>
            <dd className="font-semibold text-ink">{paymentLabel}</dd>
          </div>
          <div className="border-t border-ink/10 pt-3">
            <dt className="text-[12px] font-bold text-text-muted">Tổng thanh toán</dt>
            <dd className="font-display text-[22px] font-bold text-ink">
              {formatCurrencyVnd(order.summary.total)}
            </dd>
          </div>
        </dl>

        {isPayos ? (
          <div
            className={
              isPayosPaid
                ? "mt-5 rounded-[var(--radius-md)] border border-primary/25 bg-primary/10 px-4 py-3"
                : "mt-5 rounded-[var(--radius-md)] border border-ink/10 bg-bg px-4 py-3"
            }
          >
            <p className="text-[13px] font-extrabold text-ink">
              {isPayosPaid ? "Đã thanh toán qua payOS" : "Đang chờ xác nhận thanh toán"}
            </p>
            <p className="mt-1 text-[12px] font-medium text-text-body">
              {isPayosPaid
                ? "Chúng tôi đã nhận được thanh toán của bạn qua payOS."
                : "Nếu bạn đã thanh toán, hệ thống sẽ tự động xác nhận trong ít phút."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <FillButton
          href="/#san-pham"
          variant="ink-solid"
          className="h-[48px] justify-center px-6 text-[14px] font-bold uppercase"
        >
          Tiếp tục mua sắm
        </FillButton>
        <FillButton
          href="/blog"
          variant="ink"
          className="h-[48px] justify-center px-6 text-[14px] font-bold uppercase"
        >
          Khám phá Blog
        </FillButton>
      </div>

      {!isPayos ? (
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          Đơn demo — chưa trừ tiền / chưa đồng bộ kho thật
        </p>
      ) : null}
    </div>
  );
}
