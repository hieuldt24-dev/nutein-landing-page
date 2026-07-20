"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { ShoppingBag, User } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { EXPLORE_LINKS, NavExploreMega } from "@/components/layout/NavExploreMega";
import { useAuthStore } from "@/lib/useAuthStore";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";
import { cn } from "@/lib/utils";

const PRODUCT_LINK = { label: "Sản phẩm", href: "/product" };

const navFillClass = "py-2 px-3.5 text-[13px] font-bold shadow-sm";

/** Tam giác ▼ đặc — motif Joy Rush caret. */
function NavCaret({ open }: { open?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-current opacity-90 transition-transform duration-200",
        open && "rotate-180"
      )}
    />
  );
}

/**
 * Navbar — Joy Rush shell liền mạch:
 * một khối cream chứa nav + mega; mở bằng height (grid-rows) + fade nội dung.
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const setAuthOpen = (val: boolean) => mutate("auth-modal", val, { revalidate: false });
  const { isLoggedIn } = useAuthStore();
  const cartDrawer = useCartDrawer();
  const { quantity: cartQuantity } = useCartStore();

  useEffect(() => {
    setMenuOpen(false);
    setExploreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!exploreOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (shellRef.current && !shellRef.current.contains(t)) {
        setExploreOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExploreOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [exploreOpen]);

  const handleUserClick = () => {
    if (isLoggedIn) {
      router.push("/account");
      return;
    }
    setAuthOpen(true);
  };

  const openExplore = () => {
    setExploreOpen(true);
  };

  return (
    <header id="navbar" className="absolute top-0 left-0 right-0 z-30">
      {/*
        Một shell duy nhất (Joy Rush): khi mở → bg cream + bo góc dưới + shadow.
        Nav và mega cùng nằm trong shell — không tách 2 khối trắng.
      */}
      <div
        ref={shellRef}
        className={cn(
          "relative w-full overflow-hidden transition-[background-color,box-shadow,border-radius] duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          exploreOpen
            ? "rounded-b-[28px] bg-bg shadow-[0_28px_56px_rgba(53,30,41,0.14)] md:rounded-b-[40px]"
            : "rounded-none bg-transparent shadow-none"
        )}
        onMouseLeave={() => setExploreOpen(false)}
      >
        <nav className="relative mx-auto flex h-[92px] max-w-[1200px] items-center justify-between px-6 md:px-10">
          <ul className="relative z-[1] hidden list-none items-center gap-2 md:flex">
            <li>
              <FillButton
                href={PRODUCT_LINK.href}
                variant="ink"
                className={navFillClass}
              >
                {PRODUCT_LINK.label}
              </FillButton>
            </li>

            <li onMouseEnter={openExplore}>
              <FillButton
                variant="ink"
                aria-expanded={exploreOpen}
                onClick={openExplore}
                className={navFillClass}
              >
                Khám phá
                <NavCaret open={exploreOpen} />
              </FillButton>
            </li>
          </ul>

          <Link
            href="/"
            id="nav-logo"
            className="absolute left-1/2 top-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 items-center"
          >
            <Image
              src="/images/logo-horizontal-2x_1.svg"
              alt="Nutein"
              width={200}
              height={54}
              priority
              className="h-12 w-auto md:h-[60px]"
            />
          </Link>

          <div className="relative z-[1] ml-auto flex shrink-0 items-center gap-2">
            <FillButton
              variant="ink"
              onClick={cartDrawer.open}
              className="hidden py-2 pr-4 pl-3.5 text-[13px] font-bold shadow-sm md:inline-flex"
            >
              <span className="relative inline-flex">
                <ShoppingBag size={16} strokeWidth={2.2} />
                {cartQuantity > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white">
                    {cartQuantity}
                  </span>
                )}
              </span>
              Giỏ hàng
            </FillButton>

            <FillButton
              variant="ink"
              onClick={handleUserClick}
              aria-label={isLoggedIn ? "Tài khoản" : "Đăng nhập"}
              className="hidden py-2 pr-4 pl-3.5 text-[13px] font-bold shadow-sm md:inline-flex"
            >
              <User size={16} strokeWidth={2.2} />
              {isLoggedIn ? "Tài khoản" : "Đăng nhập"}
            </FillButton>

            <button
              id="nav-burger"
              aria-label="Mở menu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex cursor-pointer flex-col gap-[5px] p-2 text-ink md:hidden"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-0.5 w-5 rounded-sm bg-current transition-transform duration-200"
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

        {/* Mega luôn mount — height expand (grid-rows) + opacity fade 0.4s như Joy Rush */}
        <div
          className={cn(
            "hidden grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] md:grid",
            exploreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
          aria-hidden={!exploreOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "transition-opacity duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]",
                exploreOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <NavExploreMega onNavigate={() => setExploreOpen(false)} />
            </div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="flex flex-col gap-0.5 border-t border-[color:var(--color-border)] bg-bg/97 px-6 py-3 backdrop-blur-xl md:hidden">
          <Link
            href={PRODUCT_LINK.href}
            onClick={() => setMenuOpen(false)}
            className="cursor-pointer rounded-lg border-b border-[color:var(--color-border-subtle)] px-2 py-2.5 text-[15px] font-medium text-text-body"
          >
            {PRODUCT_LINK.label}
          </Link>

          <p className="px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            Khám phá
          </p>
          {EXPLORE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="cursor-pointer rounded-lg border-b border-[color:var(--color-border-subtle)] px-2 py-2.5 text-[15px] font-medium text-text-body"
            >
              {link.label}
            </Link>
          ))}

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              cartDrawer.open();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-b border-[color:var(--color-border-subtle)] px-2 py-2.5 text-left text-[15px] font-medium text-text-body"
          >
            <ShoppingBag size={18} strokeWidth={2} />
            Giỏ hàng
            {cartQuantity > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-white">
                {cartQuantity}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              handleUserClick();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-b border-[color:var(--color-border-subtle)] px-2 py-2.5 text-left text-[15px] font-medium text-text-body"
          >
            <User size={18} strokeWidth={2} />
            {isLoggedIn ? "Tài khoản" : "Đăng nhập"}
          </button>
        </div>
      )}
    </header>
  );
}
