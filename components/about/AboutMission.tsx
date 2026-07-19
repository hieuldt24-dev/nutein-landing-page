"use client";

import Image from "next/image";
import { BounceChars } from "@/components/ui/BounceChars";
import { ABOUT_MISSION } from "@/features/about/constants";
import { cn } from "@/lib/utils";

/** Sparkle 4 cánh hình thoi — motif chuẩn Nutein. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0.5C12.6 7.2 16.8 11.4 23.5 12C16.8 12.6 12.6 16.8 12 23.5C11.4 16.8 7.2 12.6 0.5 12C7.2 11.4 11.4 7.2 12 0.5Z" />
    </svg>
  );
}

/**
 * To, gần góc — lộ ~¾–⅘ hình thoi (đủ đọc 4 cánh + có presence).
 * Chỉ cắt nhẹ cánh dưới; không crop ½ (tránh giống bo góc).
 */
function CornerSparkle({ side }: { side: "left" | "right" }) {
  return (
    <Sparkle
      className={cn(
        "pointer-events-none absolute bottom-0 z-[2] size-40 text-white md:size-52 lg:size-64",
        "translate-y-[18%]",
        side === "left" ? "left-0 -translate-x-[15%]" : "right-0 translate-x-[15%]",
        "drop-shadow-[0_8px_24px_rgba(53,30,41,0.18)]"
      )}
    />
  );
}

/**
 * Goals — Joy Rush split: trái ảnh | phải primary.
 */
export default function AboutMission() {
  return (
    <section id="about-mission" className="relative overflow-hidden">
      <div className="grid min-h-[min(90svh,860px)] lg:grid-cols-2">
        <div className="relative min-h-[280px] lg:min-h-0">
          <Image
            src={ABOUT_MISSION.image}
            alt={ABOUT_MISSION.imageAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </div>

        <div className="relative flex flex-col justify-between gap-10 bg-primary px-8 py-14 md:gap-12 md:px-12 md:py-16 lg:min-h-[min(90svh,860px)] lg:px-14 lg:py-20">
          <h2 className="relative z-[1] font-display text-[clamp(36px,4.8vw,64px)] font-black uppercase leading-[1.05] tracking-[-0.04em] text-ink">
            <BounceChars staggerMs={22}>
              {ABOUT_MISSION.titleLine1}
              <br />
              {ABOUT_MISSION.titleLine2}
            </BounceChars>
          </h2>

          <p className="relative z-[1] max-w-[34ch] text-[13px] font-extrabold uppercase leading-relaxed tracking-[0.05em] text-ink md:text-[14px]">
            {ABOUT_MISSION.body}
          </p>
        </div>
      </div>

      <CornerSparkle side="left" />
      <CornerSparkle side="right" />
    </section>
  );
}
