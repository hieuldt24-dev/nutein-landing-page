"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function CheckoutField({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[13px] font-bold text-ink">{label}</label>
      {children}
      {error ? <span className="text-[12px] font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}

export function CheckoutTextInput({
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors",
        "placeholder:text-text-muted/70",
        "focus:border-primary",
        error ? "border-red-500" : "border-ink/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function CheckoutTextArea({
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors",
        "placeholder:text-text-muted/70",
        "focus:border-primary",
        error ? "border-red-500" : "border-ink/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function CheckoutSelect({
  error,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors",
        "focus:border-primary",
        error ? "border-red-500" : "border-ink/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "bg-[length:12px] bg-[right_14px_center] bg-no-repeat",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23351E29' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
      {...props}
    >
      {children}
    </select>
  );
}
