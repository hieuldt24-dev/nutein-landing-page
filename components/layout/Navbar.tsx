"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { ShoppingBag, User } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { EXPLORE_LINKS, NavExploreMega } from "@/components/layout/NavExploreMega";
import { useAuthStore } from "@/lib/useAuthStore";
import { useAccountProfile } from "@/lib/useAccountProfile";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";
import { openAuthModal } from "@/lib/openAuthModal";
import { AUTH_MODAL_SWR_KEY } from "@/features/auth/constants";
import { cn } from "@/lib/utils";

const PRODUCT_LINK = { label: "Sản phẩm", href: "/product" };

const navFillClass =
  "inline-flex items-center gap-2 py-2 px-3.5 text-[13px] font-bold shadow-sm";
const navEase = "duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]";

/** Tam giác ▼ đặc — motif Joy Rush caret. */
function NavCaret({ open }: { open?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-current opacity-90 transition-transform duration-200",
        open && "rotate-180",
      )}
    />
  );
}

/**
 * 3 gạch → gộp giữa → X.
 * Top/bottom dịch về giữa rồi xoay ±45°; gạch giữa fade.
 */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-3.5 w-[18px] shrink-0" aria-hidden>
      <span
        className={cn(
          "absolute left-0 top-0 block h-0.5 w-full origin-center rounded-full bg-current transition-[top,transform] duration-300 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          open && "top-[6px] rotate-45",
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-[6px] block h-0.5 w-full rounded-full bg-current transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          open && "scale-x-0 opacity-0",
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-[12px] block h-0.5 w-full origin-center rounded-full bg-current transition-[top,transform] duration-300 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          open && "top-[6px] -rotate-45",
        )}
      />
    </span>
  );
}

function CartBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1.5 -right-1.5 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Navbar — Joy Rush shell:
 * Desktop: Products / Khám phá | Logo | Giỏ / Tài khoản
 * Mobile: Menu | Logo | Giỏ — panel expand (grid-rows) giống mega desktop
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const setAuthOpen = (val: boolean) => {
    if (val) openAuthModal(mutate);
    else void mutate(AUTH_MODAL_SWR_KEY, false, { revalidate: false });
  };
  const { isLoggedIn, isStaffOrAdmin, role, user } = useAuthStore();
  const adminLinkHref = role === "admin" ? "/admin" : "/staff";
  const { profile } = useAccountProfile();
  const avatarName = profile?.fullName || user?.fullName;
  const cartDrawer = useCartDrawer();
  const { lineCount: cartQuantity } = useCartStore();

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

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

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

  const closeMenu = () => setMenuOpen(false);

  const openCart = () => {
    setMenuOpen(false);
    cartDrawer.open();
  };

  const shellExpanded = menuOpen || exploreOpen;

  return (
    <header id="navbar" className="absolute top-0 left-0 right-0 z-30">
      <div
        ref={shellRef}
        className={cn(
          "relative w-full transition-[background-color,box-shadow,border-radius]",
          navEase,
          shellExpanded
            ? "rounded-b-[28px] bg-bg shadow-[0_28px_56px_rgba(53,30,41,0.14)] md:rounded-b-[40px]"
            : "rounded-none bg-transparent shadow-none",
        )}
        onMouseLeave={() => setExploreOpen(false)}
      >
        <nav className="relative mx-auto flex h-[92px] max-w-[1200px] items-center justify-between px-5 md:px-10">
          {/* Mobile: Menu — icon morph ☰ → X */}
          <div className="relative z-[1] flex md:hidden">
            <FillButton
              variant="ink"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
              className={navFillClass}
            >
              <MenuIcon open={menuOpen} />
              {menuOpen ? "Đóng" : "Menu"}
            </FillButton>
          </div>

          {/* Desktop: Products + Explore */}
          <ul className="relative z-[1] hidden list-none items-center gap-2 md:flex">
            <li>
              <FillButton href={PRODUCT_LINK.href} variant="ink" className={navFillClass}>
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
            onClick={closeMenu}
          >
            <Image
              src="/images/logo-horizontal-2x_1.svg"
              alt="Nutein"
              width={200}
              height={54}
              priority
              className="h-10 w-auto md:h-[60px]"
            />
          </Link>

          <div className="relative z-[1] ml-auto flex shrink-0 items-center gap-2">
            <div className="relative">
              <FillButton variant="ink" onClick={openCart} className={navFillClass}>
                <ShoppingBag size={16} strokeWidth={2.2} aria-hidden />
                Giỏ
              </FillButton>
              <CartBadge count={cartQuantity} />
            </div>

            <FillButton
              variant="ink"
              onClick={handleUserClick}
              aria-label={isLoggedIn ? "Tài khoản" : "Đăng nhập"}
              className={cn(navFillClass, "hidden md:inline-flex")}
            >
              {isLoggedIn ? (
                <UserAvatar
                  fullName={avatarName}
                  email={user?.email}
                  size="sm"
                />
              ) : (
                <User size={16} strokeWidth={2.2} />
              )}
              {isLoggedIn ? "Tài khoản" : "Đăng nhập"}
            </FillButton>
          </div>
        </nav>

        {/* Desktop mega — height expand + fade */}
        <div
          className={cn(
            "hidden grid transition-[grid-template-rows]",
            navEase,
            "md:grid",
            exploreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!exploreOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "transition-opacity",
                navEase,
                exploreOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0",
              )}
            >
              <NavExploreMega onNavigate={() => setExploreOpen(false)} />
            </div>
          </div>
        </div>

        {/* Mobile menu — cùng pattern grid-rows / fade như mega desktop */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] md:hidden",
            navEase,
            menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!menuOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "flex min-h-[calc(100svh-92px)] flex-col transition-opacity",
                navEase,
                menuOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0",
              )}
              role="dialog"
              aria-modal={menuOpen}
              aria-label="Menu điều hướng"
            >
              <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6">
                <Link
                  href={PRODUCT_LINK.href}
                  onClick={closeMenu}
                  className="font-display flex items-center justify-between border-b border-ink/10 py-5 text-[28px] font-bold tracking-[-0.03em] text-ink"
                >
                  {PRODUCT_LINK.label}
                </Link>

                <p className="pt-6 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                  Khám phá
                </p>
                {EXPLORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="font-display block border-b border-ink/10 py-4 text-[22px] font-bold tracking-[-0.02em] text-ink"
                  >
                    {link.label}
                  </Link>
                ))}

                {isStaffOrAdmin ? (
                  <Link
                    href={adminLinkHref}
                    onClick={closeMenu}
                    className="mt-6 block py-3 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink"
                  >
                    Quản trị
                  </Link>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-t border-ink/10 px-6 py-5">
                <FillButton
                  variant="ink"
                  onClick={() => {
                    closeMenu();
                    handleUserClick();
                  }}
                  className="h-14 w-full justify-center gap-2.5 text-[15px] font-bold uppercase tracking-[-0.01em]"
                >
                  {isLoggedIn ? (
                    <UserAvatar
                      fullName={avatarName}
                      email={user?.email}
                      size="sm"
                    />
                  ) : null}
                  {isLoggedIn ? "Tài khoản" : "Đăng nhập"}
                </FillButton>
                <FillButton
                  href="/product"
                  variant="ink-solid"
                  onClick={(e) => {
                    e.preventDefault();
                    closeMenu();
                    router.push("/product");
                  }}
                  className="h-14 w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
                >
                  Mua ngay
                </FillButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
