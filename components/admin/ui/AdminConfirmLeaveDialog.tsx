"use client";

import { FillButton } from "@/components/ui/FillButton";
import { cn } from "@/lib/utils";

type AdminConfirmLeaveDialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

/**
 * Xác nhận rời trang khi còn thay đổi chưa lưu — giọng ngắn, không jargon.
 */
export function AdminConfirmLeaveDialog({
  open,
  onStay,
  onLeave,
}: AdminConfirmLeaveDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onClick={onStay}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-leave-title"
        aria-describedby="admin-leave-desc"
        className={cn(
          "w-full max-w-[400px] rounded-[20px] border border-ink/10 bg-surface p-5 shadow-lg sm:p-6",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="admin-leave-title"
          className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink"
        >
          Chưa lưu thay đổi
        </h2>
        <p
          id="admin-leave-desc"
          className="mt-2 text-[14px] font-medium leading-relaxed text-text-muted"
        >
          Nếu rời đi bây giờ, các thay đổi vừa nhập sẽ mất.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <FillButton
            type="button"
            variant="ink"
            onClick={onStay}
            className="h-11 justify-center px-5 text-[13px] font-bold"
          >
            Ở lại
          </FillButton>
          <FillButton
            type="button"
            variant="ink-solid"
            onClick={onLeave}
            className="h-11 justify-center px-5 text-[13px] font-bold"
          >
            Rời đi
          </FillButton>
        </div>
      </div>
    </div>
  );
}
