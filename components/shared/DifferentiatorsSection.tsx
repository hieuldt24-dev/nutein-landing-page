"use client";

import Image from "next/image";
import { RotatingText } from "@/components/ui/RotatingText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import mixingVisual from "@/public/media/MJ.png";

const PREPARATION_STEPS = [
  {
    title: "Cho 01 gói (30g) vào ly hoặc bình lắc",
  },
  {
    title: "Thêm 150–180ml nước ấm (30–50°C)",
  },
  {
    title: "Khuấy hoặc lắc đều và thưởng thức",
  },
];

const USAGE_TIMES = ["Bữa sáng", "Bữa phụ", "Sau vận động", "Khi cần bổ sung Protein"];

export default function DifferentiatorsSection() {
  return (
    <section id="differentiators" className="relative overflow-hidden bg-primary-soft/70 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-[1360px]">
        <SectionHeading eyebrow="Hướng dẫn pha Nutein" className="mb-12 text-[clamp(2.5rem,4.6vw,4.5rem)] tracking-[-0.035em] md:mb-16">
          Pha Nutein trong 3 bước
        </SectionHeading>

        <div className="grid items-center gap-10 md:grid-cols-[minmax(22rem,0.85fr)_minmax(0,1.15fr)] md:gap-24 lg:gap-36">
          <div className="relative mx-auto flex min-h-[27rem] w-full max-w-[32rem] items-center justify-center md:min-h-[36rem]">
            <RotatingText
              text="NUTEIN ✦ DỄ PHA ✦ DỄ UỐNG ✦ DỄ MANG THEO ✦"
              radius={158}
              fontSize={10.5}
              duration={20}
              color="color-mix(in srgb, var(--color-primary-deep) 74%, transparent)"
              className="absolute bottom-0 right-1/2 z-0 translate-x-1/2 md:-right-8 md:bottom-2 md:translate-x-0"
            />
            <div aria-hidden className="absolute z-0 aspect-square w-[92%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary)_42%,transparent)_0%,color-mix(in_srgb,var(--color-primary-deep)_18%,transparent)_42%,transparent_72%)] blur-3xl" />
            <div className="animate-float-slow relative z-[1] h-[25rem] w-[18rem] sm:h-[30rem] sm:w-[21rem] md:h-[34rem] md:w-[24rem]">
              <Image
                src={mixingVisual}
                alt="Hộp Nutein cùng hạt hạnh nhân"
                fill
                priority={false}
                sizes="(max-width: 640px) 18rem, (max-width: 768px) 21rem, 24rem"
                className="scale-[1.3] object-contain [filter:drop-shadow(0_1.5rem_2.75rem_color-mix(in_srgb,var(--color-ink)_18%,transparent))]"
              />
            </div>
          </div>

          <div className="max-w-[40rem]">
            <p className="font-display text-[clamp(1.35rem,2.1vw,2rem)] font-bold leading-snug tracking-[-0.02em] text-ink">
              Một ly Nutein dinh dưỡng, sẵn sàng theo nhịp sống của bạn.
            </p>
            <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-text-body md:text-lg">
              Quy trình pha chế gọn nhẹ được xây dựng để bạn có thể chuẩn bị nhanh, uống ngon và mang theo dễ dàng.
            </p>

            <ol className="mt-8 divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)] md:mt-10">
              {PREPARATION_STEPS.map(({ title }, index) => (
                <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 py-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-4 md:grid-cols-[4rem_minmax(0,1fr)] md:py-5 md:gap-5">
                  <span className="font-display text-xl font-black tabular-nums text-primary-deep/50 md:text-2xl">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-base font-extrabold leading-snug tracking-[-0.015em] text-ink md:text-lg">{title}</h3>
                </li>
              ))}
            </ol>

            <aside className="mt-9 rounded-[var(--radius-lg)] bg-primary-deep px-5 py-4 text-bg md:mt-10 md:max-w-[28rem]">
              <h3 className="font-display text-lg font-extrabold">Thời điểm sử dụng</h3>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm leading-relaxed">
                {USAGE_TIMES.map((time) => <li key={time}>• {time}</li>)}
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
