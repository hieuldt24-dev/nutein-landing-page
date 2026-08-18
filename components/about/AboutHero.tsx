"use client";

import Image from "next/image";
import { ABOUT_HERO } from "@/features/about/constants";
import { BounceChars, FadeInOnView } from "@/components/ui/BounceChars";

/**
 * Hero manifesto — pattern Joy Rush About (full-bleed lifestyle + H1 + lead).
 * Token/font Nutein; ảnh `public/images/about.png`.
 */
export default function AboutHero() {
  return (
    <section
      id="about-hero"
      aria-label="Về Nutein — mở đầu"
      className="relative flex min-h-[min(100svh,920px)] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-[120px] md:pt-[130px]"
    >
      <Image
        src={ABOUT_HERO.image}
        alt={ABOUT_HERO.imageAlt}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Overlay đọc chữ hero — ink ấm, không flat đen */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(53,30,41,0.42) 0%, rgba(53,30,41,0.32) 45%, rgba(53,30,41,0.52) 100%)",
        }}
      />

      <div className="relative z-[1] mx-auto max-w-[920px] text-center">
        <FadeInOnView className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
          Về Nutein
        </FadeInOnView>
        <h1 className="font-display text-[clamp(30px,6.2vw,72px)] font-black uppercase leading-tight tracking-[-0.04em] text-[var(--color-bg)]">
          {/* Desktop nowrap tránh orphan; mobile cho xuống dòng — tránh overflow-x */}
          <span className="block md:whitespace-nowrap">
            <BounceChars staggerMs={22}>{ABOUT_HERO.titleLine1}</BounceChars>
          </span>
          <span className="block md:whitespace-nowrap">
            <BounceChars staggerMs={22} delayMs={260}>
              {ABOUT_HERO.titleLine2}
            </BounceChars>
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-[540px] text-[13px] font-bold uppercase leading-relaxed tracking-[0.06em] text-[var(--color-bg)]/85 md:text-sm">
          {ABOUT_HERO.lead}
        </p>
      </div>
    </section>
  );
}
