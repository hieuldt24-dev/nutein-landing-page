"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ShoppingBag, User, ChevronDown } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";

const NAV_LINKS = [
  { label: "Sản phẩm", href: "#san-pham", caret: false },
  { label: "Về chúng tôi", href: "#ve-chung-toi", caret: false },
  { label: "Kiến thức", href: "#kien-thuc", caret: false },
  { label: "Liên hệ", href: "#lien-he", caret: false },
];

/**
 * Navbar nổi trong suốt tuyệt đối (`position: absolute`) trong phạm vi Hero —
 * đúng hành vi đo được trên reference (không phải `fixed` dính khi cuộn qua
 * các section khác). Component cha (`app/page.tsx`) đặt Navbar + HeroSection
 * trong 1 wrapper `relative` để absolute này định vị đúng theo Hero.
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mutate } = useSWRConfig();
  const setAuthOpen = (val: boolean) => mutate("auth-modal", val, { revalidate: false });

  return (
    <header id="navbar" className="absolute top-0 left-0 right-0 z-30">
      <nav className="max-w-[1200px] mx-auto px-6 md:px-10 h-[84px] flex items-center justify-between">
        <Link href="/" id="nav-logo" className="shrink-0 flex items-center">
          <Image
            src="/images/logo-horizontal-2x_1.svg"
            alt="Nutein"
            width={132}
            height={36}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <ul className="hidden md:flex items-center gap-1 list-none">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-1 text-sm font-semibold text-ink px-3 py-1.5 rounded-lg transition-colors hover:bg-white/50"
              >
                {link.label}
                {link.caret && <ChevronDown size={14} strokeWidth={2.5} className="opacity-60" />}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 shrink-0">
          <FillButton
            variant="ink"
            className="hidden md:inline-flex pl-3.5 pr-4 py-2 text-[13px] font-bold shadow-sm"
          >
            <ShoppingBag size={16} strokeWidth={2.2} />
            Giỏ hàng
          </FillButton>

          <FillButton
            variant="ink"
            onClick={() => setAuthOpen(true)}
            className="hidden md:inline-flex justify-center p-2.5 shadow-sm"
          >
            <User size={16} strokeWidth={2.2} />
          </FillButton>

          <button
            id="nav-burger"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex md:hidden flex-col gap-[5px] p-2 text-ink"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-5 h-0.5 bg-current rounded-sm transition-transform duration-200"
                style={{
                  transform: menuOpen
                    ? i === 0
                      ? "rotate(45deg) translateY(7px)"
                      : i === 2
                        ? "rotate(-45deg) translateY(-7px)"
                        : "none"
                    : "none",
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-[color:var(--color-border)] bg-bg/97 backdrop-blur-xl px-6 py-3 flex flex-col gap-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-[15px] font-medium text-text-body px-2 py-2.5 rounded-lg border-b border-[color:var(--color-border-subtle)]"
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              setAuthOpen(true);
            }}
            className="flex items-center gap-2 w-full text-left text-[15px] font-medium text-text-body px-2 py-2.5 rounded-lg border-b border-[color:var(--color-border-subtle)]"
          >
            <User size={18} strokeWidth={2} />
            Tài khoản
          </button>
        </div>
      )}
    </header>
  );
}
