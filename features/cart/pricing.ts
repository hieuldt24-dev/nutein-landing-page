import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";
import { productService } from "@/features/product/services/product.service";
import {
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
  SHIPPING_FEE_NOTE,
  VOUCHER_TIERS,
} from "./constants";
import type { CartSummary, VoucherProgress, VoucherTier, VoucherTierProgress } from "./types";

/** Pure pricing — cart UI + checkout service cùng dùng, không I/O. */

export function clampCartQuantity(value: number): number {
  return Math.min(MAX_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, value));
}

function evenPositionPercent(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index + 0.5) / total) * 100;
}

function buildTierProgress(tiers: VoucherTier[], subtotal: number): VoucherTierProgress[] {
  return tiers.map((tier, index) => ({
    ...tier,
    achieved: subtotal >= tier.thresholdVnd,
    positionPercent: evenPositionPercent(index, tiers.length),
  }));
}

function calculateProgressPercent(subtotal: number, tiers: VoucherTier[]): number {
  if (tiers.length === 0) return 0;

  const last = tiers[tiers.length - 1];
  if (subtotal >= last.thresholdVnd) {
    return evenPositionPercent(tiers.length - 1, tiers.length);
  }

  let prevThreshold = 0;
  let prevPosition = 0;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const position = evenPositionPercent(i, tiers.length);
    if (subtotal < tier.thresholdVnd) {
      const span = tier.thresholdVnd - prevThreshold;
      const ratio = span > 0 ? (subtotal - prevThreshold) / span : 0;
      return prevPosition + ratio * (position - prevPosition);
    }
    prevThreshold = tier.thresholdVnd;
    prevPosition = position;
  }

  return prevPosition;
}

export function getVoucherProgress(
  subtotal: number,
  tiers: VoucherTier[] = VOUCHER_TIERS
): VoucherProgress {
  const tierProgress = buildTierProgress(tiers, subtotal);
  const nextTier = tierProgress.find((tier) => !tier.achieved) ?? null;

  return {
    tiers: tierProgress,
    nextTier,
    amountRemainingVnd: nextTier ? Math.max(0, nextTier.thresholdVnd - subtotal) : 0,
    progressPercent: calculateProgressPercent(subtotal, tiers),
    isMaxTierAchieved: nextTier === null,
  };
}

function resolveDiscountPercent(voucherProgress: VoucherProgress): number {
  const achievedDiscounts = voucherProgress.tiers
    .filter((tier) => tier.achieved && tier.kind === "discount" && tier.discountPercent)
    .map((tier) => tier.discountPercent ?? 0);

  return achievedDiscounts.length > 0 ? Math.max(...achievedDiscounts) : 0;
}

export function hasFreeShipping(voucherProgress: VoucherProgress): boolean {
  return voucherProgress.tiers.some((tier) => tier.achieved && tier.kind === "free_shipping");
}

function resolveShippingNote(voucherProgress: VoucherProgress): string {
  return hasFreeShipping(voucherProgress) ? "Miễn phí vận chuyển" : SHIPPING_FEE_NOTE;
}

/** Snapshot tiền hàng + voucher từ quantity (chưa gồm phí ship checkout). */
export function buildCartSummary(
  quantity: number,
  unitPrice: number = productService.getCatalogProduct().price,
  tiers: VoucherTier[] = VOUCHER_TIERS,
  variantId: string = DEFAULT_PRODUCT_VARIANT_ID
): CartSummary {
  const safeQuantity = clampCartQuantity(quantity);
  const subtotal = Math.max(0, safeQuantity) * unitPrice;
  const voucherProgress = getVoucherProgress(subtotal, tiers);
  const discountPercent = resolveDiscountPercent(voucherProgress);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const total = Math.max(0, subtotal - discountAmount);

  return {
    quantity: safeQuantity,
    variantId,
    unitPrice,
    subtotal,
    discountPercent,
    discountAmount,
    total,
    shippingNote: resolveShippingNote(voucherProgress),
    voucherProgress,
    isEmpty: safeQuantity <= MIN_CART_QUANTITY,
  };
}

export type ShippingMethodFeeKey = "standard" | "express";

/** Phí ship checkout — freeship voucher → 0. */
export function resolveCheckoutShippingFee(
  method: ShippingMethodFeeKey,
  voucherProgress: VoucherProgress,
  fees: Record<ShippingMethodFeeKey, number>
): { shippingFee: number; shippingNote: string } {
  if (hasFreeShipping(voucherProgress)) {
    return { shippingFee: 0, shippingNote: "Miễn phí vận chuyển" };
  }

  const shippingFee = fees[method];
  return {
    shippingFee,
    shippingNote: method === "express" ? "Giao hàng nhanh" : "Giao hàng tiêu chuẩn",
  };
}
