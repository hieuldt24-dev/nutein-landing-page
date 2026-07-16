"use client";

import { type ReactNode, type CSSProperties } from "react";
import { Zap, Activity, Heart, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface Ingredient {
  icon: ReactNode;
  amount: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
}

const INGREDIENTS: Ingredient[] = [
  {
    icon: <Zap size={28} strokeWidth={2.2} />,
    amount: "20g",
    title: "Protein Thực Vật",
    desc: "Được chiết xuất tinh khiết từ hạt đậu nành hữu cơ, đậu Hà Lan và hạt óc chó, hỗ trợ tái tạo cơ bắp và duy trì năng lượng suốt ngày dài.",
    color: "var(--color-primary)",
    bg: "var(--color-primary-soft)",
  },
  {
    icon: <Activity size={28} strokeWidth={2.2} />,
    amount: "1 Tỷ",
    title: "Lợi Khuẩn Probiotics",
    desc: "Bổ sung lượng lớn men vi sinh đường ruột giúp tăng cường hệ miễn dịch, kích thích tiêu hóa khỏe mạnh và ngăn ngừa chứng đầy bụng khó tiêu.",
    color: "var(--color-forest)",
    bg: "var(--color-forest)",
  },
  {
    icon: <Heart size={28} strokeWidth={2.2} />,
    amount: "5g",
    title: "Chất Xơ Hòa Tan",
    desc: "Hỗ trợ ổn định đường huyết, tạo cảm giác no lâu tự nhiên, kiểm soát cơn thèm ăn hiệu quả và bảo vệ thành mạch tim mạch khỏe mạnh.",
    color: "var(--color-sky-deep)",
    bg: "var(--color-sky)",
  },
  {
    icon: <Sparkles size={28} strokeWidth={2.2} />,
    amount: "23+",
    title: "Vitamin & Khoáng Chất",
    desc: "Hội tụ đầy đủ dinh dưỡng từ 10 loại rau củ hữu cơ tươi ngon giúp làm sáng da, chống oxy hóa và bù đắp khoáng chất thiết yếu mỗi ngày.",
    color: "var(--color-ink)",
    bg: "var(--color-ink)",
  },
];

export default function IntroSection() {
  return (
    <section id="intro" className="relative overflow-hidden bg-surface py-24 px-6">
      <div
        aria-hidden
        className="absolute top-[8%] right-[-8%] w-[380px] h-[380px] rounded-full blur-[70px] pointer-events-none"
        style={{ backgroundColor: "rgba(226,165,80,0.1)" }}
      />

      <div className="relative z-[1] max-w-[1200px] mx-auto">
        <SectionHeading eyebrow="Thành phần dinh dưỡng" align="left" className="text-[clamp(44px,6.5vw,88px)] tracking-[-0.04em] mb-4">
          Một ly Protein<br />Nutein có gì?
        </SectionHeading>
        <p className="text-text-muted text-base max-w-[600px] mb-8 leading-relaxed">
          Khám phá nguồn dinh dưỡng thực vật dồi dào từ nguyên liệu thật, đem đến giải pháp bổ sung đạm an lành cho cuộc sống bận rộn.
        </p>

        <div className="scrollbar-hide flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:grid md:grid-cols-4 md:overflow-visible">
          {INGREDIENTS.map((item, idx) => (
            <div
              key={idx}
              className="animate-fade-up flex flex-col gap-5 p-8 rounded-[40px] w-[260px] md:w-auto shrink-0 snap-start"
              style={{ animationDelay: `${idx * 0.12}s`, backgroundColor: item.color } as CSSProperties}
            >
              {/* Icon + amount badge */}
              <div className="relative w-fit">
                <div
                  className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center text-white"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  {item.icon}
                </div>
                <span
                  className="absolute -top-2 -right-2 rounded-full px-2.5 py-0.5 text-[11px] font-black whitespace-nowrap shadow-sm"
                  style={{ background: "white", color: item.color }}
                >
                  {item.amount}
                </span>
              </div>
              {/* Text */}
              <div className="flex flex-col gap-2">
                <h3 className="font-display font-extrabold text-lg text-white tracking-[-0.02em] leading-tight">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
