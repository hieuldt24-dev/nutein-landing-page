import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";

// Ảnh host trên Cloudinary (cloud của project, xem next.config.ts remotePatterns)
// — trước đây import tĩnh từ public/media/, nhưng tên file gốc (từ macOS) lưu
// dạng Unicode NFD trong khi mọi tham chiếu trong code là NFC, khiến Node/trình
// duyệt không khớp byte và luôn 404. Chuyển hẳn sang Cloudinary để tránh cả lớp
// bug encoding này.
const INGREDIENT_CARDS = [
  {
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257087/nutein/products/intro-70726f746569.png",
    alt: "Protein thực vật từ đậu Hà Lan và đậu Gà",
  },
  {
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257086/nutein/products/intro-6861cca37420.png",
    alt: "Hạt và ngũ cốc",
  },
  {
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257131/nutein/products/intro-fiber.png",
    alt: "Chất xơ hoà tan",
  },
  {
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257088/nutein/products/intro-766974616d69.png",
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

        <div className="-mx-6 md:mx-0">
          <div className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {INGREDIENT_CARDS.map((card, index) => (
              <article
                key={card.alt}
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
      </div>
    </section>
  );
}
