"use client";

import { type ReactNode, type CSSProperties, type MouseEvent, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "ink" | "ink-solid" | "cream" | "white" | "outline-white";

interface FillButtonProps {
  children: ReactNode;
  href?: string;
  /** Khi truyền kèm `href`, gọi handler này thay vì điều hướng (dùng `e.preventDefault()` trong handler nếu cần chặn điều hướng). */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  variant?: Variant;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  tabIndex?: number;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
}

/** Dùng longhand border* — tránh conflict với `borderColor` khi hover (React warning). */
const BASE: Record<Variant, CSSProperties> = {
  ink: {
    background: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "var(--color-ink)",
    color: "var(--color-ink)",
    backdropFilter: "blur(8px)",
  },
  /** Ngược `ink`: nền tối sẵn, hover fill sáng (dùng cho CTA trong CartDrawer). */
  "ink-solid": {
    background: "var(--color-ink)",
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "var(--color-ink)",
    color: "var(--color-bg)",
  },
  /** Nền kem → hover fill primary (FAB Cart…). */
  cream: {
    background: "var(--color-bg)",
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "var(--color-ink)",
    color: "var(--color-ink)",
  },
  white: {
    background: "white",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "white",
    color: "var(--color-primary-deep)",
  },
  "outline-white": {
    background: "transparent",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.55)",
    color: "white",
  },
};

const HOVERED: Record<Variant, CSSProperties> = {
  ink: { color: "var(--color-bg)" },
  "ink-solid": { color: "var(--color-ink)" },
  cream: { color: "var(--color-bg)", borderColor: "var(--color-primary)" },
  white: { color: "white", borderColor: "var(--color-primary-deep)" },
  "outline-white": { color: "var(--color-primary-deep)", borderColor: "white" },
};

const FILL_BG: Record<Variant, string> = {
  ink: "var(--color-ink)",
  "ink-solid": "var(--color-bg)",
  cream: "var(--color-primary)",
  white: "var(--color-primary-deep)",
  "outline-white": "rgba(255,255,255,0.90)",
};

export function FillButton({
  children,
  href,
  onClick,
  variant = "ink",
  className,
  type = "button",
  disabled = false,
  tabIndex,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
}: FillButtonProps) {
  const [hovered, setHovered] = useState(false);
  const showHover = hovered && !disabled;

  const rootStyle: CSSProperties = {
    ...BASE[variant],
    ...(showHover ? HOVERED[variant] : {}),
    transition: "color 300ms ease, border-color 300ms ease",
  };

  const fillStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: FILL_BG[variant],
    clipPath: showHover
      ? "circle(150% at 50% 50%)"
      : "circle(0% at 50% 50%)",
    transition: "clip-path 400ms cubic-bezier(0.165, 0.84, 0.44, 1)",
    pointerEvents: "none",
  };

  const events = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  const inner = (
    <>
      <span aria-hidden style={fillStyle} />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </>
  );

  const base = cn(
    "relative inline-flex cursor-pointer items-center overflow-hidden rounded-full",
    disabled && "pointer-events-none cursor-not-allowed opacity-50",
    className
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={base}
        style={rootStyle}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        {...events}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={base}
      style={rootStyle}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      {...events}
    >
      {inner}
    </button>
  );
}
