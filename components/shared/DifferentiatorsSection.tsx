"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { Leaf, Award, CheckCircle } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { CtaCluster } from "@/components/ui/CtaCluster";
import { StarRating } from "@/components/ui/StarRating";
import { RotatingText } from "@/components/ui/RotatingText";

interface Difference {
  icon: ReactNode;
  title: string;
  desc: string;
  tag: string;
}

const DIFFERENCES: Difference[] = [
  {
    icon: <Leaf size={26} strokeWidth={2.2} />,
    title: "100% Nguyên Liệu Thật (Real Food)",
    desc: "Nói không với bột sữa động vật, chất độn rẻ tiền và hương liệu hóa học. Vị ngọt thanh tao của Nutein hoàn toàn từ cỏ ngọt Stevia và các loại hạt tự nhiên, mang lại hương vị ngậy bùi đặc trưng mà không ngấy.",
    tag: "Định vị sạch",
  },
  {
    icon: <Award size={26} strokeWidth={2.2} />,
    title: "Chiết Xuất Enzyme Hấp Thu Nhanh",
    desc: "Ứng dụng công nghệ thủy phân bằng enzyme thực vật tiên tiến, phân tách các chuỗi đạm lớn thành peptide siêu nhỏ. Giúp cơ thể hấp thu trọn vẹn chỉ sau 30 phút mà không gây nóng trong hay chướng bụng khó chịu.",
    tag: "Khoa học đột phá",
  },
  {
    icon: <CheckCircle size={26} strokeWidth={2.2} />,
    title: "Canh Tác Hữu Cơ & Truy Xuất Rõ Ràng",
    desc: "Toàn bộ nguyên liệu hạt đậu nành, đậu Hà Lan, óc chó và rau củ quả đều được tuyển chọn kỹ càng từ các nông trại sạch đạt tiêu chuẩn hữu cơ, cam kết Non-GMO và tuyệt đối không tồn dư hóa chất bảo vệ thực vật.",
    tag: "Cam kết 100% Organic",
  },
];

export default function DifferentiatorsSection() {
  return (
    <section id="differentiators" className="relative overflow-hidden bg-primary-soft/40 py-24 px-6">
      <div
        aria-hidden
        className="absolute bottom-[-5%] left-[-6%] w-[400px] h-[400px] rounded-full blur-[80px] pointer-events-none"
        style={{ backgroundColor: "rgba(226,165,80,0.1)" }}
      />

      <div className="relative z-[1] max-w-[1200px] mx-auto">
        <SectionHeading eyebrow="Triết lý phát triển" className="text-[clamp(40px,6.5vw,92px)] tracking-[-0.03em] mb-16">
          Vì sao Protein Nutein<br />khác biệt?
        </SectionHeading>

        {/* Cụm ảnh + quote — 1 cột mobile, 2 cột desktop (không inline grid — tránh đè CSS). */}
        <div className="diff-brand mb-20 grid grid-cols-1 items-center gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          {/* Product image + rotating text ring ở góc sau */}
          <div className="diff-frame-cluster relative mx-auto flex h-[360px] w-full max-w-[320px] items-center justify-center overflow-visible md:mx-0 md:h-[500px] md:max-w-none">
            {/* Ambient glow */}
            <div
              aria-hidden
              className="absolute z-0 h-[70%] w-[70%] rounded-full blur-[40px]"
              style={{ background: "radial-gradient(circle, rgba(226,165,80,0.28) 0%, transparent 70%)" }}
            />

            {/* Rotating text ring — z-[1], góc dưới phải, nằm sau ảnh */}
            <RotatingText
              radius={130}
              fontSize={10.5}
              duration={18}
              color="rgba(192,134,53,0.75)"
              className="absolute right-[-20px] bottom-[-16px] z-[1]"
            />

            {/* Product visual — z-[2] để nổi trên vòng chữ */}
            <div className="relative z-[2] aspect-square w-[84%] animate-float-slow">
              <Image
                src="/images/herosection.png"
                alt="Nutein Protein thực vật"
                fill
                sizes="(max-width: 900px) 55vw, 300px"
                className="object-contain"
                style={{
                  mixBlendMode: "multiply",
                  filter: "drop-shadow(0 20px 48px rgba(192,134,53,0.3))",
                  transform: "scale(1.08)",
                }}
              />
            </div>
          </div>
          <div>
            <p className="font-display mb-6 text-xl leading-snug tracking-[-0.01em] text-ink md:text-2xl">
              &ldquo;Chúng tôi tin rằng cơ thể bạn xứng đáng nhận được nguồn dinh dưỡng lành mạnh nhất. Không chỉ cung cấp năng lượng sạch, Nutein là lời cam kết bền vững cho sức khỏe của bạn và hệ sinh thái thiên nhiên.&rdquo;
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <CtaCluster label="Về chúng tôi" href="/about" size={44} iconSize={18} />
              <StarRating
                rating={4.9}
                label="50,000+ đánh giá"
                size={24}
                interactive
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          {DIFFERENCES.map((item, idx) => (
            <div
              key={idx}
              className="diff-row group animate-fade-up grid grid-cols-[2.5rem_3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-t border-[color:var(--color-border)] py-9 transition-colors duration-300 md:grid-cols-[88px_80px_1.6fr_auto] md:gap-6"
              style={{ animationDelay: `${idx * 0.12}s` }}
            >
              <span className="font-display text-[26px] font-black tracking-[-0.02em] text-primary-deep/40 tabular-nums">
                0{idx + 1}
              </span>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-deep shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1.5 group-hover:rotate-6 group-hover:shadow-md md:h-20 md:w-20">
                {item.icon}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-text-body">{item.desc}</p>
              </div>
              <Badge color="primary" size="md" className="hidden justify-self-end tracking-[0.06em] uppercase md:inline-flex">
                {item.tag}
              </Badge>
            </div>
          ))}
          <div className="border-t border-[color:var(--color-border)]" />
        </div>
      </div>

    </section>
  );
}
