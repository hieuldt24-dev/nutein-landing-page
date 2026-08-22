"use client";

import { ABOUT_COMMITMENT } from "@/features/about/constants";
import { BounceChars, FadeInOnView } from "@/components/ui/BounceChars";
import { cn } from "@/lib/utils";

type Tone = (typeof ABOUT_COMMITMENT.points)[number]["tone"];

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary text-ink",
  sky: "bg-sky text-ink",
  lime: "bg-lime text-ink",
  sage: "bg-sage text-ink",
};

/**
 * Cam kết §3.6 (3) — heading ngắn 1–2 dòng, không badge trùng card,
 * panel màu phụ thay lưới viền trắng nhàm.
 */
export default function AboutCommitment() {
  return (
    <section id="about-commitment" className="relative overflow-hidden bg-bg px-6 py-20 md:py-28">
      <div className="relative z-[1] mx-auto max-w-[1100px]">
        <div className="mb-12 max-w-[720px] md:mb-16">
          <FadeInOnView className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
            {ABOUT_COMMITMENT.eyebrow}
          </FadeInOnView>
          <h2 className="font-display text-[clamp(36px,5.5vw,64px)] font-black uppercase leading-tight tracking-[-0.04em] text-ink">
            <BounceChars>{ABOUT_COMMITMENT.title}</BounceChars>
          </h2>
          <p className="mt-4 max-w-[480px] text-base leading-relaxed text-text-muted">
            {ABOUT_COMMITMENT.intro}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {ABOUT_COMMITMENT.points.map((point, idx) => (
            <article
              key={point.title}
              className={cn(
                "animate-fade-up flex min-h-[200px] flex-col justify-between gap-8 rounded-[28px] px-6 py-7 md:rounded-[32px] md:px-7 md:py-8",
                TONE_CLASS[point.tone]
              )}
              style={{ animationDelay: `${idx * 0.08}s` }}
            >
              <span className="font-display text-[22px] font-black tabular-nums tracking-[-0.02em] opacity-35">
                0{idx + 1}
              </span>
              <div>
                <h3 className="font-display mb-2 text-lg font-extrabold tracking-[-0.02em] md:text-xl">
                  {point.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed opacity-85">{point.desc}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 max-w-[520px] border-l-4 border-primary pl-5 text-sm leading-relaxed text-text-muted">
          {ABOUT_COMMITMENT.certificationsNote}
        </p>
      </div>
    </section>
  );
}
