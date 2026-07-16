"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BounceChars, FadeInOnView } from "@/components/ui/BounceChars";

interface SectionHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h2" | "h3";
  eyebrow?: string;
  /** "solid" = màu ink bình thường; "outline" = chữ viền rỗng (ghost text), dùng cho heading cỡ đại. */
  variant?: "solid" | "outline";
  align?: "left" | "center";
  /** Bật bounce char (Joy Rush). Default true. */
  bounce?: boolean;
}

/** Heading lớn dùng cho tiêu đề section — bounce per-char + eyebrow fade. */
export function SectionHeading({
  as = "h2",
  eyebrow,
  variant = "solid",
  align = "center",
  bounce = true,
  className,
  children,
  ...props
}: SectionHeadingProps) {
  const Comp = as;
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5",
        align === "center" ? "items-center text-center" : "items-start text-left"
      )}
    >
      {eyebrow && (
        <FadeInOnView className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </FadeInOnView>
      )}
      <Comp
        className={cn(
          "font-black leading-[1.05]",
          variant === "outline"
            ? "text-transparent [-webkit-text-stroke:1.5px_var(--color-ink)] [paint-order:stroke_fill]"
            : "text-ink",
          className
        )}
        {...props}
      >
        {bounce ? <BounceChars>{children}</BounceChars> : children}
      </Comp>
    </div>
  );
}
