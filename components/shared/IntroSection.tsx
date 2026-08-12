import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import proteinCard from "../../public/media/4 card task 2 tách/size 3_4/protein tv.png";
import grainsCard from "../../public/media/4 card task 2 tách/size 3_4/ha\u0323t va\u0300 ngu\u0303 co\u0302\u0301c.png";
import fiberCard from "../../public/media/4 card task 2 tách/size 3_4/cha\u0302\u0301t xo\u031b hoa\u0300 tan.png";
import vitaminsCard from "../../public/media/4 card task 2 tách/size 3_4/vitamin khoa\u0301ng cha\u0302\u0301t.png";

const INGREDIENT_CARDS = [
  {
    src: proteinCard,
    alt: "Protein thực vật từ đậu Hà Lan và đậu Gà",
  },
  {
    src: grainsCard,
    alt: "Hạt và ngũ cốc",
  },
  {
    src: fiberCard,
    alt: "Chất xơ hoà tan",
  },
  {
    src: vitaminsCard,
    alt: "Vitamin và khoáng chất",
  },
];

export default function IntroSection() {
  return (
    <section id="san-pham" className="relative overflow-hidden bg-surface px-6 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-8%] top-[8%] size-[min(24rem,52vw)] rounded-full blur-[4.5rem]"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)" }}
      />
      <div className="relative z-[1] mx-auto max-w-[1200px]">
        <SectionHeading
          eyebrow="Thành phần dinh dưỡng"
          align="left"
          className="mb-10 text-[clamp(44px,6.5vw,88px)] tracking-[-0.04em]"
        >
          Một ly Protein{"\n"}Nutein có gì?
        </SectionHeading>

        <p className="mb-8 max-w-[37.5rem] text-base leading-relaxed text-text-muted">
          Khám phá nguồn dinh dưỡng thực vật dồi dào từ nguyên liệu thật, đem đến giải pháp bổ sung đạm an lành cho cuộc sống bận rộn.
        </p>

        <div className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:overflow-visible">
          {INGREDIENT_CARDS.map((card, index) => (
            <article
              key={card.src}
              className="relative aspect-[3/4] w-[260px] shrink-0 snap-start overflow-hidden rounded-[var(--radius-xl)] md:w-auto"
            >
              <Image
                src={card.src}
                alt={card.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 260px, 25vw"
                className="object-cover"
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
