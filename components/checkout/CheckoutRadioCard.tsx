import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CheckoutRadioCard({
  checked,
  disabled,
  onChange,
  title,
  description,
  trailing,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  description: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3.5 text-left transition-colors",
        checked ? "border-primary bg-primary/10" : "border-ink/15 bg-surface hover:border-ink/30",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-primary" : "border-ink/30"
        )}
        aria-hidden
      >
        {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-[14px] font-bold text-ink">{title}</span>
          {trailing}
        </span>
        <span className="mt-0.5 block text-[12px] font-medium text-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}
