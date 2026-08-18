"use client";

import Link from "next/link";
import Image from "next/image";
import type { MouseEvent } from "react";
import { MessageSquare, ShoppingCart } from "lucide-react";
import { BounceChars } from "@/components/ui/BounceChars";
import { FillButton } from "@/components/ui/FillButton";
import { POLICY_FOOTER_LINKS } from "@/features/policies/constants";
import { useAddToCart } from "@/lib/useAddToCart";

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07c0 5 3.66 9.15 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.78 8.44-4.93 8.44-9.93Z" />
    </svg>
  );
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

const QUICK_LINKS = [
  { label: "Trang chủ", href: "/" },
  { label: "Sản phẩm", href: "/product" },
  { label: "Khám phá", href: "/blog" },
  { label: "Về Nutein", href: "/about" },
  { label: "Liên hệ", href: "/contact" },
];

const POLICY_LINKS = POLICY_FOOTER_LINKS;

/**
 * Footer site — nền caramel như BottomCta; CTA mua hàng ở trên,
 * cột link / copyright bên dưới. Không còn newsletter.
 */
export default function Footer() {
  const addToCart = useAddToCart();

  const handleBuyNow = (e: MouseEvent) => {
    e.preventDefault();
    void addToCart();
  };

  return (
    <footer
      id="lien-he"
      className="relative shrink-0 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #8A5A1E 0%, #E2A550 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-16 h-[340px] w-[340px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(196,226,147,0.28) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-[340px] w-[340px] translate-y-1/3 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
        }}
      />

      {/* CTA — khung fan cố định theo nội dung (tránh aspect cao tạo lỗ trống tới cột link) */}
      <div className="relative z-[1] mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-8 px-6 py-12 md:grid-cols-[minmax(0,340px)_1fr] md:gap-12 md:py-14">
        <div className="cta-fan relative mx-auto hidden h-[260px] w-full max-w-[300px] md:block">
          <div className="absolute top-5 left-0 z-[1] aspect-[3/4] w-[56%] -rotate-[13deg] overflow-hidden rounded-3xl border-4 border-white shadow-xl">
            <Image
              src="/media/product3.png"
              alt="Hộp và gói Protein thực vật Nutein"
              fill
              sizes="180px"
              className="object-cover object-center"
            />
          </div>
          <div className="absolute top-0 left-[14%] z-[2] aspect-[3/4] w-[56%] -rotate-[1deg] overflow-hidden rounded-3xl border-4 border-white shadow-xl">
            <Image
              src="/media/hero-about.png"
              alt="Nutein Protein thực vật"
              fill
              sizes="180px"
              className="object-cover object-bottom"
            />
          </div>
          <div className="absolute top-6 left-[28%] z-[3] aspect-[3/4] w-[56%] rotate-[12deg] overflow-hidden rounded-3xl border-4 border-white shadow-xl">
            <Image
              src="/media/product2.png"
              alt="Hộp Nutein cùng ly protein thực vật"
              fill
              sizes="180px"
              className="object-cover object-bottom"
            />
          </div>
        </div>

        <div className="cta-copy relative text-center md:text-left">
          <h2 className="font-display text-[clamp(28px,4vw,44px)] font-black leading-tight tracking-[-0.03em] text-white">
            <BounceChars>Sẵn sàng nạp nguồn năng lượng sạch từ thực vật?</BounceChars>
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-white/85 md:mx-0 md:text-base">
            Gia nhập lối sống lành mạnh cùng hàng ngàn khách hàng tin dùng Nutein để chăm
            sóc sức khỏe chủ động mỗi ngày.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-4 md:justify-start">
            <FillButton
              href="/product"
              onClick={handleBuyNow}
              variant="white"
              className="px-7 py-3.5 text-base font-bold shadow-lg"
            >
              <ShoppingCart size={18} />
              Mua Ngay Sản Phẩm
            </FillButton>

            <FillButton
              variant="outline-white"
              disabled
              className="px-7 py-3.5 text-base font-bold"
            >
              <MessageSquare size={18} />
              Tư vấn trực tiếp
            </FillButton>
          </div>
        </div>
      </div>

      {/* Cột link */}
      <div className="relative z-[1] mx-auto grid max-w-[1200px] grid-cols-1 gap-8 border-t border-white/20 px-6 py-8 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:py-10">
        <div>
          <Image
            src="/images/logo-horizontal-2x_1.svg"
            alt="Nutein"
            width={132}
            height={36}
            className="mb-4 h-8 w-auto brightness-0 invert"
          />
          <p className="max-w-[280px] text-sm leading-relaxed text-white/75">
            Protein thực vật từ nguyên liệu thật — nguồn năng lượng sạch cho lối sống
            lành mạnh mỗi ngày.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a
              href="#"
              aria-label="Facebook"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white/80 transition-colors hover:bg-white hover:text-[#8A5A1E]"
            >
              <FacebookIcon size={16} />
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white/80 transition-colors hover:bg-white hover:text-[#8A5A1E]"
            >
              <InstagramIcon size={16} />
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold tracking-[0.08em] text-white uppercase">
            Liên kết nhanh
          </h3>
          <ul className="flex list-none flex-col gap-2.5">
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-white/75 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold tracking-[0.08em] text-white uppercase">
            Chính sách
          </h3>
          <ul className="flex list-none flex-col gap-2.5">
            {POLICY_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-white/75 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold tracking-[0.08em] text-white uppercase">
            Liên hệ
          </h3>
          <ul className="flex list-none flex-col gap-2.5 text-sm text-white/75">
            <li>Hotline: 0353570977</li>
            <li>Email: hhs.business.vn@gmail.com</li>
            <li>Fanpage · TikTok · Shopee</li>
          </ul>
        </div>
      </div>

      <div className="relative z-[1] border-t border-white/20">
        <p className="mx-auto max-w-[1200px] px-6 py-6 text-xs text-white/55">
          © 2024 Nutein. Bảo tồn giá trị thực vật.
        </p>
      </div>
    </footer>
  );
}
