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

        {/* Cụm ảnh khung mây/bông hoa (cloud) — đúng motif collage của reference */}
        <div className="diff-brand grid gap-10 md:gap-16 items-center mb-20" style={{ gridTemplateColumns: "0.9fr 1.1fr" }}>
          {/* Product image + rotating text ring ở góc sau */}
          <div className="diff-frame-cluster relative h-[360px] md:h-[500px] flex items-center justify-center overflow-visible">
            {/* Ambient glow */}
            <div
              aria-hidden
              className="absolute w-[70%] h-[70%] rounded-full blur-[40px] z-0"
              style={{ background: "radial-gradient(circle, rgba(226,165,80,0.28) 0%, transparent 70%)" }}
            />

            {/* Rotating text ring — z-[1], góc dưới phải, nằm sau ảnh */}
            <RotatingText
              radius={130}
              fontSize={10.5}
              duration={18}
              color="rgba(192,134,53,0.75)"
              className="absolute bottom-[-16px] right-[-20px] z-[1]"
            />

            {/* Product visual — z-[2] để nổi trên vòng chữ */}
            <div
              className="relative w-[84%] aspect-square z-[2] animate-float-slow"
            >
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
            <p className="font-display text-xl md:text-2xl text-ink leading-snug tracking-[-0.01em] mb-6">
              &ldquo;Chúng tôi tin rằng cơ thể bạn xứng đáng nhận được nguồn dinh dưỡng lành mạnh nhất. Không chỉ cung cấp năng lượng sạch, Nutein là lời cam kết bền vững cho sức khỏe của bạn và hệ sinh thái thiên nhiên.&rdquo;
            </p>
            <div className="flex items-center gap-4 flex-wrap">
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
              className="diff-row animate-fade-up group grid items-center gap-6 border-t border-[color:var(--color-border)] py-9 transition-colors duration-300"
              style={{ gridTemplateColumns: "88px 80px 1.6fr auto", animationDelay: `${idx * 0.12}s` }}
            >
              <span className="font-display font-black text-[26px] text-primary-deep/40 tracking-[-0.02em] tabular-nums">
                0{idx + 1}
              </span>
              <div className="w-20 h-20 rounded-2xl bg-white text-primary-deep flex items-center justify-center shadow-sm shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1.5 group-hover:rotate-6 group-hover:shadow-md">
                {item.icon}
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <h3 className="font-display font-extrabold text-xl text-ink tracking-[-0.02em]">{item.title}</h3>
                <p className="text-sm text-text-body leading-relaxed">{item.desc}</p>
              </div>
              <Badge color="primary" size="md" className="hidden md:inline-flex uppercase tracking-[0.06em] justify-self-end">
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
