"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { CHECKOUT_SUBMIT_LABEL } from "@/features/checkout/constants";
import type { CheckoutSubmitError } from "@/features/checkout/checkout-error";
import type { AccountOrder } from "@/features/account/types";
import { FillButton } from "@/components/ui/FillButton";

export interface CheckoutBlockedState {
  error: CheckoutSubmitError;
  /** Đơn chưa thanh toán CỦA CHÍNH khách — chỉ dùng cho nhánh `cap`. */
  unpaidOrders: AccountOrder[];
}

interface CheckoutSubmitBlockProps {
  isSubmitting: boolean;
  /**
   * Kết quả lần submit gần nhất bị chặn. Giỏ hàng KHÔNG bị xoá trong mọi
   * trường hợp ở đây — khách vẫn ở lại trang checkout với đúng giỏ cũ.
   */
  blocked?: CheckoutBlockedState | null;
}

/**
 * Thông báo khi vượt hạn mức đơn giữ chỗ (409 `UNPAID_ORDER_LIMIT`).
 *
 * CỐ Ý không có nút "thử lại": bấm lại chắc chắn vẫn hỏng cho tới khi khách xử
 * lý xong đơn cũ. Danh sách đơn dẫn tới trang chi tiết, nơi khách chuyển khoản
 * tiếp hoặc gửi yêu cầu hủy (plan §Public Contracts: "409 cap hướng dẫn xử lý
 * đơn cũ, không mời retry liên tục").
 */
function CheckoutCapNotice({ unpaidOrders }: { unpaidOrders: AccountOrder[] }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/5 px-4 py-3.5"
    >
      <p className="text-[13px] font-extrabold text-ink">
        Bạn đang có đơn chuyển khoản chưa hoàn tất
      </p>
      <p className="mt-1 text-[12px] font-medium text-text-body">
        Giỏ hàng của bạn vẫn được giữ nguyên. Hãy hoàn tất chuyển khoản hoặc gửi
        yêu cầu hủy cho các đơn dưới đây, sau đó quay lại đặt đơn mới.
      </p>
      {unpaidOrders.length > 0 ? (
        <ul className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
          {unpaidOrders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="text-[12.5px] font-bold text-primary-deep underline-offset-2 hover:underline"
              >
                Xử lý đơn {order.orderCode}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link
          href="/account/orders"
          className="mt-2.5 inline-block text-[12.5px] font-bold text-primary-deep underline-offset-2 hover:underline"
        >
          Xem đơn hàng của tôi
        </Link>
      )}
    </div>
  );
}

/**
 * 429 / 503 / mất mạng. Được phép thử lại VÀ phải nói rõ là thử lại an toàn:
 * `useCheckoutSubmit` giữ nguyên idempotency key nên lần bấm sau là replay của
 * cùng một đơn, không tạo đơn thứ hai.
 */
function CheckoutRetryNotice({ error }: { error: CheckoutSubmitError }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-4 py-3.5"
    >
      <p className="text-[13px] font-extrabold text-ink">
        Chưa gửi được đơn — hãy thử lại
      </p>
      <p className="mt-1 text-[12px] font-medium text-text-body">
        {error.message}
      </p>
      {typeof error.retryAfterSeconds === "number" ? (
        <p className="mt-1 text-[12px] font-semibold text-ink">
          Vui lòng thử lại sau {error.retryAfterSeconds} giây.
        </p>
      ) : null}
      <p className="mt-1 text-[12px] font-medium text-text-muted">
        Giỏ hàng được giữ nguyên. Bấm &ldquo;Đặt hàng&rdquo; lần nữa sẽ không
        tạo đơn trùng.
      </p>
    </div>
  );
}

export function CheckoutSubmitBlock({
  isSubmitting,
  blocked,
}: CheckoutSubmitBlockProps) {
  return (
    <div className="flex flex-col gap-4">
      {blocked?.error.kind === "cap" ? (
        <CheckoutCapNotice unpaidOrders={blocked.unpaidOrders} />
      ) : null}
      {blocked?.error.kind === "retryable" ? (
        <CheckoutRetryNotice error={blocked.error} />
      ) : null}
      <FillButton
        type="submit"
        variant="ink-solid"
        disabled={isSubmitting}
        className="h-[52px] w-full justify-center text-[15px] font-bold uppercase tracking-[-0.01em]"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Đang đặt hàng...
          </>
        ) : (
          CHECKOUT_SUBMIT_LABEL
        )}
      </FillButton>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-primary-deep">
        <Link
          href="/policies/doi-tra"
          className="underline-offset-2 hover:underline"
        >
          Đổi trả
        </Link>
        <Link
          href="/policies/bao-mat"
          className="underline-offset-2 hover:underline"
        >
          Bảo mật
        </Link>
        <Link
          href="/policies/dieu-khoan"
          className="underline-offset-2 hover:underline"
        >
          Điều khoản
        </Link>
        <Link
          href="/policies/thanh-toan"
          className="underline-offset-2 hover:underline"
        >
          Thanh toán
        </Link>
      </nav>
    </div>
  );
}

export function CheckoutSubmittingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/35"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-ink/10 bg-bg px-6 py-4 shadow-lg">
        <Loader2 size={22} className="animate-spin text-ink" />
        <p className="text-[14px] font-bold text-ink">Đang tạo đơn hàng…</p>
      </div>
    </div>
  );
}
