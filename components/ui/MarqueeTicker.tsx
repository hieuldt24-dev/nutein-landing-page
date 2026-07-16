import * as React from "react";
import { Asterisk } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarqueeTickerProps {
  items: string[];
  className?: string;
}

/** Dải chữ chạy ngang vô hạn — dùng cho USP rotating ticker (dưới Hero),
 *  phân cách bằng icon sunburst giống reference thay vì ký tự ✦. */
export function MarqueeTicker({ items, className }: MarqueeTickerProps) {
  return (
    <div className={cn("relative overflow-hidden select-none", className)}>
      <div className="flex w-max animate-marquee">
        {[0, 1].map((dup) => (
          <ul key={dup} className="flex items-center shrink-0" aria-hidden={dup === 1}>
            {items.map((item, idx) => (
              <li
                key={`${dup}-${idx}`}
                className="flex items-center gap-2 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white whitespace-nowrap"
              >
                <Asterisk aria-hidden size={14} strokeWidth={2.5} className="text-white/70 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
