"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";
import {
  ADMIN_CONTACT_SWR_KEY,
  adminContactDetailSwrKey,
} from "@/features/admin-contact/constants";
import { adminContactService } from "@/features/admin-contact/services/admin-contact.service";
import { notify } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

export function AdminContactDetail({ messageId }: { messageId: string }) {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(
    adminContactDetailSwrKey(messageId),
    () => adminContactService.getById(messageId),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !data.isRead) {
      void adminContactService.markRead(messageId).then((updated) => {
        void mutate(updated, { revalidate: false });
        void globalMutate(
          (key) => typeof key === "string" && key.startsWith(ADMIN_CONTACT_SWR_KEY),
          undefined,
          { revalidate: true }
        );
      });
    }
  }, [data, globalMutate, messageId, mutate]);

  useEffect(() => {
    if (data) setNote(data.internalNote ?? "");
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
    );
  }
  if (error || !data) {
    return <p className="text-sm font-semibold text-red-700">Không tìm thấy tin.</p>;
  }

  const refreshLists = async () => {
    await globalMutate(
      (key) => typeof key === "string" && key.startsWith(ADMIN_CONTACT_SWR_KEY),
      undefined,
      { revalidate: true }
    );
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const updated = (await fn()) as typeof data;
      await mutate(updated, { revalidate: false });
      await refreshLists();
      notify.success(ok);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/contact"
        className="text-[13px] font-bold text-primary-deep underline-offset-2 hover:underline"
      >
        ← Hộp thư
      </Link>
      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
        <h2 className="font-display text-xl font-bold text-ink">{data.name}</h2>
        <p className="mt-1 text-[13px] text-text-muted">
          {data.email}
          {data.phone ? ` · ${data.phone}` : ""} · {formatDate(data.createdAt)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-[15px] text-ink">{data.message}</p>
      </section>
      <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Ghi chú nội bộ
          <textarea
            className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px]"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() => adminContactService.setNote(messageId, note), "Đã lưu ghi chú.")
            }
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-bg disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu ghi chú
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => adminContactService.markHandled(messageId, !data.isHandled),
                data.isHandled ? "Đã mở lại." : "Đã đánh dấu xử lý."
              )
            }
            className="cursor-pointer rounded-full border border-ink/20 px-4 py-2 text-[13px] font-bold disabled:opacity-50"
          >
            {data.isHandled ? "Mở lại" : "Đánh dấu đã xử lý"}
          </button>
        </div>
      </section>
    </div>
  );
}
