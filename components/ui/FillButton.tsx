"use client";

import { type ReactNode, type CSSProperties, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "ink" | "white" | "outline-white";

interface FillButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
}

const BASE: Record<Variant, CSSProperties> = {
  ink: {
    background: "rgba(255,255,255,0.92)",
    border: "1.5px solid var(--color-ink)",
    color: "var(--color-ink)",
    backdropFilter: "blur(8px)",
  },
  white: {
    background: "white",
    border: "2px solid white",
    color: "var(--color-primary-deep)",
  },
  "outline-white": {
    background: "transparent",
    border: "2px solid rgba(255,255,255,0.55)",
    color: "white",
  },
};

const HOVERED: Record<Variant, CSSProperties> = {
  ink: { color: "var(--color-bg)" },
  white: { color: "white", borderColor: "var(--color-primary-deep)" },
  "outline-white": { color: "var(--color-primary-deep)", borderColor: "white" },
};

const FILL_BG: Record<Variant, string> = {
  ink: "var(--color-ink)",
  white: "var(--color-primary-deep)",
  "outline-white": "rgba(255,255,255,0.90)",
};

export function FillButton({
  children,
  href,
  onClick,
  variant = "ink",
  className,
}: FillButtonProps) {
  const [hovered, setHovered] = useState(false);

  const rootStyle: CSSProperties = {
    ...BASE[variant],
    ...(hovered ? HOVERED[variant] : {}),
    transition: "color 300ms ease, border-color 300ms ease",
  };

  const fillStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: FILL_BG[variant],
    clipPath: hovered
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
    "relative overflow-hidden rounded-full inline-flex items-center",
    className
  );

  if (href) {
    return (
      <Link href={href} className={base} style={rootStyle} {...events}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={base} style={rootStyle} {...events}>
      {inner}
    </button>
  );
}
