"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartDrawer } from "@/lib/useCartDrawer";
import { useCartStore } from "@/lib/useCartStore";

/** Header tối giản checkout — logo + mở giỏ (pattern Joy Rush). */
export function CheckoutHeader() {
  const { open } = useCartDrawer();
  const { lineCount } = useCartStore();

  return (
    <header className="border-b border-ink/10 bg-bg">
      <div className="mx-auto flex h-[72px] max-w-[1100px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center" aria-label="Về trang chủ Nutein">
          <Image
            src="/images/logo-horizontal-2x_1.svg"
            alt="Nutein"
            width={120}
            height={32}
            priority
            className="h-7 w-auto"
          />
        </Link>

        <button
          type="button"
          onClick={open}
          aria-label={
            lineCount > 0
              ? `Mở giỏ hàng, ${lineCount} dòng sản phẩm`
              : "Mở giỏ hàng"
          }
          className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-ink/15 bg-surface text-ink transition-colors hover:border-ink/35"
        >
          <ShoppingBag size={18} strokeWidth={2.2} />
          {lineCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white">
              {lineCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
