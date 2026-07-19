"use client";

import { Flame, Tag, Truck } from "lucide-react";
import { cn, formatCurrencyVnd } from "@/lib/utils";
import type { VoucherProgress, VoucherTierProgress } from "@/features/cart/types";

function TierIcon({ tier }: { tier: VoucherTierProgress }) {
  if (tier.kind === "free_shipping") return <Truck size={18} strokeWidth={2.2} />;
  if ((tier.discountPercent ?? 0) >= 10) return <Flame size={18} strokeWidth={2.2} />;
  return <Tag size={18} strokeWidth={2.2} />;
}

function tierLabel(tier: VoucherTierProgress): string {
  return tier.kind === "free_shipping" ? "Freeship" : `Giảm ${tier.discountPercent}%`;
}

interface CartVoucherProgressProps {
  progress: VoucherProgress;
  className?: string;
}

/**
 * Size map Joy Rush: title 1.4rem, gap 3rem, bar 0.8rem, icon 3rem, label 1rem.
 */
export function CartVoucherProgress({ progress, className }: CartVoucherProgressProps) {
  const { tiers, nextTier, amountRemainingVnd, progressPercent, isMaxTierAchieved } = progress;

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <p className="text-[15px] font-bold uppercase tracking-[-0.01em] text-ink">
        {isMaxTierAchieved
          ? "Bạn đã đạt mức ưu đãi cao nhất — Giảm 25%!"
          : `Bạn còn cách "${nextTier?.label}" ${formatCurrencyVnd(amountRemainingVnd)} nữa!`}
      </p>

      <div className="relative h-2.5 rounded-full bg-ink/15">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />

        {tiers.map((tier) => (
          <span
            key={tier.id}
            className={cn(
              "absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-300",
              tier.achieved ? "bg-primary text-white" : "bg-ink text-bg"
            )}
            style={{ left: `${tier.positionPercent}%` }}
          >
            <TierIcon tier={tier} />
          </span>
        ))}
      </div>

      {/* Joy Rush label: top calc(100% + 1rem) dưới icon — chừa chỗ bằng mt */}
      <div className="relative mt-2 h-4">
        {tiers.map((tier) => (
          <span
            key={tier.id}
            className={cn(
              "absolute top-0 w-[5.5rem] -translate-x-1/2 text-center text-[12px] font-bold uppercase leading-tight tracking-[-0.01em]",
              tier.achieved ? "text-ink" : "text-text-muted"
            )}
            style={{ left: `${tier.positionPercent}%` }}
          >
            {tierLabel(tier)}
          </span>
        ))}
      </div>
    </div>
  );
}
