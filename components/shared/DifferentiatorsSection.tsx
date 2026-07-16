"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { Leaf, Award, CheckCircle } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { CtaCluster } from "@/components/ui/CtaCluster";
import { StarRating } from "@/components/ui/StarRating";
import { CloudFrame } from "@/components/ui/CloudFrame";

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
        <SectionHeading eyebrow="Triết lý phát triển" variant="outline" className="text-[clamp(40px,6.5vw,92px)] tracking-[-0.03em] mb-16">
          Vì sao Protein Nutein<br />khác biệt?
        </SectionHeading>

        {/* Cụm ảnh khung mây/bông hoa (cloud) — đúng motif collage của reference */}
        <div className="diff-brand grid gap-10 md:gap-16 items-center mb-20" style={{ gridTemplateColumns: "0.9fr 1.1fr" }}>
          <div className="diff-frame-cluster relative h-[300px] md:h-[380px]">
            <CloudFrame
              className="absolute w-[58%] top-0 left-[2%] -rotate-[10deg] z-[1]"
              lobes={6} amplitude={0.09}
              borderColor="#C08635"
            >
              <Image src="/images/example.jpg" alt="Nutein" fill className="object-cover" />
            </CloudFrame>
            <CloudFrame
              className="absolute w-[46%] bottom-0 right-0 rotate-[9deg] z-[2]"
              lobes={5} amplitude={0.1}
              borderColor="#C08635"
            >
              <Image src="/images/example.jpg" alt="Nutein" fill className="object-cover" />
            </CloudFrame>
            <CloudFrame
              className="hidden md:block absolute w-[26%] top-[38%] left-[36%] -rotate-3 z-[3]"
              lobes={5} amplitude={0.07}
              borderColor="#C08635"
            >
              <Image src="/images/example.jpg" alt="Nutein" fill className="object-cover" />
            </CloudFrame>
          </div>
          <div>
            <p className="font-display text-xl md:text-2xl text-ink leading-snug tracking-[-0.01em] mb-6">
              &ldquo;Chúng tôi tin rằng cơ thể bạn xứng đáng nhận được nguồn dinh dưỡng lành mạnh nhất. Không chỉ cung cấp năng lượng sạch, Nutein là lời cam kết bền vững cho sức khỏe của bạn và hệ sinh thái thiên nhiên.&rdquo;
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <CtaCluster label="Về chúng tôi" href="#ve-chung-toi" size={44} iconSize={18} />
              <span className="inline-flex items-center gap-2">
                <StarRating rating={4.9} />
                <span className="text-xs font-bold text-text-muted underline underline-offset-2">50,000+ đánh giá</span>
              </span>
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

      <style>{`
        @media (max-width: 900px) {
          .diff-brand { grid-template-columns: 1fr !important; }
          .diff-frame-cluster { max-width: 320px; margin: 0 auto; }
          .diff-row {
            grid-template-columns: 40px 52px 1fr !important;
            row-gap: 10px !important;
          }
        }
      `}</style>
    </section>
  );
}
