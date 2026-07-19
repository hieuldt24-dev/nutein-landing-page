"use client";

import Image from "next/image";
import { ABOUT_STORY } from "@/features/about/constants";
import { RotatingText } from "@/components/ui/RotatingText";

/**
 * Brand statement — trái = câu chuyện + triết lý;
 * phải = ảnh bounce + RotatingText phía sau (pattern Differentiators).
 */
export default function AboutStory() {
  return (
    <section id="about-story" className="relative overflow-hidden bg-bg px-6 py-20 md:py-28">
      <div className="relative z-[1] mx-auto max-w-[1200px]">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10 xl:gap-16">
          <div className="flex flex-col gap-10 md:gap-12">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                01 — {ABOUT_STORY.storyTitle}
              </p>
              <p className="font-display text-[clamp(22px,2.8vw,32px)] font-black leading-[1.2] tracking-[-0.03em] text-ink">
                {ABOUT_STORY.storyBody}
              </p>
            </div>
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                02 — {ABOUT_STORY.philosophyTitle}
              </p>
              <p className="font-display text-[clamp(22px,2.8vw,32px)] font-black leading-[1.2] tracking-[-0.03em] text-ink">
                {ABOUT_STORY.philosophyBody}
              </p>
            </div>
          </div>

          <div className="relative mx-auto flex h-[360px] w-full max-w-[480px] items-center justify-center overflow-visible md:h-[480px] lg:max-w-none">
            <div
              aria-hidden
              className="absolute z-0 h-[70%] w-[70%] rounded-full blur-[40px]"
              style={{
                background: "radial-gradient(circle, rgba(226,165,80,0.28) 0%, transparent 70%)",
              }}
            />

            <RotatingText
              radius={128}
              fontSize={10.5}
              duration={18}
              color="rgba(192,134,53,0.75)"
              className="absolute right-[-12px] bottom-[-12px] z-[1] md:right-[-20px] md:bottom-[-16px]"
            />

            <div
              className="animate-float-slow relative z-[2] aspect-[4/5] w-[82%] overflow-hidden rounded-[32px] md:rounded-[40px]"
              style={{ boxShadow: "0 0 0 5px var(--color-primary-deep)" }}
            >
              <Image
                src={ABOUT_STORY.mainImage}
                alt={ABOUT_STORY.mainImageAlt}
                fill
                sizes="(max-width: 1024px) 80vw, 420px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
