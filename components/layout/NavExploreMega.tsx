"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useAuthStore } from "@/lib/useAuthStore";

export const EXPLORE_LINKS = [
  { label: "Về chúng tôi", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Liên hệ", href: "/contact" },
] as const;

const ADMIN_LINK_LABEL = "Quản Trị";

const PROMO_CARDS = [
  {
    href: "/product",
    image: "/media/MJ.png",
    imageAlt: "Protein thực vật Nutein",
    eyebrow: "Sản phẩm",
    title: "Nạp năng lượng sạch từ đạm thực vật",
    cta: "Mua ngay",
    tone: "primary" as const,
  },
  {
    href: "/about",
    image: "/media/MJ2.png",
    imageAlt: "Câu chuyện thương hiệu Nutein",
    eyebrow: "Thương hiệu",
    title: "Câu chuyện đằng sau lối sống lành mạnh",
    cta: "Tìm hiểu",
    tone: "ink" as const,
  },
] as const;

type NavExploreMegaProps = {
  onNavigate?: () => void;
};

/**
 * Nội dung mega "Khám phá" — nằm trong shell navbar (không tự có bg/absolute).
 * Animation do parent: grid-rows height + opacity (Joy Rush ~0.4s).
 * Link Quản Trị chỉ hiện khi session staff/admin (client store — tránh lệch SSR).
 */
export function NavExploreMega({ onNavigate }: NavExploreMegaProps) {
  const { role, isStaffOrAdmin } = useAuthStore();
  const adminLinkHref = role === "admin" ? "/admin" : "/staff";

  return (
    <div id="nav-explore-mega" role="region" aria-label="Khám phá Nutein">
      <div className="mx-auto max-w-[1200px] px-6 pb-6 pt-1 md:px-10 md:pb-8">
        <div className="grid gap-5 md:grid-cols-[minmax(180px,0.85fr)_1fr_1fr] md:gap-4 lg:gap-5">
          <ul className="flex list-none flex-col justify-center gap-1 py-2 md:gap-2 md:py-4">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.03em] text-ink transition-colors hover:text-primary md:text-[32px] lg:text-[36px]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isStaffOrAdmin ? (
              <li>
                <Link
                  href={adminLinkHref}
                  onClick={onNavigate}
                  className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.03em] text-ink transition-colors hover:text-primary md:text-[32px] lg:text-[36px]"
                >
                  {ADMIN_LINK_LABEL}
                </Link>
              </li>
            ) : null}
          </ul>

          {PROMO_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              onClick={onNavigate}
              className="group relative block min-h-[220px] overflow-hidden rounded-[var(--radius-xl)] md:min-h-[280px] lg:min-h-[320px]"
            >
              <Image
                src={card.image}
                alt={card.imageAlt}
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className={
                  card.tone === "primary"
                    ? "relative z-[1] translate-y-[8%] scale-[1.35] object-contain transition-transform duration-500 group-hover:scale-[1.4]"
                    : "relative z-[1] translate-x-[4%] translate-y-[9%] scale-[1.14] object-contain object-right transition-transform duration-500 group-hover:scale-[1.19]"
                }
              />
              <div
                aria-hidden
                className={
                  card.tone === "primary"
                    ? "absolute inset-0 z-0 bg-[linear-gradient(145deg,var(--color-primary-soft)_0%,color-mix(in_srgb,var(--color-primary)_42%,var(--color-primary-soft))_100%)]"
                    : "absolute inset-0 z-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-ink)_88%,var(--color-primary-deep))_0%,var(--color-ink)_100%)]"
                }
              />
              <div
                aria-hidden
                className={
                  card.tone === "primary"
                    ? "absolute -bottom-1/3 -right-1/4 z-0 aspect-square w-[90%] rounded-full bg-primary/35 blur-3xl"
                    : "absolute -bottom-1/3 -right-1/4 z-0 aspect-square w-[90%] rounded-full bg-primary-deep/45 blur-3xl"
                }
              />
              <div
                aria-hidden
                className={
                  card.tone === "primary"
                    ? "absolute inset-0 z-[2] bg-gradient-to-t from-primary-deep/88 via-primary-deep/20 to-transparent"
                    : "absolute inset-0 z-[2] bg-gradient-to-t from-ink/90 via-ink/20 to-transparent"
                }
              />
              <div className="absolute inset-0 z-[3] flex flex-col justify-between p-5 md:p-6">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-bg)]/80">
                    {card.eyebrow}
                  </p>
                  <p className="mt-2 max-w-[18ch] font-display text-[22px] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--color-bg)] md:text-[26px]">
                    {card.title}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-[var(--color-bg)]/95 py-2 pr-3 pl-4 text-[12px] font-bold text-ink shadow-sm backdrop-blur-sm">
                  {card.cta}
                  <ArrowUpRight size={15} strokeWidth={2.4} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
