import { DEFAULT_PRODUCT_VARIANT_ID } from "@/features/product/constants";
import { productService } from "@/features/product/services/product.service";
import {
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
  SHIPPING_FEE_NOTE,
  VOUCHER_TIERS,
} from "./constants";
import type {
  CartLine,
  CartLineSummary,
  CartState,
  CartSummary,
  VoucherProgress,
  VoucherTier,
  VoucherTierProgress,
} from "./types";

/** Pure pricing — cart UI + checkout service cùng dùng, không I/O. */

export function clampCartQuantity(value: number): number {
  return Math.min(MAX_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, value));
}

const VARIANT_SORT_ORDER = ["pack-1", "pack-3", "pack-6"] as const;

function variantSortKey(variantId: string): number {
  const idx = VARIANT_SORT_ORDER.indexOf(
    variantId as (typeof VARIANT_SORT_ORDER)[number],
  );
  return idx === -1 ? 99 : idx;
}

/** Gộp dòng trùng variant, bỏ qty ≤ 0, clamp, sort ổn định. */
export function normalizeCartLines(
  lines: readonly CartLine[] | null | undefined,
): CartLine[] {
  const merged = new Map<string, number>();

  for (const line of lines ?? []) {
    if (!line?.variantId || typeof line.variantId !== "string") continue;
    const qty = clampCartQuantity(
      typeof line.quantity === "number" && Number.isFinite(line.quantity)
        ? line.quantity
        : MIN_CART_QUANTITY,
    );
    if (qty <= MIN_CART_QUANTITY) continue;
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + qty);
  }

  return [...merged.entries()]
    .map(([variantId, quantity]) => ({
      variantId,
      quantity: clampCartQuantity(quantity),
    }))
    .filter((line) => line.quantity > MIN_CART_QUANTITY)
    .sort((a, b) => variantSortKey(a.variantId) - variantSortKey(b.variantId));
}

export function normalizeCartState(
  partial: Partial<CartState> | CartState | null | undefined,
): CartState {
  return { lines: normalizeCartLines(partial?.lines) };
}

export function totalPackQuantity(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Thêm / cộng số gói vào 1 variant. */
export function addToCartLines(
  lines: readonly CartLine[],
  amount: number,
  variantId: string = DEFAULT_PRODUCT_VARIANT_ID,
): CartLine[] {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return normalizeCartLines(lines);

  const next = lines.map((line) => ({ ...line }));
  const idx = next.findIndex((line) => line.variantId === variantId);
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      quantity: next[idx].quantity + safeAmount,
    };
  } else {
    next.push({ variantId, quantity: safeAmount });
  }
  return normalizeCartLines(next);
}

/** Đặt số gói cho 1 dòng; qty ≤ 0 → xóa dòng. */
export function setLineQuantityInCart(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
): CartLine[] {
  const next = lines
    .filter((line) => line.variantId !== variantId)
    .concat(
      quantity > MIN_CART_QUANTITY
        ? [{ variantId, quantity: clampCartQuantity(quantity) }]
        : [],
    );
  return normalizeCartLines(next);
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
  tiers: VoucherTier[] = VOUCHER_TIERS,
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

function buildLineSummaries(lines: CartLine[]): CartLineSummary[] {
  const detail = productService.getProductDetail();
  return lines.map((line) => {
    const variant = productService.resolveVariant(detail, line.variantId);
    const unitPrice = productService.packPrice(detail, variant);
    return {
      variantId: line.variantId,
      label: variant.label,
      quantity: line.quantity,
      unitPrice,
      lineSubtotal: line.quantity * unitPrice,
    };
  });
}

/** Snapshot tiền hàng + voucher từ nhiều dòng gói (chưa gồm phí ship checkout). */
export function buildCartSummary(
  stateOrLines: CartState | CartLine[],
  tiers: VoucherTier[] = VOUCHER_TIERS,
): CartSummary {
  const lines = normalizeCartLines(
    Array.isArray(stateOrLines) ? stateOrLines : stateOrLines.lines,
  );
  const lineSummaries = buildLineSummaries(lines);
  const subtotal = lineSummaries.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const quantity = totalPackQuantity(lines);
  const voucherProgress = getVoucherProgress(subtotal, tiers);
  const discountPercent = resolveDiscountPercent(voucherProgress);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const total = Math.max(0, subtotal - discountAmount);

  return {
    lines: lineSummaries,
    quantity,
    subtotal,
    discountPercent,
    discountAmount,
    total,
    shippingNote: resolveShippingNote(voucherProgress),
    voucherProgress,
    isEmpty: lines.length === 0,
  };
}

export type ShippingMethodFeeKey = "standard" | "express";

/** Phí ship checkout — freeship voucher → 0. */
export function resolveCheckoutShippingFee(
  method: ShippingMethodFeeKey,
  voucherProgress: VoucherProgress,
  fees: Record<ShippingMethodFeeKey, number>,
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
