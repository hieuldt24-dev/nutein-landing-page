"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
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

/**
 * Joy Rush `.b-functionals__card`:
 * portrait ~34.8×40.7rem, rotate ±2°, flex column, ingredient đẩy đáy.
 */
function ProcessCard({
  panel,
}: {
  panel: (typeof ABOUT_PROCESS.panels)[number];
}) {
  const tone = TONE_CLASS[panel.tone];
  return (
    <article
      className={cn(
        "about-process-card flex w-[min(100%,400px)] max-w-full flex-col sm:w-[clamp(280px,28vw,400px)]",
        "h-auto min-h-[320px] rounded-[var(--radius-lg)] p-6 shadow-md sm:h-[clamp(351px,32.7vw,468px)] md:rounded-[22px] md:p-7",
        tone.card
      )}
      style={{ "--r": `${panel.rotate}deg` } as CSSProperties}
    >
      <h3 className="font-display max-w-[94%] text-[clamp(34px,3.8vw,50px)] font-black uppercase leading-[0.92] tracking-[-0.04em]">
        {panel.headline}
      </h3>
      <p className={cn("mt-auto text-lg font-bold md:text-xl", tone.muted)}>{panel.name}</p>
      <p className={cn("mt-2.5 text-lg leading-snug md:text-[21px] md:leading-[1.4]", tone.muted)}>
        {panel.desc}
      </p>
    </article>
  );
}

function ProcessHeading() {
  return (
    /* JR heading ~60% viewport rộng — Nutein trước max-w 640px nên hai bên heading trống */
    <div className="flex w-full max-w-[min(96vw,920px)] flex-col items-center px-4 text-center">
      <Image
        aria-hidden
        src="/images/favicon-color-3232-10x_2.svg"
        alt=""
        width={48}
        height={48}
        className="mb-5 h-12 w-12 md:mb-6 md:h-14 md:w-14"
      />
      <h2 className="font-display w-full text-[clamp(56px,10.5vw,120px)] font-black uppercase leading-[0.88] tracking-[-0.05em] text-ink">
        <BounceChars staggerMs={22}>
          {ABOUT_PROCESS.titleLine1}
          <br />
          {ABOUT_PROCESS.titleLine2}
        </BounceChars>
      </h2>
    </div>
  );
}

/**
 * Joy Rush align pattern:
 * 3n+1 → flex-start (trái), 3n+2 → flex-end (phải), 3n → center (có thể đè heading).
 */
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
        /* Full viewport như JR .wrapper — không max-w 1200 (tạo lề trống hai bên) */
        "mx-auto flex w-full flex-col gap-8 px-3 sm:gap-9 md:gap-10",
        className
      )}
    >
      {ABOUT_PROCESS.panels.map((panel, idx) => {
        const slot = idx % 3; // 0 left, 1 right, 2 center
        return (
          <div
            key={panel.name}
            className={cn(
              "flex w-full",
              slot === 0 && "justify-start",
              slot === 1 && "justify-end",
              slot === 2 && "justify-center"
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
 * sticky pin + heading giữa + card portrait lệch trái/phải/giữa, scroll trượt lên.
 * Bật mọi viewport (trừ prefers-reduced-motion); overflow-x-clip chặn kéo ngang.
 */
export default function AboutProcess() {
  const spacerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [usePinnedScroll, setUsePinnedScroll] = useState(false);

  useEffect(() => {
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setUsePinnedScroll(!motionMq.matches);
    };
    sync();
    motionMq.addEventListener("change", sync);
    return () => {
      motionMq.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!usePinnedScroll) return;
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
  }, [usePinnedScroll]);

  /* Reduce-motion: stack thường, không pin. */
  if (!usePinnedScroll) {
    return (
      <section id="about-process" className="relative overflow-x-clip bg-bg py-20 md:py-24">
        <div className="mx-auto mb-12 flex justify-center md:mb-16">
          <ProcessHeading />
        </div>
        <CardTrack className="px-4" />
      </section>
    );
  }

  const spacerVh = 100 + ABOUT_PROCESS.panels.length * 80;

  return (
    <section
      id="about-process"
      ref={spacerRef}
      className="relative overflow-x-clip bg-bg"
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
