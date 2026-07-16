"use client";

import Image from "next/image";
import { MessageSquare, ShoppingCart, Leaf, ShieldCheck, Sprout } from "lucide-react";
import { toast } from "sonner";
import { FillButton } from "@/components/ui/FillButton";
import { BounceChars } from "@/components/ui/BounceChars";

const MILESTONES = [
  { icon: <Leaf size={18} strokeWidth={2.2} />, label: "100% Protein Thực Vật" },
  { icon: <ShieldCheck size={18} strokeWidth={2.2} />, label: "Non-GMO" },
  { icon: <Sprout size={18} strokeWidth={2.2} />, label: "Organic" },
];

export default function BottomCtaSection() {
  return (
    <section
      id="bottom-cta"
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #8A5A1E 0%, #E2A550 100%)" }}
    >
      <div
        aria-hidden
        className="absolute -top-[20%] -left-[10%] w-[340px] h-[340px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(196,226,147,0.28) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-[20%] -right-[10%] w-[340px] h-[340px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)" }}
      />

      <div className="relative z-[1] max-w-[1200px] mx-auto px-6 py-20 md:py-28 grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-12 md:gap-16 items-center">
        {/* Cụm ảnh xoè quạt (fan) — thay cụm lon sản phẩm nghiêng của reference (placeholder example.jpg) */}
        <div className="cta-fan relative hidden md:block h-[320px]">
          <div className="absolute w-[62%] aspect-[3/4] rounded-3xl overflow-hidden shadow-xl border-4 border-white left-0 top-8 -rotate-[13deg] z-[1]">
            <Image src="/images/example.jpg" alt="Nutein" fill sizes="300px" className="object-cover" />
          </div>
          <div className="absolute w-[62%] aspect-[3/4] rounded-3xl overflow-hidden shadow-xl border-4 border-white left-[15%] top-0 -rotate-[1deg] z-[2]">
            <Image src="/images/example.jpg" alt="Nutein" fill sizes="300px" className="object-cover" />
          </div>
          <div className="absolute w-[62%] aspect-[3/4] rounded-3xl overflow-hidden shadow-xl border-4 border-white left-[30%] top-10 rotate-[12deg] z-[3]">
            <Image src="/images/example.jpg" alt="Nutein" fill sizes="300px" className="object-cover" />
          </div>
        </div>

        <div className="cta-copy relative text-center md:text-left">
          <h2 className="font-display font-black text-white text-[clamp(30px,4.5vw,52px)] leading-[1.05] tracking-[-0.03em]">
            <BounceChars>Sẵn sàng nạp nguồn năng lượng sạch từ thực vật?</BounceChars>
          </h2>
          <p className="text-white/85 text-[15px] md:text-base leading-relaxed mt-4 max-w-[440px] mx-auto md:mx-0">
            Gia nhập lối sống lành mạnh cùng hàng ngàn khách hàng tin dùng Nutein để chăm sóc sức khỏe chủ động mỗi ngày.
          </p>

          <div className="flex gap-4 flex-wrap justify-center md:justify-start mt-8">
            <FillButton href="#san-pham" variant="white" className="px-7 py-3.5 text-base font-bold shadow-lg">
              <ShoppingCart size={18} />
              Mua Ngay Sản Phẩm
            </FillButton>

            <FillButton
              variant="outline-white"
              onClick={() => toast.info("Hệ thống tư vấn viên đang được kết nối.")}
              className="px-7 py-3.5 text-base font-bold"
            >
              <MessageSquare size={18} />
              Tư vấn trực tiếp
            </FillButton>
          </div>

          {/* 3 dòng cam kết — thay cụm milestone "spend $X" của reference bằng USP có thật, không bịa số liệu */}
          <div className="flex flex-col gap-4 mt-10 items-center md:items-start">
            {MILESTONES.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full border border-white/40 text-white flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                <span className="text-white font-bold text-sm">{item.label}</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#8A5A1E] bg-white rounded-full px-2.5 py-1">
                  Đã kiểm định
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
