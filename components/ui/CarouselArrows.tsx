"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarouselArrowsProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  /** Khoảng cách cuộn mỗi lần bấm (px). Mặc định 1 "card" ~ 300px. */
  scrollStep?: number;
}

/**
 * 2 nút mũi tên tròn viền ink (prev/next) đặt cạnh heading, điều khiển 1 track
 * cuộn ngang — đúng pattern carousel control của reference (product-grid,
 * testimonials). `targetRef` là ref của track cần cuộn.
 */
export function CarouselArrows({ targetRef, className, scrollStep = 300 }: CarouselArrowsProps) {
  const scrollBy = (dir: 1 | -1) => {
    targetRef.current?.scrollBy({ left: dir * scrollStep, behavior: "smooth" });
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Xem mục trước"
        className="w-11 h-11 rounded-full border-[1.5px] border-ink text-ink flex items-center justify-center transition-colors duration-200 hover:bg-ink hover:text-white"
      >
        <ArrowLeft size={18} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Xem mục tiếp theo"
        className="w-11 h-11 rounded-full border-[1.5px] border-ink text-ink flex items-center justify-center transition-colors duration-200 hover:bg-ink hover:text-white"
      >
        <ArrowRight size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
