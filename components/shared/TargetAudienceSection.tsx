"use client";

import { type CSSProperties } from "react";
import { BounceChars, FadeInOnView } from "@/components/ui/BounceChars";

interface Persona {
  title: string;
  desc: string;
  color: string;
}

const PERSONAS: Persona[] = [
  {
    title: "Dân Văn Phòng Bận Rộn",
    desc: "Bữa sáng dinh dưỡng trọn vẹn chỉ trong 2 phút pha nhanh. Đảm bảo đủ đạm và năng lượng sạch để duy trì tỉnh táo suốt ngày làm việc mà không thèm ăn vặt.",
    color: "#1E4E7A",
  },
  {
    title: "Người Tập Gym, Yoga & Pilates",
    desc: "Nạp đạm tinh khiết chất lượng cao hỗ trợ xây dựng cơ bắp săn chắc, tăng độ bền bỉ khi tập luyện và hồi phục cơ nhanh chóng sau các buổi tập cường độ cao.",
    color: "#C08635",
  },
  {
    title: "Tín Đồ Ăn Chay & Eat Clean",
    desc: "Nguồn đạm lý tưởng thay thế thịt cá, hoàn toàn từ hạt tự nhiên. Không chứa lactose, không gluten và không chất bảo quản, tuyệt đối an lành cho cơ thể.",
    color: "#477236",
  },
  {
    title: "Gia Đình & Người Lớn Tuổi",
    desc: "Nhờ công nghệ thủy phân enzyme thực vật, sản phẩm cực kỳ dễ hấp thu, nhẹ bụng. Thích hợp bổ sung dưỡng chất thiết yếu hàng ngày cho ông bà và cha mẹ.",
    color: "#5A4550",
  },
];

export default function TargetAudienceSection() {
  return (
    <section id="target-audience" className="relative">
      {/* Khối màu full-bleed (thay ảnh lifestyle chưa có) + heading trắng đè lên */}
      <div className="relative bg-gradient-to-br from-ink via-[#4A2E3D] to-primary-deep pt-24 pb-48 md:pb-64 px-6 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(226,165,80,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(196,226,147,0.18) 0%, transparent 45%)",
          }}
        />
        <div className="relative z-[1] max-w-[720px] mx-auto text-center">
          <FadeInOnView className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary-soft">
            Phân nhóm đối tượng
          </FadeInOnView>
          <h2 className="font-display font-black uppercase text-white text-[clamp(38px,6.5vw,84px)] leading-[0.98] tracking-[-0.03em] mt-3 mb-4">
            <BounceChars>Protein Nutein dành cho ai?</BounceChars>
          </h2>
          <p className="text-white/75 text-base leading-relaxed">
            Nutein cung cấp nguồn đạm thực vật sạch, lành và dễ tiêu hóa, đáp ứng nhu cầu dinh dưỡng đa dạng của mọi thành viên.
          </p>
        </div>
      </div>

      {/* Card đè lên mép dưới khối màu (margin âm) */}
      <div className="relative z-[2] max-w-[1200px] mx-auto px-6 -mt-36 md:-mt-44 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PERSONAS.map((item, idx) => (
            <div
              key={idx}
              className="animate-fade-up flex flex-col justify-between gap-8 p-8 rounded-[40px] min-h-[260px] bg-surface"
              style={{
                animationDelay: `${idx * 0.12}s`,
                borderTop:    "3px solid var(--color-primary-deep)",
                borderLeft:   "3px solid var(--color-primary-deep)",
                borderRight:  "3px solid var(--color-primary-deep)",
                borderBottom: "10px solid var(--color-primary-deep)",
              } as CSSProperties}
            >
              <h3 className="font-display font-extrabold text-[clamp(18px,2.2vw,24px)] text-ink tracking-[-0.03em] leading-tight">
                {item.title}
              </h3>
              <p className="text-[13.5px] text-text-body leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
