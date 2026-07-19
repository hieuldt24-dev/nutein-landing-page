"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSWRConfig } from "swr";
import { LogOut, ShoppingBag, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { FillButton } from "@/components/ui/FillButton";
import { useAuthStore } from "@/lib/useAuthStore";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Sản phẩm", href: "/#san-pham", caret: false },
  { label: "Về chúng tôi", href: "/about", caret: false },
  { label: "Kiến thức", href: "/#kien-thuc", caret: false },
  { label: "Liên hệ", href: "/#lien-he", caret: false },
];

/**
 * Navbar nổi trong suốt (`position: absolute`) — overlay đầu trang, cuộn đi
 * cùng document (không `fixed`). Mount một lần qua `app/(marketing)/layout.tsx`.
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const setAuthOpen = (val: boolean) => mutate("auth-modal", val, { revalidate: false });
  const { user, isLoggedIn, signOut } = useAuthStore();
  const cartDrawer = useCartDrawer();
  const { quantity: cartQuantity } = useCartStore();

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const handleUserClick = () => {
    if (isLoggedIn) {
      setAccountOpen((v) => !v);
      return;
    }
    setAuthOpen(true);
  };

  const handleLogout = async () => {
    await signOut();
    setAccountOpen(false);
    setMenuOpen(false);
    toast.success("Đã đăng xuất.");
  };

  const accountLabel = user?.fullName || user?.email || "Tài khoản";

  return (
    <header id="navbar" className="absolute top-0 left-0 right-0 z-30">
      <nav className="mx-auto flex h-[84px] max-w-[1200px] items-center justify-between px-6 md:px-10">
        <Link href="/" id="nav-logo" className="flex shrink-0 items-center">
          <Image
            src="/images/logo-horizontal-2x_1.svg"
            alt="Nutein"
            width={132}
            height={36}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <ul className="hidden list-none items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-white/50"
              >
                {link.label}
                {link.caret && (
                  <ChevronDown size={14} strokeWidth={2.5} className="opacity-60" />
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
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

          <div ref={accountRef} className="relative hidden md:block">
            <FillButton
              variant="ink"
              onClick={handleUserClick}
              aria-label={isLoggedIn ? "Tài khoản đã đăng nhập" : "Đăng nhập"}
              aria-expanded={isLoggedIn ? accountOpen : undefined}
              className="justify-center p-2.5 shadow-sm"
            >
              <User size={16} strokeWidth={2.2} />
            </FillButton>

            {isLoggedIn && accountOpen ? (
              <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[240px] overflow-hidden rounded-[var(--radius-lg)] border border-ink/15 bg-bg shadow-lg">
                <div className="border-b border-ink/10 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
                    Đã đăng nhập
                  </p>
                  <p className="mt-1 truncate text-[13px] font-bold text-ink">{accountLabel}</p>
                  {user?.fullName && user.email ? (
                    <p className="mt-0.5 truncate text-[12px] font-medium text-text-muted">
                      {user.email}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-[13px] font-bold text-ink transition-colors hover:bg-primary/10"
                >
                  <LogOut size={16} strokeWidth={2.2} />
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>

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

      {menuOpen && (
        <div className="flex flex-col gap-0.5 border-t border-[color:var(--color-border)] bg-bg/97 px-6 py-3 backdrop-blur-xl md:hidden">
          {NAV_LINKS.map((link) => (
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

          {isLoggedIn ? (
            <div className="rounded-lg border-b border-[color:var(--color-border-subtle)] px-2 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-primary">
                Đã đăng nhập
              </p>
              <p className="mt-1 truncate text-[14px] font-bold text-ink">{accountLabel}</p>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className={cn(
                  "mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg py-2 text-left text-[14px] font-bold text-ink"
                )}
              >
                <LogOut size={16} strokeWidth={2} />
                Đăng xuất
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setAuthOpen(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-b border-[color:var(--color-border-subtle)] px-2 py-2.5 text-left text-[15px] font-medium text-text-body"
            >
              <User size={18} strokeWidth={2} />
              Tài khoản
            </button>
          )}
        </div>
      )}
    </header>
  );
}
