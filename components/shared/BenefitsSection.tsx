"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { Smile, Shield, Sparkles, Globe, Check } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { CloudFrame } from "@/components/ui/CloudFrame";

interface Benefit {
  icon: ReactNode;
  title: string;
  desc: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: <Smile size={22} strokeWidth={2.2} />,
    title: "Nhẹ bụng, Dễ tiêu hóa",
    desc: "Không chứa Lactose và Gluten - hai tác nhân chính gây chướng bụng. Nhờ đạm peptide siêu nhỏ từ hạt hữu cơ thủy phân, bạn sẽ cảm thấy bụng luôn êm dịu, dễ chịu.",
  },
  {
    icon: <Shield size={22} strokeWidth={2.2} />,
    title: "Bảo vệ hệ tim mạch",
    desc: "Hàm lượng Cholesterol bằng 0 cùng nguồn chất béo chưa bão hòa dồi dào từ hạt óc chó giúp làm sạch mạch máu, kiểm soát huyết áp và bảo vệ trái tim khỏe mạnh.",
  },
  {
    icon: <Sparkles size={22} strokeWidth={2.2} />,
    title: "Trẻ hóa làn da, Giữ vóc dáng",
    desc: "Chứa nhiều chất chống oxy hóa tự nhiên và vitamin E từ rau củ quả giúp nuôi dưỡng làn da sáng khỏe, đồng thời hỗ trợ kiểm soát calo nạp vào cho vóc dáng thon gọn.",
  },
  {
    icon: <Globe size={22} strokeWidth={2.2} />,
    title: "Bền vững cho môi trường",
    desc: "Canh tác nguồn đạm thực vật tiêu tốn ít hơn 90% lượng nước và tạo ra lượng khí thải nhà kính cực thấp so với đạm động vật, góp phần bảo vệ hành tinh xanh.",
  },
];

const COMMITMENTS = [
  "Không bổ sung đường hóa học",
  "Không chứa Gluten & Lactose",
  "Không biến đổi gen (Non-GMO)",
  "Không chất bảo quản nhân tạo",
];

export default function BenefitsSection() {
  return (
    <section id="benefits" className="relative overflow-hidden bg-primary-soft/40 py-24 px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="benefits-split grid gap-14" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
          {/* Column 1 */}
          <div className="flex flex-col gap-9">
            <SectionHeading eyebrow="Giá trị sức khỏe" align="left" className="text-[clamp(36px,5.5vw,72px)] tracking-[-0.03em]">
              Lợi ích vượt trội<br />từ đạm thực vật sạch
            </SectionHeading>
            <p className="text-text-body text-[15px] leading-relaxed -mt-4">
              Khoa học đã chứng minh đạm thực vật hữu cơ là chìa khóa vàng giúp thanh lọc cơ thể nhẹ nhàng, phòng ngừa các bệnh mạn tính và kéo dài tuổi thọ dẻo dai.
            </p>

            <div className="flex flex-col gap-7">
              {BENEFITS.map((item, idx) => (
                <div
                  key={idx}
                  className="animate-fade-up flex gap-5 items-start"
                  style={{ animationDelay: `${idx * 0.12}s` }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary-deep flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-ink tracking-[-0.01em] mb-1.5">{item.title}</h3>
                    <p className="text-[13.5px] text-text-body leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 — cụm ảnh lifestyle + badge cam kết nổi đè góc (thay infographic card cũ) */}
          <div className="benefits-visual-col relative flex items-center justify-center min-h-[440px]">
            <div
              aria-hidden
              className="absolute w-[90%] h-[90%] rounded-full blur-[20px] z-0"
              style={{ background: "radial-gradient(circle, rgba(226,165,80,0.16) 0%, transparent 70%)" }}
            />
            <div className="relative z-[1] w-full max-w-[380px] aspect-[4/5] rounded-[32px] overflow-hidden rotate-2"
              style={{ boxShadow: "0 0 0 5px #C08635, 0 20px 60px rgba(0,0,0,0.12)" }}>
              <Image src="/images/example.jpg" alt="Nutein" fill className="object-cover" />
            </div>

            <CloudFrame
              className="animate-badge-pop absolute -bottom-10 -left-6 md:-left-10 w-[52%] -rotate-[9deg]"
              lobes={6}
              amplitude={0.09}
              borderColor="#C08635"
              style={{ animationDelay: "0.4s" }}
            >
              <Image src="/images/example.jpg" alt="Nutein" fill className="object-cover" />
            </CloudFrame>

            <div className="animate-badge-pop absolute top-4 -right-2 md:-right-6 z-[2] bg-surface rounded-3xl border border-[color:var(--color-border)] shadow-lg px-6 py-5 w-[210px] flex flex-col gap-3" style={{ animationDelay: "0.6s" }}>
              <Badge color="primary" size="sm" className="self-start uppercase">
                Cam kết 4 Không
              </Badge>
              <div className="flex flex-col gap-2 text-left">
                {COMMITMENTS.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary-soft text-primary-deep flex items-center justify-center shrink-0">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className="text-[11.5px] font-bold text-text-body leading-tight">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .benefits-split { grid-template-columns: 1fr !important; gap: 48px !important; }
          .benefits-visual-col { order: 2; padding: 0 12px; }
        }
      `}</style>
    </section>
  );
}
