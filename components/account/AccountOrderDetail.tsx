"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import { AccountOrderStatusBadge } from "@/components/account/AccountOrderStatusBadge";
import { accountOrderClient } from "@/features/account/services/account-order.client";
import { describePaymentReview } from "@/features/account/payment-review";
import type { AccountOrderDetail as AccountOrderDetailDto } from "@/features/account/types";
import type { FetchError } from "@/lib/api-client";
import { notify } from "@/lib/toast";
import { formatCurrencyVnd } from "@/lib/utils";

interface AccountOrderDetailProps {
  orderId: string;
  /**
   * Chỉ dùng cho test/story. Runtime luôn để trống -> `new Date()` mỗi lần
   * render. Hạn thanh toán vẫn LUÔN đến từ `order.paymentExpiresAt` (giờ DB);
   * `now` chỉ dùng để so sánh, không bao giờ để TÍNH ra hạn.
   */
  now?: Date;
}

/**
 * Chi tiết đơn của chính khách (RFC-4).
 *
 * Nguồn sự thật là `GET /api/account/orders/[id]` (no-store) — KHÔNG đọc
 * sessionStorage, không đoán trạng thái. Sau mỗi thao tác và sau mỗi lỗi 409,
 * component fetch lại và vẽ theo dữ liệu server thay vì ghi đè cục bộ.
 */
export function AccountOrderDetail({ orderId, now }: AccountOrderDetailProps) {
  const [pendingAction, setPendingAction] = useState<"claim" | "cancel" | null>(
    null,
  );

  /**
   * SWR như phần còn lại của portal account. `dedupingInterval: 0` là CÓ CHỦ Ý:
   * sau mỗi thao tác (và sau mỗi 409) ta phải đọc lại thật, không được nhận một
   * bản cache còn trong cửa sổ dedupe — đó chính là lúc trạng thái vừa đổi.
   */
  const {
    data: order,
    error: loadError,
    isLoading,
    mutate: reload,
  } = useSWR(
    `account-order-detail:${orderId}`,
    () => accountOrderClient.getOrderDetail(orderId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 0,
      shouldRetryOnError: false,
    },
  );

  /**
   * 409 `ORDER_STATE_CONFLICT` = đơn đã đổi ở nơi khác (nhân viên vừa xác nhận,
   * tab khác vừa claim). Đọc lại rồi vẽ theo server — KHÔNG ghi đè bằng kết quả
   * lạc quan phía client.
   */
  const runAction = async (
    action: "claim" | "cancel",
    current: AccountOrderDetailDto,
  ) => {
    setPendingAction(action);
    try {
      if (action === "claim") {
        await accountOrderClient.claimPayment(current.id, {
          expectedVersion: current.stateVersion,
        });
        notify.success(
          "Đã ghi nhận. Nhân viên sẽ đối chiếu sao kê rồi xác nhận.",
        );
      } else {
        const result = await accountOrderClient.requestCancel(current.id, {
          expectedVersion: current.stateVersion,
        });
        notify.success(
          result.changed
            ? "Đã gửi yêu cầu hủy. Nhân viên sẽ xem xét và phản hồi bạn."
            : "Yêu cầu hủy của bạn đã được ghi nhận trước đó.",
        );
      }
    } catch (err) {
      const fetchError = err as FetchError;
      if (fetchError?.code === "ORDER_STATE_CONFLICT") {
        notify.error(
          "Đơn đã thay đổi trạng thái — đang tải lại thông tin mới.",
        );
      } else {
        notify.error(
          err instanceof Error ? err.message : "Thao tác không thành công.",
        );
      }
    } finally {
      setPendingAction(null);
      // Luôn đọc lại, kể cả khi thành công: server là nguồn sự thật duy nhất.
      await reload();
    }
  };

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-ink/5" />
    );
  }

  if (loadError || !order) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-8 text-center">
        <p className="text-sm font-semibold text-red-600">
          {loadError instanceof Error
            ? loadError.message
            : "Không tìm thấy đơn hàng."}
        </p>
        <FillButton
          href="/account/orders"
          variant="ink"
          className="mt-4 justify-center px-5 py-2.5 text-[13px] font-bold"
        >
          Về danh sách đơn
        </FillButton>
      </div>
    );
  }

  const presentation = describePaymentReview(order, now ?? new Date());
  const canClaim = order.allowedActions.includes("claim_payment");
  const canCancel = order.allowedActions.includes("request_cancel");
  const hasClaimed = order.reviewState === "PAYMENT_CLAIMED";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-bold text-ink">
              {order.orderCode}
            </p>
            <p className="mt-1 text-[13px] text-text-body">
              Nutein · {order.variantLabel} · {order.quantity} hũ
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <AccountOrderStatusBadge status={order.status} />
            <p className="font-display text-lg font-bold text-ink">
              {formatCurrencyVnd(order.total)}
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
        <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink uppercase">
          Trạng thái thanh toán
        </h2>
        <p className="mt-3 text-[15px] font-bold text-ink">
          {presentation.headline}
        </p>
        <p className="mt-1 text-[13px] font-medium text-text-body">
          {presentation.detail}
        </p>

        {/* Hạn LUÔN từ server (`payment_expires_at`). Không có hạn -> không vẽ. */}
        {presentation.deadlineLabel ? (
          <p className="mt-3 text-[13px] font-semibold text-ink">
            {presentation.deadlinePassed
              ? `Hạn chuyển khoản (đã qua): ${presentation.deadlineLabel}`
              : `Hạn chuyển khoản: ${presentation.deadlineLabel}`}
          </p>
        ) : null}

        {presentation.showQr && order.qrImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.qrImageUrl}
              alt={`Mã QR chuyển khoản VietQR cho đơn ${order.orderCode}`}
              className="mt-4 w-full max-w-[300px] rounded-[var(--radius-md)] border border-ink/10 bg-white"
            />
            <p className="mt-2 text-[12px] font-medium text-text-muted">
              Nội dung chuyển khoản: {order.orderCode}
            </p>
          </>
        ) : null}
      </section>

      {canClaim || canCancel ? (
        <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
          <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink uppercase">
            Thao tác
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {canClaim ? (
              <FillButton
                type="button"
                variant="ink-solid"
                disabled={pendingAction !== null || hasClaimed}
                onClick={() => {
                  void runAction("claim", order);
                }}
                className="h-11 justify-center px-5 text-[13px] font-bold"
              >
                {pendingAction === "claim" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                Tôi đã chuyển khoản
              </FillButton>
            ) : null}
            {canCancel ? (
              <FillButton
                type="button"
                variant="ink"
                disabled={pendingAction !== null}
                onClick={() => {
                  void runAction("cancel", order);
                }}
                className="h-11 justify-center px-5 text-[13px] font-bold"
              >
                {pendingAction === "cancel" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                Yêu cầu hủy đơn
              </FillButton>
            ) : null}
          </div>
          <p className="mt-3 text-[12px] font-medium text-text-muted">
            &ldquo;Tôi đã chuyển khoản&rdquo; là thông báo của bạn, không phải
            xác nhận đã nhận tiền — nhân viên đối chiếu sao kê ngân hàng rồi mới
            xác nhận. &ldquo;Yêu cầu hủy đơn&rdquo; là một yêu cầu chờ nhân viên
            xử lý, đơn không bị hủy ngay.
          </p>
        </section>
      ) : null}

      <FillButton
        href="/account/orders"
        variant="ink"
        className="w-fit justify-center px-5 py-2.5 text-[13px] font-bold"
      >
        Về danh sách đơn
      </FillButton>
    </div>
  );
}
