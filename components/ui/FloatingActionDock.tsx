"use client";

import Link from "next/link";
import { useSWRConfig } from "swr";
import { Leaf, User } from "lucide-react";

/**
 * 2 nút tròn nổi cố định góc dưới-phải, hiển thị trên MỌI section (đo được
 * trên reference — không chỉ xuất hiện ở Hero). Nutein: 1 nút đi thẳng tới
 * khối mua hàng, 1 nút mở AuthModal (vì single-SKU không có giỏ hàng phức tạp).
 */
export function FloatingActionDock() {
  const { mutate } = useSWRConfig();
  const setAuthOpen = (val: boolean) => mutate("auth-modal", val, { revalidate: false });

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
      <Link
        href="#san-pham"
        aria-label="Mua ngay Nutein"
        className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-deep text-white shadow-brand flex items-center justify-center transition-transform hover:-translate-y-1 hover:scale-105"
      >
        <Leaf size={22} strokeWidth={2.2} />
      </Link>
      <button
        aria-label="Tài khoản"
        onClick={() => setAuthOpen(true)}
        className="w-14 h-14 rounded-full bg-white border border-[color:var(--color-border)] text-ink shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1 hover:scale-105"
      >
        <User size={20} strokeWidth={2.2} />
      </button>
    </div>
  );
}
