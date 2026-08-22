"use client";

import Image from "next/image";
import type { CartSummary } from "@/features/cart/types";
import { productService } from "@/features/product/services/product.service";
import { cn, formatCurrencyVnd } from "@/lib/utils";

interface CheckoutOrderSummaryProps {
  summary: CartSummary;
  shippingFee: number | null;
  shippingNote: string;
  /** Mã giảm giá đang áp dụng — hiện thành dòng RIÊNG, không gộp vào dòng "Giảm giá (x%)". */
  couponCode?: string;
  couponDiscountAmount?: number;
  className?: string;
}

/**
 * Cột phải — xác nhận đơn (§3.4). Không ô discount code (voucher từ cart).
 */
export function CheckoutOrderSummary({
  summary,
  shippingFee,
  shippingNote,
  couponCode,
  couponDiscountAmount,
  className,
}: CheckoutOrderSummaryProps) {
  const couponDiscount = couponDiscountAmount ?? 0;
  const hasCoupon = Boolean(couponCode) && couponDiscount > 0;
  // Giảm giá coupon CỘNG THÊM vào giảm giá theo mốc voucher (đã nằm trong
  // summary.total), không thay thế.
  const merchandiseTotal = summary.total;
  const payableMerchandise = merchandiseTotal - couponDiscount;
  const orderTotal =
    shippingFee === null ? payableMerchandise : payableMerchandise + shippingFee;
  const hasDiscount = summary.discountAmount > 0;
  const totalSaved = summary.discountAmount + couponDiscount;
  const detail = productService.getProductDetail();
  const primary = summary.lines[0];
  const catalog = productService.toCartProduct(
    detail,
    primary?.variantId,
  );

  return (
    <aside
      className={cn(
        "rounded-[var(--radius-lg)] border border-ink/10 bg-[var(--color-surface)] p-6 md:p-8",
        className,
      )}
    >
      <div className="flex items-start gap-4 border-b border-ink/10 pb-6">
        <div className="relative size-[72px] shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-ink/10 bg-bg">
          <Image
            src={catalog.image}
            alt={catalog.imageAlt}
            fill
            sizes="72px"
            className="object-cover"
          />
          <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-extrabold text-[var(--color-bg)]">
            {summary.lines.length}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
            {catalog.name}
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {summary.lines.map((line) => (
              <li
                key={line.variantId}
                className="text-[12px] font-semibold text-text-muted"
              >
                {line.label} × {line.quantity}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px] font-bold text-ink">
            {formatCurrencyVnd(merchandiseTotal)}
          </p>
        </div>
      </div>

      <dl className="mt-6 flex flex-col gap-3 text-[14px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold text-text-body">Tạm tính</dt>
          <dd className="font-bold text-ink">{formatCurrencyVnd(summary.subtotal)}</dd>
        </div>

        {hasDiscount && (
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-forest">
              Giảm giá ({summary.discountPercent}%)
            </dt>
            <dd className="font-bold text-forest">
              −{formatCurrencyVnd(summary.discountAmount)}
            </dd>
          </div>
        )}

        {hasCoupon && (
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-forest">Mã giảm giá: {couponCode}</dt>
            <dd className="font-bold text-forest">
              −{formatCurrencyVnd(couponDiscount)}
            </dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold text-text-body">Phí vận chuyển</dt>
          <dd className="text-right font-bold text-ink">
            {shippingFee === null
              ? "Nhập địa chỉ giao hàng"
              : shippingFee === 0
                ? shippingNote
                : formatCurrencyVnd(shippingFee)}
          </dd>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-4">
          <dt className="text-[15px] font-extrabold uppercase tracking-[-0.02em] text-ink">
            Tổng
          </dt>
          <dd className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
            {formatCurrencyVnd(orderTotal)}
          </dd>
        </div>

        {totalSaved > 0 && (
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-forest">
            Tiết kiệm {formatCurrencyVnd(totalSaved)}
          </p>
        )}
      </dl>
    </aside>
  );
}
