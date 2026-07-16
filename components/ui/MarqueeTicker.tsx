"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTickerProps {
  items: string[];
  className?: string;
  /** Tốc độ cơ bản (px / giây) */
  speed?: number;
  /** Hệ số nhân tối đa khi scroll (vd: 2.5 = nhanh gấp 2.5×) */
  scrollBoost?: number;
}

const STAR_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="shrink-0 opacity-75"><path d="M12 0.5C12.6 7.2 16.8 11.4 23.5 12C16.8 12.6 12.6 16.8 12 23.5C11.4 16.8 7.2 12.6 0.5 12C7.2 11.4 11.4 7.2 12 0.5Z"/></svg>`;

function createItem(text: string): HTMLLIElement {
  const li = document.createElement("li");
  // TEXT — gap — ✦ — gap  → khoảng icon↔text đều hai phía
  li.className =
    "flex items-center gap-6 text-[15px] md:text-base font-extrabold uppercase tracking-[0.14em] text-white whitespace-nowrap";
  const span = document.createElement("span");
  span.textContent = text;
  li.appendChild(span);
  li.insertAdjacentHTML("beforeend", STAR_SVG);
  const star = li.querySelector("svg");
  if (star) {
    (star as SVGElement).style.marginRight = "1.5rem";
  }
  return li;
}

/**
 * Marquee conveyor + scroll boost ngắn.
 * Scroll nhanh → tốc độ tăng tạm thời rồi decay về base.
 */
export function MarqueeTicker({
  items,
  className,
  speed = 52,
  scrollBoost = 2.4,
}: MarqueeTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || items.length === 0) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const rebuild = () => {
      track.replaceChildren();
      items.forEach((text) => track.appendChild(createItem(text)));

      const baseCount = items.length;
      let guard = 0;
      while (
        track.scrollWidth < viewport.offsetWidth * 2 &&
        baseCount > 0 &&
        guard < 40
      ) {
        for (let i = 0; i < baseCount; i++) {
          const clone = track.children[i]!.cloneNode(true) as HTMLElement;
          clone.setAttribute("aria-hidden", "true");
          track.appendChild(clone);
          if (track.scrollWidth >= viewport.offsetWidth * 2) break;
        }
        guard++;
      }
    };

    rebuild();

    if (reduceMotion) {
      track.style.transform = "translate3d(0,0,0)";
      return;
    }

    let offset = 0;
    let last = performance.now();
    let raf = 0;
    /** 0 = tốc độ base; tiến tới ~1 khi scroll → nhân với scrollBoost */
    let boost = 0;
    let lastScrollY = window.scrollY;
    let lastScrollT = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.064);
      last = now;

      // Decay boost về 0 (~280ms half-life cảm giác)
      boost = Math.max(0, boost - dt * 3.2);

      const currentSpeed = speed * (1 + boost * (scrollBoost - 1));
      offset -= currentSpeed * dt;

      let first = track.firstElementChild as HTMLElement | null;
      while (first && -offset >= first.offsetWidth) {
        offset += first.offsetWidth;
        track.appendChild(first);
        first = track.firstElementChild as HTMLElement | null;
      }

      track.style.transform = `translate3d(${offset}px, 0, 0)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onScroll = () => {
      const t = performance.now();
      const dy = Math.abs(window.scrollY - lastScrollY);
      const dtMs = Math.max(t - lastScrollT, 1);
      lastScrollY = window.scrollY;
      lastScrollT = t;

      // velocity px/ms → chuẩn hoá; cap để không tăng đột biến
      const velocity = Math.min(dy / dtMs, 4);
      boost = Math.min(1, boost + velocity * 0.35);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      offset = 0;
      boost = 0;
      track.style.transform = "translate3d(0,0,0)";
      rebuild();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(viewport);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [items, speed, scrollBoost]);

  return (
    <div
      ref={viewportRef}
      className={cn("relative overflow-hidden select-none", className)}
    >
      <ul
        ref={trackRef}
        className="flex w-max items-center will-change-transform"
        aria-label="Điểm nổi bật sản phẩm"
      />
    </div>
  );
}
