"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ABOUT_PROCESS } from "@/features/about/constants";
import { BounceChars } from "@/components/ui/BounceChars";
import { cn } from "@/lib/utils";

type Tone = (typeof ABOUT_PROCESS.panels)[number]["tone"];

/** Dùng đủ palette phụ Nutein — tránh chỉ caramel/ink. */
const TONE_CLASS: Record<Tone, { card: string; muted: string }> = {
  primary: {
    card: "bg-primary text-ink",
    muted: "text-ink/75",
  },
  sky: {
    card: "bg-sky text-ink",
    muted: "text-ink/70",
  },
  forest: {
    card: "bg-forest text-[var(--color-bg)]",
    muted: "text-[var(--color-bg)]/80",
  },
  lime: {
    card: "bg-lime text-ink",
    muted: "text-ink/70",
  },
  sage: {
    card: "bg-sage text-ink",
    muted: "text-ink/70",
  },
  ink: {
    card: "bg-ink text-[var(--color-bg)]",
    muted: "text-[var(--color-bg)]/75",
  },
};

function ProcessCard({
  panel,
}: {
  panel: (typeof ABOUT_PROCESS.panels)[number];
}) {
  const tone = TONE_CLASS[panel.tone];
  return (
    <article
      className={cn(
        "about-process-card w-full max-w-[340px] rounded-[28px] px-6 py-8 shadow-md md:max-w-[360px] md:rounded-[32px] md:px-8 md:py-10",
        tone.card
      )}
      style={{ "--r": `${panel.rotate}deg` } as CSSProperties}
    >
      <h3 className="font-display mb-2 text-[clamp(22px,2.8vw,30px)] font-black uppercase leading-[1.05] tracking-[-0.03em]">
        {panel.headline}
      </h3>
      <p className={cn("mb-3 text-sm font-bold", tone.muted)}>{panel.name}</p>
      <p className={cn("text-[13.5px] leading-relaxed md:text-sm", tone.muted)}>{panel.desc}</p>
    </article>
  );
}

function ProcessHeading() {
  return (
    <div className="flex max-w-[min(92vw,640px)] flex-col items-center px-4 text-center">
      <span
        aria-hidden
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-ink md:mb-6 md:h-14 md:w-14"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0.5C12.6 7.2 16.8 11.4 23.5 12C16.8 12.6 12.6 16.8 12 23.5C11.4 16.8 7.2 12.6 0.5 12C7.2 11.4 11.4 7.2 12 0.5Z" />
        </svg>
      </span>
      <h2 className="font-display text-[clamp(48px,9vw,104px)] font-black uppercase leading-[0.9] tracking-[-0.05em] text-ink">
        <BounceChars staggerMs={22}>
          {ABOUT_PROCESS.titleLine1}
          <br />
          {ABOUT_PROCESS.titleLine2}
        </BounceChars>
      </h2>
    </div>
  );
}

function CardTrack({
  trackRef,
  className,
}: {
  trackRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={trackRef}
      className={cn(
        "mx-auto flex w-full max-w-[1200px] flex-col gap-16 px-3 sm:gap-20 sm:px-5 md:gap-28 lg:gap-32",
        className
      )}
    >
      {ABOUT_PROCESS.panels.map((panel, idx) => {
        const onLeft = idx % 2 === 0;
        return (
          <div
            key={panel.name}
            className={cn(
              "flex w-full",
              // Đẩy sát mép trái/phải — để trống giữa cho heading
              onLeft ? "justify-start" : "justify-end",
              onLeft ? "pr-[28%] sm:pr-[36%] md:pr-[42%]" : "pl-[28%] sm:pl-[36%] md:pl-[42%]",
              // Stagger dọc: card phải lệch thêm một nhịp
              !onLeft && "mt-6 md:mt-10"
            )}
          >
            <ProcessCard panel={panel} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Quy trình — Joy Rush FUNCTIONALS:
 * sticky pin + heading lớn giữa + card lệch 2 mép (palette phụ), scroll trượt lên.
 */
export default function AboutProcess() {
  const spacerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const spacer = spacerRef.current;
    const track = trackRef.current;
    if (!spacer || !track) return;

    let raf = 0;
    const update = () => {
      const scrollable = spacer.offsetHeight - window.innerHeight;
      if (scrollable <= 0) {
        track.style.transform = "translate3d(0,0,0)";
        return;
      }
      const progress = Math.min(1, Math.max(0, -spacer.getBoundingClientRect().top / scrollable));
      const maxY = Math.max(0, track.scrollHeight - window.innerHeight * 0.4);
      track.style.transform = `translate3d(0, ${-progress * maxY}px, 0)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <section id="about-process" className="relative overflow-hidden bg-bg py-24">
        <div className="mx-auto mb-16 flex justify-center">
          <ProcessHeading />
        </div>
        <CardTrack />
      </section>
    );
  }

  const spacerVh = 100 + ABOUT_PROCESS.panels.length * 80;

  return (
    <section
      id="about-process"
      ref={spacerRef}
      className="relative bg-bg"
      style={{ height: `${spacerVh}vh` }}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <ProcessHeading />
        </div>

        <CardTrack
          trackRef={trackRef}
          className="relative z-10 will-change-transform pt-[90vh] pb-[45vh]"
        />
      </div>
    </section>
  );
}
