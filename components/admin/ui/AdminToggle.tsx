"use client";

import { cn } from "@/lib/utils";

/**
 * Toggle caramel — mock UI kit.
 */
export function AdminToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-[30px] w-[52px] shrink-0 cursor-pointer items-center rounded-full p-[3px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "justify-end bg-primary" : "justify-start bg-ink/15",
      )}
    >
      <span className="size-6 rounded-full bg-surface shadow-sm" />
    </button>
  );
}
