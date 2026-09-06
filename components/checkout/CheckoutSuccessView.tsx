"use client";

import { FillButton } from "@/components/ui/FillButton";
import type { CreateOrderResult } from "@/features/checkout/types";
import type { AccountOrderDetail } from "@/features/account/types";
import {
  describePaymentReview,
  formatPaymentDeadline,
  isPaymentDeadlinePassed,
} from "@/features/account/payment-review";
import {
  PAYMENT_OPTIONS,
  SHIPPING_OPTIONS,
} from "@/features/checkout/constants";
import { formatCurrencyVnd } from "@/lib/utils";

interface CheckoutSuccessViewProps {
  order: CreateOrderResult;
  /**
   * Trạng thái THẬT đọc từ `GET /api/account/orders/[id]` (no-store). Khi có,
   * nó thắng snapshot sessionStorage ở mọi điểm liên quan tới thanh toán: hạn
   * chuyển khoản, QR, trạng thái đối soát. Snapshot chỉ còn dùng cho phần tĩnh
   * (địa chỉ, tổng tiền) — plan: "không tin localStorage là trạng thái thật".
   *
   * `null` = chưa tải xong hoặc tải hỏng -> rơi về snapshot, KHÔNG chặn màn
   * xác nhận (đơn đã tạo rồi, không được làm khách hoảng).
   */
  serverState?: AccountOrderDetail | null;
  /** Chỉ dùng cho test — runtime luôn `new Date()`. */
  now?: Date;
}

