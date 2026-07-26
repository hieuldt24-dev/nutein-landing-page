"use client";

import { cn } from "@/lib/utils";

/**
 * Chip lọc — inactive border / active ink (mock UI kit).
 */
export function AdminFilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-bold transition-colors",
        active
          ? "bg-ink text-bg"
          : "border border-ink/15 bg-surface text-text-body hover:border-ink/30 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
