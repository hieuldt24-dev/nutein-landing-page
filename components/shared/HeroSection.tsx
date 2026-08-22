import Image from "next/image";
import { CtaCluster } from "@/components/ui/CtaCluster";
import productVisual from "@/public/media/MJ.png";

const HERO_CTA_SIZE = 72;
const HERO_CTA_FONT_SIZE = 18;
const HERO_CTA_ICON_SIZE = 26;
const HERO_CTA_LABEL_PADDING = "2.25rem";

function HeroAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-primary-soft),color-mix(in_srgb,var(--color-primary-soft)_62%,var(--color-bg)))]" />
      <div className="hero-section__glow hero-section__glow--center" />
      <div className="hero-section__glow hero-section__glow--corner" />
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(color-mix(in_srgb,var(--color-ink)_3%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--color-ink)_3%,transparent)_1px,transparent_1px)] [background-size:3rem_3rem]" />
    </div>
  );
}

export default function HeroSection() {
  return (
    <section id="hero" aria-label="Hero Nutein Protein thực vật" className="hero-section relative flex min-h-[calc(100svh-2.5rem)] flex-col items-center justify-center overflow-hidden px-6 pb-10 pt-32 sm:pt-36">
      <HeroAtmosphere />

      <div className="relative z-[1] flex w-full max-w-[90rem] flex-col items-center">
        <h1 className="hero-section__headline font-display text-center font-bold uppercase leading-tight tracking-[-0.03em] text-ink">
          Nạp năng lượng
        </h1>
        <p className="hero-section__headline hero-section__headline--accent font-display text-center font-bold uppercase leading-tight tracking-[-0.03em] text-primary-deep">
          Protein thực vật
        </p>

        <div className="hero-section__visual relative mt-2 mb-0 flex aspect-[4/3] w-full max-w-[37rem] items-center justify-center overflow-hidden">
          <div aria-hidden className="absolute z-0 aspect-square w-3/4 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary)_35%,transparent)_0%,transparent_70%)] blur-2xl" />
          <div className="animate-float-slow pointer-events-none relative z-[1] size-full">
            <Image
              src={productVisual}
              alt="Hộp Nutein cùng hạt hạnh nhân"
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 640px) 86vw, (max-width: 900px) 70vw, 37rem"
              className="-translate-y-[3%] scale-[1.35] object-contain [filter:drop-shadow(0_2rem_4rem_color-mix(in_srgb,var(--color-primary-deep)_28%,transparent))]"
            />
          </div>
        </div>

        <div className="relative z-10 -mt-4 animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <CtaCluster
            label="Mua ngay"
            href="#san-pham"
            size={HERO_CTA_SIZE}
            fontSize={HERO_CTA_FONT_SIZE}
            fontWeight={800}
            labelPaddingX={HERO_CTA_LABEL_PADDING}
            iconSize={HERO_CTA_ICON_SIZE}
          />
        </div>
      </div>
    </section>
  );
}
