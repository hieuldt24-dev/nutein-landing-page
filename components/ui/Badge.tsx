import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
  {
    variants: {
      color: {
        primary: "bg-primary-soft text-primary-deep",
        sky: "bg-sky text-[#1E4E7A]",
        lime: "bg-lime text-forest",
        sage: "bg-sage/30 text-[#3F4A38]",
        forest: "bg-forest/10 text-forest",
        ink: "bg-white text-ink border border-[color:var(--color-border)]",
      },
      size: {
        sm: "text-xs px-3 py-1",
        md: "text-sm px-3.5 py-1.5",
      },
    },
    defaultVariants: {
      color: "primary",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {}

/** Pill badge dùng cho USP chip, ticker item, ingredient/nutrient badge. */
export function Badge({ className, color, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ color, size }), className)} {...props} />;
}
