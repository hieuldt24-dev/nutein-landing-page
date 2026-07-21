"use client";

import { useAuthStore } from "@/lib/useAuthStore";
import { FillButton } from "@/components/ui/FillButton";

/**
 * /admin shell — phase 0 placeholder.
 * Modules vận hành sẽ thêm theo docs/admin-portal-roadmap.md.
 */
export default function AdminHomePage() {
  const { user, role } = useAuthStore();

  const roleLabel =
    role === "admin" ? "Admin" : role === "staff" ? "Staff" : "User";

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 pt-28 pb-16 md:px-10 md:pt-32 md:pb-20">
      <p className="text-[12px] font-bold tracking-[0.08em] text-primary uppercase">
        Quản trị
      </p>
      <h1 className="mt-2 font-display text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em] text-ink">
        Khu vực quản trị
      </h1>
      <p className="mt-2 max-w-[560px] text-[15px] text-text-muted">
        Các module vận hành (đơn hàng, sản phẩm, blog, liên hệ…) sẽ được bổ sung
        theo roadmap. Staff và Admin vẫn dùng storefront Nutein như khách hàng.
      </p>

      <section className="mt-8 rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-6 md:px-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Email
            </dt>
            <dd className="mt-1 text-[15px] font-semibold text-ink">
              {user?.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Vai trò
            </dt>
            <dd className="mt-1 text-[15px] font-semibold text-ink">{roleLabel}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <FillButton
            href="/"
            variant="cream"
            className="px-5 py-2.5 text-[13px] font-bold"
          >
            Về trang chủ
          </FillButton>
          <FillButton
            href="/account"
            variant="ink"
            className="px-5 py-2.5 text-[13px] font-bold"
          >
            Tài khoản khách
          </FillButton>
        </div>
      </section>

      <p className="mt-6 text-[13px] text-text-muted">
        Chi tiết các phase tiếp theo xem trong repo:{" "}
        <code className="rounded bg-ink/5 px-1.5 py-0.5 text-[12px] font-semibold text-ink">
          docs/admin-portal-roadmap.md
        </code>
      </p>
    </div>
  );
}
