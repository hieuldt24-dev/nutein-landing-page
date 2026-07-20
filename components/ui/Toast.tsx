"use client";

import { Check, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export interface ToastProps {
  id: string | number;
  variant: ToastVariant;
  message: string;
  description?: string;
  onDismiss: () => void;
}

const VARIANT_ICON = {
  success: Check,
  error: CircleAlert,
  info: Info,
} as const;

const VARIANT_ICON_CLASS: Record<ToastVariant, string> = {
  success: "text-primary",
  error: "text-danger",
  info: "text-ink",
};

/**
 * Toast chrome Nutein — icon stroke đơn sắc, viền mảnh, không glow/badge.
 * Dùng qua `notify.*` (`lib/toast.tsx`) + Sonner `toast.custom`.
 */
export function Toast({
  variant,
  message,
  description,
  onDismiss,
}: ToastProps) {
  const Icon = VARIANT_ICON[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-[min(340px,calc(100vw-2rem))] items-start gap-3 rounded-[var(--radius-md)] border border-ink/10 bg-surface p-3.5 shadow-sm"
      )}
    >
      <Icon
        size={20}
        strokeWidth={2.2}
        aria-hidden
        className={cn("mt-0.5 shrink-0", VARIANT_ICON_CLASS[variant])}
      />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {message}
        </p>
        {description ? (
          <p className="mt-1 text-[13px] font-medium leading-snug text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        className="shrink-0 cursor-pointer rounded-full p-0.5 text-ink/50 transition-colors hover:text-ink"
      >
        <X size={16} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
