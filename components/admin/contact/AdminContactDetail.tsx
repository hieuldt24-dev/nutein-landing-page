"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";
import { AdminBackLink } from "@/components/admin/ui/AdminBackLink";
import { AdminToggle } from "@/components/admin/ui/AdminToggle";
import { FillButton } from "@/components/ui/FillButton";
import { adminContactDetailSwrKey } from "@/features/admin-contact/constants";
import { adminContactService } from "@/features/admin-contact/services/admin-contact.service";
import { revalidateAfterContactMutation } from "@/lib/admin-swr-revalidate";
import { notify } from "@/lib/toast";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { cn, formatDate } from "@/lib/utils";

export function AdminContactDetail({ messageId }: { messageId: string }) {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(
    adminContactDetailSwrKey(messageId),
    () => adminContactService.getById(messageId),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const [note, setNote] = useState("");
  const [baselineNote, setBaselineNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !data.isRead) {
      void adminContactService.markRead(messageId).then((updated) => {
        void mutate(updated, { revalidate: false });
        void revalidateAfterContactMutation(globalMutate);
      });
    }
  }, [data, globalMutate, messageId, mutate]);

  useEffect(() => {
    if (!data) return;
    const next = data.internalNote ?? "";
    setNote(next);
    setBaselineNote(next);
  }, [data]);

  const dirty = !busy && note !== baselineNote;
  const { dialog: leaveDialog } = useUnsavedChangesGuard(dirty);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="h-64 animate-pulse rounded-[20px] bg-border-subtle" />
        <div className="h-48 animate-pulse rounded-[20px] bg-border-subtle" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-sm font-semibold text-red-700">Không tìm thấy tin.</p>
    );
  }

  const run = async (
    fn: () => Promise<unknown>,
    ok: string,
    options?: { clearNoteDirty?: boolean },
  ) => {
    setBusy(true);
    try {
      const updated = (await fn()) as typeof data;
      await mutate(updated, { revalidate: false });
      await revalidateAfterContactMutation(globalMutate);
      if (options?.clearNoteDirty) {
        setBaselineNote(note);
      }
      notify.success(ok);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      {leaveDialog}
      <AdminBackLink href="/staff/contact">Liên hệ</AdminBackLink>

      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-[20px] border border-ink/10 bg-surface px-5 py-6 shadow-sm md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[clamp(22px,4vw,26px)] font-bold tracking-[-0.03em] text-ink">
              {data.name}
            </h2>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase",
                !data.isRead
                  ? "bg-primary-soft text-primary-deep"
                  : data.isHandled
                    ? "bg-lime/50 text-forest"
                    : "bg-ink/10 text-text-muted",
              )}
            >
              {!data.isRead
                ? "Chưa đọc"
                : data.isHandled
                  ? "Đã xử lý"
                  : "Chưa xử lý"}
            </span>
          </div>
          <p className="mt-2 text-[13px] font-medium text-text-muted">
            {data.email}
            {data.phone ? ` · ${data.phone}` : ""} ·{" "}
            {formatDate(data.createdAt, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-5 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-ink">
            {data.message}
          </p>
        </section>

        <aside className="flex flex-col gap-4 rounded-[20px] border border-ink/10 bg-surface px-5 py-5 shadow-sm">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Ghi chú
            <textarea
              className="rounded-[14px] border border-ink/20 bg-bg px-3.5 py-2.5 text-[14px] font-medium"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thêm ghi chú…"
            />
          </label>
          <FillButton
            type="button"
            variant="ink-solid"
            disabled={busy}
            onClick={() =>
              void run(
                () => adminContactService.setNote(messageId, note),
                "Đã lưu ghi chú.",
                { clearNoteDirty: true },
              )
            }
            className="h-10 justify-center px-4 text-[13px] font-bold"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu ghi chú
          </FillButton>

          <div className="border-t border-ink/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-ink">Đã xử lý</p>
              <AdminToggle
                checked={data.isHandled}
                disabled={busy}
                label="Đã xử lý"
                onChange={(next) => {
                  void run(
                    () => adminContactService.markHandled(messageId, next),
                    next ? "Đã đánh dấu xử lý." : "Đã mở lại.",
                  );
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
