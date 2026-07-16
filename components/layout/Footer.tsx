"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { BounceChars } from "@/components/ui/BounceChars";
// lucide-react đã bỏ các icon logo thương hiệu (Facebook, Instagram...) vì lý do
// bản quyền — dùng SVG inline tối giản thay thế.
function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07c0 5 3.66 9.15 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.78 8.44-4.93 8.44-9.93Z" />
    </svg>
  );
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

const QUICK_LINKS = [
  { label: "Trang chủ", href: "/" },
  { label: "Sản phẩm", href: "#san-pham" },
  { label: "Khám phá", href: "#kien-thuc" },
  { label: "Về Nutein", href: "#ve-chung-toi" },
  { label: "Liên hệ", href: "#lien-he" },
];

const POLICY_LINKS = [
  { label: "Giao hàng", href: "#" },
  { label: "Đổi trả", href: "#" },
  { label: "Bảo mật", href: "#" },
  { label: "Điều khoản sử dụng", href: "#" },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    toast.success("Đăng ký nhận ưu đãi thành công!");
    setEmail("");
  };

  return (
    <footer id="footer" className="bg-ink relative overflow-hidden">
      {/* Newsletter heading block */}
      <div className="relative max-w-[1200px] mx-auto px-6 py-24 md:py-32 border-b border-white/10 overflow-hidden">
        <div className="relative z-[1] flex flex-col md:flex-row md:items-end md:justify-between gap-10">
          <h2 className="text-white font-black uppercase text-[clamp(48px,8vw,104px)] leading-[0.94] tracking-[-0.035em] max-w-[720px]">
            <BounceChars>
              Không bỏ lỡ
              <br />
              ưu đãi từ Nutein
            </BounceChars>
          </h2>

          <form onSubmit={handleSubscribe} className="w-full max-w-[420px] flex flex-col gap-3">
            <p className="text-white/60 text-sm">Đăng ký để nhận tin tức & ưu đãi sớm nhất</p>
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-full p-1.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email của bạn"
                disabled={submitting}
                className="flex-1 bg-transparent text-white placeholder:text-white/40 text-sm px-4 py-2.5 outline-none min-w-0"
              />
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "..." : "Đăng ký"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Link columns */}
      <div className="max-w-[1200px] mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10">
        <div>
          <Image
            src="/images/logo-horizontal-2x_1.svg"
            alt="Nutein"
            width={132}
            height={36}
            className="h-8 w-auto mb-4 brightness-0 invert"
          />
          <p className="text-white/55 text-sm leading-relaxed max-w-[280px]">
            100% Protein thực vật từ nguyên liệu thật — nguồn năng lượng sạch cho lối sống lành mạnh mỗi ngày.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <a href="#" aria-label="Facebook" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-primary hover:text-white transition-colors">
              <FacebookIcon size={16} />
            </a>
            <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-primary hover:text-white transition-colors">
              <InstagramIcon size={16} />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-white text-sm font-bold uppercase tracking-[0.08em] mb-4">Liên kết nhanh</h3>
          <ul className="flex flex-col gap-2.5 list-none">
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-white/55 text-sm hover:text-white transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-white text-sm font-bold uppercase tracking-[0.08em] mb-4">Chính sách</h3>
          <ul className="flex flex-col gap-2.5 list-none">
            {POLICY_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-white/55 text-sm hover:text-white transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-white text-sm font-bold uppercase tracking-[0.08em] mb-4">Liên hệ</h3>
          <ul className="flex flex-col gap-2.5 list-none text-white/55 text-sm">
            <li>Hotline: 1900 xxxx</li>
            <li>Email: hello@nutein.vn</li>
            <li>Fanpage · TikTok · Shopee</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="max-w-[1200px] mx-auto px-6 py-6 text-white/40 text-xs">
          © 2024 Nutein. Bảo tồn giá trị thực vật.
        </p>
      </div>
    </footer>
  );
}
