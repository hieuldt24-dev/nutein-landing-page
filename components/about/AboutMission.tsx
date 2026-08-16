"use client";

import Image from "next/image";
import { BounceChars } from "@/components/ui/BounceChars";
import { ABOUT_MISSION } from "@/features/about/constants";
import { cn } from "@/lib/utils";

/** Trái (ảnh trời xanh): cam ấm. Phải (panel primary): sky — đối lập + đỡ nhàm. */
const CORNER_STAR = "/images/element_stars@216x.png";

/**
 * Sao 4 cánh 3D — cam góc trên trái, xanh góc dưới phải.
 * Mobile: giữ hiện nhưng thu nhỏ + đẩy ra góc (không ẩn, không đè chữ).
 */
function CornerStar() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-[2] size-28 sm:size-36 md:size-56 lg:size-[270px]",
        "bottom-0 right-0 translate-x-[32%] translate-y-[42%] md:translate-x-[18%] md:translate-y-[22%]",
      )}
      aria-hidden
    >
      <Image
        src={CORNER_STAR}
        alt=""
        fill
        sizes="(max-width: 768px) 144px, (max-width: 1024px) 224px, 270px"
        className="object-contain drop-shadow-[0_8px_24px_rgba(53,30,41,0.16)]"
      />
    </div>
  );
}

/**
 * Goals — Joy Rush split: trái ảnh | phải primary.
 */
export default function AboutMission() {
  return (
    <section id="about-mission" className="relative z-10 overflow-x-clip">
      <div className="grid min-h-[min(90svh,860px)] lg:grid-cols-2">
        <div className="relative min-h-[280px] overflow-hidden lg:min-h-0">
          <Image
            src={ABOUT_MISSION.image}
            alt={ABOUT_MISSION.imageAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </div>

        <div className="relative flex flex-col justify-between gap-10 bg-primary px-8 py-14 md:gap-12 md:px-12 md:py-16 lg:min-h-[min(90svh,860px)] lg:px-14 lg:py-20">
          <h2 className="relative z-[1] font-display text-[clamp(44px,6.2vw,80px)] font-black uppercase leading-[1.02] tracking-[-0.045em] text-ink">
            <BounceChars staggerMs={22}>
              {ABOUT_MISSION.titleLine1}
              <br />
              {ABOUT_MISSION.titleLine2}
            </BounceChars>
          </h2>

          {/* pr/pb mobile: chừa góc cho sao xanh nhô vào, không đè copy */}
          <p className="relative z-[1] max-w-[42ch] pr-10 pb-8 text-[15px] font-extrabold uppercase leading-[1.55] tracking-[0.04em] text-ink md:pr-0 md:pb-0 md:text-[17px] lg:text-[18px]">
            {ABOUT_MISSION.body}
          </p>
        </div>
      </div>

      <CornerStar />
    </section>
  );
}
