import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface Ingredient {
  amount: string;
  title: string;
  desc: string;
  image: string;
  imageAlt: string;
  /** Nền vùng text — CSS variable token (tránh utility màu hyphen bị miss). */
  panelColor: string;
  badgeColor: string;
}

const INGREDIENTS: Ingredient[] = [
  {
    amount: "20g",
    title: "Protein Thực Vật",
    desc: "Được chiết xuất tinh khiết từ hạt đậu nành hữu cơ, đậu Hà Lan và hạt óc chó, hỗ trợ tái tạo cơ bắp và duy trì năng lượng suốt ngày dài.",
    image: "/images/beans.jpg",
    imageAlt: "Hạt đậu nành và đậu Hà Lan — nguồn protein thực vật",
    panelColor: "var(--color-primary)",
    badgeColor: "var(--color-primary)",
  },
  {
    amount: "1 Tỷ",
    title: "Lợi Khuẩn Probiotics",
    desc: "Bổ sung lượng lớn men vi sinh đường ruột giúp tăng cường hệ miễn dịch, kích thích tiêu hóa khỏe mạnh và ngăn ngừa chứng đầy bụng khó tiêu.",
    image: "/images/yogurt.jpg",
    imageAlt: "Sữa chua — biểu tượng lợi khuẩn probiotics",
    panelColor: "var(--color-forest)",
    badgeColor: "var(--color-forest)",
  },
  {
    amount: "5g",
    title: "Chất Xơ Hòa Tan",
    desc: "Hỗ trợ ổn định đường huyết, tạo cảm giác no lâu tự nhiên, kiểm soát cơn thèm ăn hiệu quả và bảo vệ thành mạch tim mạch khỏe mạnh.",
    image: "/images/apples.jpg",
    imageAlt: "Táo tươi — nguồn chất xơ hòa tan",
    panelColor: "var(--color-sky-deep)",
    badgeColor: "var(--color-sky-deep)",
  },
  {
    amount: "23+",
    title: "Vitamin & Khoáng Chất",
    desc: "Hội tụ đầy đủ dinh dưỡng từ 10 loại rau củ hữu cơ tươi ngon giúp làm sáng da, chống oxy hóa và bù đắp khoáng chất thiết yếu mỗi ngày.",
    image: "/images/vegetables.jpg",
    imageAlt: "Rau củ hữu cơ — nguồn vitamin và khoáng chất",
    panelColor: "var(--color-ink)",
    badgeColor: "var(--color-ink)",
  },
];

export default function IntroSection() {
  return (
    <section id="san-pham" className="relative overflow-hidden bg-surface px-6 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[8%] right-[-8%] h-[380px] w-[380px] rounded-full blur-[70px]"
        style={{ backgroundColor: "rgba(226, 165, 80, 0.1)" }}
      />

      <div className="relative z-[1] mx-auto max-w-[1200px]">
        <SectionHeading
          eyebrow="Thành phần dinh dưỡng"
          align="left"
          className="mb-4 text-[clamp(44px,6.5vw,88px)] tracking-[-0.04em]"
        >
          Một ly Protein
          <br />
          Nutein có gì?
        </SectionHeading>
        <p className="mb-8 max-w-[600px] text-base leading-relaxed text-text-muted">
          Khám phá nguồn dinh dưỡng thực vật dồi dào từ nguyên liệu thật, đem đến giải pháp bổ sung
          đạm an lành cho cuộc sống bận rộn.
        </p>

        <div className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:overflow-visible">
          {INGREDIENTS.map((item, idx) => (
            <article
              key={item.title}
              className="animate-fade-up relative flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-xl)] md:w-auto"
              style={{ animationDelay: `${idx * 0.12}s` }}
            >
              <span
                className="absolute top-3 right-3 z-10 rounded-full bg-surface px-2.5 py-1 text-[11px] font-black tracking-wide uppercase shadow-sm"
                style={{ color: item.badgeColor }}
              >
                {item.amount}
              </span>

              <div className="relative h-44 w-full shrink-0 bg-gray">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 768px) 260px, 25vw"
                  className="object-cover"
                  priority={idx === 0}
                />
              </div>

              <div
                className="flex flex-1 flex-col gap-2 px-6 pt-5 pb-7"
                style={{ backgroundColor: item.panelColor }}
              >
                <h3 className="font-display text-lg leading-tight font-extrabold tracking-[-0.02em] text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-white/80">{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
