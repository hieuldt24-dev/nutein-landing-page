"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ShoppingBag } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";
import { cn } from "@/lib/utils";

/**
 * FAB góc dưới-phải:
 * - Scroll-to-top: mọi viewport — slide từ mép phải khi `#navbar` khỏi view
 * - Cart: chỉ desktop (`md+`) — mobile dùng cart pill trên header (Joy Rush)
 */
export function FloatingActionDock() {
  const { open } = useCartDrawer();
  const { lineCount } = useCartStore();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const navbar = document.getElementById("navbar");
    if (!navbar) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollTop(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(navbar);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
      <div
        className={cn(
          "transition-transform duration-300 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          showScrollTop
            ? "pointer-events-auto translate-x-0"
            : "pointer-events-none translate-x-[calc(100%+1.25rem)] md:translate-x-[calc(100%+2rem)]",
        )}
        aria-hidden={!showScrollTop}
      >
        <FillButton
          variant="cream"
          onClick={scrollToTop}
          tabIndex={showScrollTop ? 0 : -1}
          aria-label="Lên đầu trang"
          className="size-14 items-center justify-center p-0"
        >
          <ArrowUp size={22} strokeWidth={2.2} aria-hidden />
        </FillButton>
      </div>

      <div className="pointer-events-auto relative hidden md:block">
        <FillButton
          variant="cream"
          onClick={open}
          aria-label={
            lineCount > 0
              ? `Mở giỏ hàng, ${lineCount} dòng sản phẩm`
              : "Mở giỏ hàng"
          }
          className="size-14 items-center justify-center p-0"
        >
          <ShoppingBag size={22} strokeWidth={2.2} aria-hidden />
        </FillButton>
        {lineCount > 0 ? (
          <span className="pointer-events-none absolute -top-1 -right-1 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-extrabold text-[var(--color-bg)]">
            {lineCount > 99 ? "99+" : lineCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}
