"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FillButton } from "@/components/ui/FillButton";
import type { AdminOrder } from "@/features/admin-orders/types";
import {
  REVIEW_QUEUE_BUCKET_LABEL,
  reviewQueueBucket,
} from "@/features/admin-orders/review-queue";

export interface AdminPaymentReviewSubmit {
  outcome: "no-transfer" | "needs-investigation";
  reason: string;
  expectedVersion: number;
  statementCheckedFrom?: string;
  statementCheckedTo?: string;
  reference?: string;
}

interface AdminPaymentReviewPanelProps {
  order: AdminOrder;
  isSubmitting: boolean;
  onSubmit: (input: AdminPaymentReviewSubmit) => void;
  now?: Date;
}

/**
 * Form kết luận đối soát của nhân viên (RFC-4, gọi route RFC-3).
 *
 * Ba điều component này CỐ Ý không làm:
 * - Không có nút nào đặt PAID. Xác nhận đã nhận tiền là hành động KHÁC
 *   (`confirm-payment`) với bằng chứng khác.
 * - Không nhận upload file (V1). Ảnh chụp màn hình của khách KHÔNG phải chứng
 *   cứ ngân hàng — chứng cứ là sao kê nhân viên tự kiểm.
 * - Không tự suy ra kết luận từ việc khách đã bấm "tôi đã chuyển khoản".
 *
 * `expectedVersion` luôn là version của đơn ĐANG HIỂN THỊ, nên nếu đơn đã đổi
 * ở nơi khác thì server trả 409 và nhân viên phải tải lại.
 */
export function AdminPaymentReviewPanel({
  order,
  isSubmitting,
  onSubmit,
  now,
}: AdminPaymentReviewPanelProps) {
  const [outcome, setOutcome] = useState<"no-transfer" | "needs-investigation">(
    "needs-investigation",
  );
  const [reason, setReason] = useState("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [reference, setReference] = useState("");

  const bucket = reviewQueueBucket(order, now ?? new Date());
  const stateVersion = order.stateVersion;

  // Cột `state_version` chưa tồn tại (migration RFC-2 chưa apply) -> route sẽ
  // từ chối vì `expectedVersion` là bắt buộc. Nói thẳng thay vì để nhân viên
  // bấm rồi nhận lỗi khó hiểu.
  if (stateVersion == null) {
    return (
      <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-6">
        <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
          Đối soát thanh toán
        </h3>
        <p className="mt-1.5 text-[13px] font-medium text-text-muted">
          Chức năng đối soát chưa khả dụng trên môi trường này (đơn chưa có dữ
          liệu phiên bản trạng thái). Vẫn dùng &ldquo;Xác nhận đã nhận thanh
          toán&rdquo; như trước.
        </p>
      </section>
    );
  }

  const canSubmit = reason.trim().length > 0 && !isSubmitting;

  return (
    <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
          Đối soát thanh toán
        </h3>
        {bucket !== "none" ? (
          <span className="inline-flex items-center rounded-full bg-ink/10 px-2.5 py-[3px] text-[10px] font-extrabold tracking-[0.02em] text-text-muted uppercase">
            {REVIEW_QUEUE_BUCKET_LABEL[bucket]}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[13px] font-medium text-text-muted">
        Kết luận dựa trên sao kê ngân hàng bạn tự kiểm. Lời khai hoặc ảnh chụp
        của khách không phải chứng cứ. Chọn &ldquo;chưa nhận được tiền&rdquo; sẽ
        hủy đơn và hoàn lại hàng/mã giảm giá đang giữ.
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {(
          [
            ["needs-investigation", "Chưa kết luận được"],
            ["no-transfer", "Đã kiểm — chưa nhận được tiền"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={outcome === value}
            onClick={() => setOutcome(value)}
            className={
              outcome === value
                ? "inline-flex h-10 cursor-pointer items-center rounded-full border-[1.5px] border-ink bg-ink px-[18px] text-[13px] font-bold text-bg"
                : "inline-flex h-10 cursor-pointer items-center rounded-full border-[1.5px] border-ink/20 px-[18px] text-[13px] font-bold text-ink hover:bg-ink/[0.04]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-3.5 flex flex-col gap-1.5 text-[13px] font-bold text-ink">
        Lý do kết luận (bắt buộc)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ví dụ: đã kiểm sao kê 06/09 08:00–12:00, không có giao dịch khớp nội dung"
          className="rounded-[14px] border border-ink/20 bg-bg px-3.5 py-2.5 text-[14px] font-medium text-ink placeholder:text-text-faint"
        />
      </label>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          Sao kê đã kiểm từ
          <input
            type="datetime-local"
            value={statementFrom}
            onChange={(e) => setStatementFrom(e.target.value)}
            className="rounded-[14px] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium text-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          Đến
          <input
            type="datetime-local"
            value={statementTo}
            onChange={(e) => setStatementTo(e.target.value)}
            className="rounded-[14px] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium text-ink"
          />
        </label>
      </div>

      <label className="mt-3.5 flex flex-col gap-1.5 text-[13px] font-bold text-ink">
        Tham chiếu nội bộ
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Số ticket / mã đối soát"
          className="rounded-[14px] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium text-ink placeholder:text-text-faint"
        />
      </label>

      <FillButton
        type="button"
        variant="ink-solid"
        disabled={!canSubmit}
        onClick={() =>
          onSubmit({
            outcome,
            reason: reason.trim(),
            expectedVersion: stateVersion,
            ...(statementFrom
              ? { statementCheckedFrom: new Date(statementFrom).toISOString() }
              : {}),
            ...(statementTo
              ? { statementCheckedTo: new Date(statementTo).toISOString() }
              : {}),
            ...(reference.trim() ? { reference: reference.trim() } : {}),
          })
        }
        className="mt-3.5 h-11 justify-center px-[22px] text-[13px] font-bold"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Lưu kết luận đối soát
      </FillButton>
    </section>
  );
}
