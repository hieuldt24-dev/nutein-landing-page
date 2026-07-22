"use client";

import Image from "next/image";
import { ABOUT_STORY } from "@/features/about/constants";
import { RotatingText } from "@/components/ui/RotatingText";

function StoryBlock({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3.5 md:gap-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary md:text-[13px]">
        {index}
      </p>
      <h3 className="font-display max-w-[14ch] text-[clamp(32px,4vw,44px)] font-bold leading-[1.08] tracking-[-0.035em] text-ink">
        {title}
      </h3>
      <p className="max-w-[38rem] text-[17px] leading-[1.7] font-medium text-ink/80 md:text-[19px] md:leading-[1.65]">
        {body}
      </p>
    </div>
  );
}

/**
 * Brand statement — media lớn full cột phải;
 * RotatingText nằm sau media, lòi góc dưới-phải.
 */
export default function AboutStory() {
  return (
    <section id="about-story" className="relative bg-bg px-6 py-16 md:py-20 lg:py-24">
      <div className="relative z-[1] mx-auto max-w-[1200px]">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14 xl:gap-16">
          <div className="flex flex-col gap-16 md:gap-20 lg:gap-24">
            <StoryBlock
              index="01"
              title={ABOUT_STORY.storyTitle}
              body={ABOUT_STORY.storyBody}
            />
            <div className="h-px w-20 bg-primary/40 lg:hidden" aria-hidden />
            <StoryBlock
              index="02"
              title={ABOUT_STORY.philosophyTitle}
              body={ABOUT_STORY.philosophyBody}
            />
          </div>

          <div className="relative mx-auto w-full max-w-[560px] overflow-x-clip pb-16 pr-6 md:overflow-visible md:pb-24 md:pr-20 lg:max-w-none">
            <div
              aria-hidden
              className="absolute top-1/2 left-1/2 z-0 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[44px]"
            />

            <div className="relative isolate w-full overflow-visible">
              {/* z thấp hơn media — chỉ phần lòi góc mới thấy */}
              <RotatingText
                radius={152}
                fontSize={12}
                duration={18}
                color="rgba(192,134,53,0.9)"
                className="absolute -right-4 -bottom-10 z-[1] md:-right-20 md:-bottom-20"
              />

              <div className="animate-float-slow relative z-[2] aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[0_0_0_4px_var(--color-primary-deep)] md:rounded-[40px]">
                <Image
                  src={ABOUT_STORY.mainImage}
                  alt={ABOUT_STORY.mainImageAlt}
                  fill
                  sizes="(max-width: 1024px) 90vw, 560px"
                  className="object-cover object-center scale-[1.08]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