export function CheckoutSuccessView({
  order,
  serverState,
  now,
}: CheckoutSuccessViewProps) {
  // Chuyển khoản = VietQR tự host: KHÔNG có webhook/poll trạng thái nào, màn
  // này là xác nhận tĩnh — nhân viên xác nhận thủ công sau khi nhận tiền.
  const isBankTransfer = order.paymentMethod === "bank_transfer";
  const evaluatedAt = now ?? new Date();

  /**
   * `replayed: true` = request này trả về ĐƠN CŨ, không tạo đơn mới. Không ăn
   * mừng "đặt hàng thành công" lần thứ hai — nói đúng chuyện đã xảy ra.
   * Optional field (RFC-2 D2): server cũ không gửi -> coi như đơn mới.
   */
  const isReplay = order.replayed === true;

  /**
   * Hạn + QR CHỈ lấy từ server. Ưu tiên `serverState` (đọc lại lúc mở trang);
   * nếu chưa có thì dùng `paymentExpiresAt` server đã trả trong response tạo
   * đơn. Không có nhánh nào tính hạn bằng đồng hồ trình duyệt.
   */
  const paymentExpiresAt =
    serverState?.paymentExpiresAt ?? order.paymentExpiresAt ?? null;
  const deadlineLabel = formatPaymentDeadline(paymentExpiresAt);
  const deadlinePassed = isPaymentDeadlinePassed(paymentExpiresAt, evaluatedAt);

  const review = serverState
    ? describePaymentReview(serverState, evaluatedAt)
    : null;
  const qrImageUrl = serverState
    ? (serverState.qrImageUrl ?? null)
    : (order.qrImageUrl ?? null);
  // Quá hạn -> ẨN QR (không tự huỷ đơn: không có worker hết hạn, trạng thái
  // chỉ đổi ở server — plan §Vòng đời chuyển khoản).
  const showQr = review
    ? review.showQr
    : Boolean(qrImageUrl) && !deadlinePassed;

  const shippingLabel =
    SHIPPING_OPTIONS.find((o) => o.value === order.shippingMethod)?.label ??
    order.shippingMethod;
  const paymentLabel =
    PAYMENT_OPTIONS.find((o) => o.value === order.paymentMethod)?.label ??
    order.paymentMethod;

  return (
    <div className="mx-auto max-w-[640px] px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
        {isReplay ? "Đơn hàng của bạn" : "Đặt hàng thành công"}
      </p>
      <h1 className="mt-3 font-display text-[clamp(32px,5vw,48px)] font-black uppercase leading-tight tracking-[-0.04em] text-ink">
        {isReplay
          ? "Đơn này đã được tạo trước đó"
          : "Cảm ơn bạn đã chọn Nutein"}
      </h1>
      {isReplay ? (
        <p className="mt-3 text-[13px] font-semibold text-text-body">
          Chúng tôi không tạo thêm đơn mới — đây chính là đơn bạn đã đặt.
        </p>
      ) : null}
      <p className="mt-4 text-[14px] font-semibold text-text-body">
        Mã đơn hàng của bạn là{" "}
        <span className="font-extrabold text-ink">{order.orderCode}</span>.
        Chúng tôi sẽ liên hệ xác nhận qua SĐT hoặc email khi xử lý đơn.
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-ink/10 bg-surface p-6">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.06em] text-ink">
          Thông tin giao hàng
        </h2>
        <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
          <div>
            <dt className="text-[12px] font-bold text-text-muted">
              Người nhận
            </dt>
            <dd className="font-semibold text-ink">
              {order.buyer.fullName} · {order.buyer.phone}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Email</dt>
            <dd className="font-semibold text-ink">{order.buyer.email}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">Địa chỉ</dt>
            <dd className="font-semibold text-ink">
              {order.address.street}, {order.address.ward},{" "}
              {order.address.province}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">
              Vận chuyển
            </dt>
            <dd className="font-semibold text-ink">
              {shippingLabel} — {order.estimatedDeliveryLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-text-muted">
              Thanh toán
            </dt>
            <dd className="font-semibold text-ink">{paymentLabel}</dd>
          </div>
          <div className="border-t border-ink/10 pt-3">
            <dt className="text-[12px] font-bold text-text-muted">
              Tổng thanh toán
            </dt>
            <dd className="font-display text-[22px] font-bold text-ink">
              {formatCurrencyVnd(order.summary.total)}
            </dd>
          </div>
        </dl>

        {isBankTransfer ? (
          <div className="mt-5 rounded-[var(--radius-md)] border border-ink/10 bg-bg px-4 py-3">
            <p className="text-[13px] font-extrabold text-ink">
              {review ? review.headline : "Đang chờ xác nhận thanh toán"}
            </p>
            {review ? (
              <p className="mt-1 text-[12px] font-medium text-text-body">
                {review.detail}
              </p>
            ) : null}

            {/* Hạn chuyển khoản: CHỈ từ giờ server. Không có hạn (COD/legacy/
                enforcement tắt) -> không vẽ đồng hồ nào cả. */}
            {deadlineLabel ? (
              <p className="mt-2 text-[12px] font-bold text-ink">
                {deadlinePassed
                  ? `Hạn chuyển khoản (đã qua): ${deadlineLabel}`
                  : `Hạn chuyển khoản: ${deadlineLabel}`}
              </p>
            ) : null}

            {showQr && qrImageUrl ? (
              <>
                <p className="mt-1 text-[12px] font-medium text-text-body">
                  Quét mã QR bên dưới bằng app ngân hàng để chuyển khoản. Số
                  tiền và nội dung chuyển khoản ({order.orderCode}) đã được điền
                  sẵn.
                </p>
                {/* Ảnh QR do VietQR sinh (host ngoài) — dùng <img> thường thay vì
                    next/image để không phải khai báo remotePatterns cho 1 ảnh tĩnh. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt={`Mã QR chuyển khoản VietQR cho đơn ${order.orderCode}`}
                  className="mt-3 w-full max-w-[320px] rounded-[var(--radius-md)] border border-ink/10 bg-white"
                />
              </>
            ) : deadlinePassed ? (
              <p className="mt-1 text-[12px] font-medium text-text-body">
                Đã qua hạn chuyển khoản nên mã QR được tạm ẩn. Đơn của bạn chưa
                bị hủy — nhân viên sẽ đối soát sao kê rồi liên hệ với bạn.
              </p>
            ) : !qrImageUrl ? (
              <p className="mt-1 text-[12px] font-medium text-text-body">
                Chưa tạo được mã QR chuyển khoản — vui lòng liên hệ với chúng
                tôi để được hỗ trợ thanh toán cho đơn {order.orderCode}.
              </p>
            ) : null}

            <p className="mt-3 text-[12px] font-medium text-text-body">
              Đơn hàng sẽ được xác nhận thủ công sau khi chúng tôi nhận được
              tiền. Báo &ldquo;đã chuyển khoản&rdquo; là thông tin bạn cung cấp,
              chưa phải xác nhận thanh toán.
            </p>
            <FillButton
              href={`/account/orders/${order.orderId}`}
              variant="ink"
              className="mt-3 h-10 justify-center px-4 text-[12px] font-bold uppercase"
            >
              Quản lý đơn này
            </FillButton>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <FillButton
          href="/#san-pham"
          variant="ink-solid"
          className="h-[48px] justify-center px-6 text-[14px] font-bold uppercase"
        >
          Tiếp tục mua sắm
        </FillButton>
        <FillButton
          href="/blog"
          variant="ink"
          className="h-[48px] justify-center px-6 text-[14px] font-bold uppercase"
        >
          Khám phá Blog
        </FillButton>
      </div>

      {!isBankTransfer ? (
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          Đơn demo — chưa trừ tiền / chưa đồng bộ kho thật
        </p>
      ) : null}
    </div>
  );
}
