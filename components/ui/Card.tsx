import * as React from "react";
import { cn } from "@/lib/utils";

/** Card viền mảnh + radius lớn — dùng cho testimonial/product/persona card. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface border border-[color:var(--color-border)] rounded-xl shadow-sm",
        className
      )}
      {...props}
    />
  );
}
