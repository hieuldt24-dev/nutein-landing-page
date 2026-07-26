"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2, Plus, X } from "lucide-react";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { FillButton } from "@/components/ui/FillButton";
import {
  ADMIN_CONTENT_SWR_KEY,
  ADMIN_STATIC_PAGE_META,
  adminContentPageSwrKey,
} from "@/features/admin-content/constants";
import {
  parsePolicyContent,
  serializePolicyContent,
  type PolicySectionDraft,
} from "@/features/admin-content/services/policy-sections";
import { adminContentService } from "@/features/admin-content/services/admin-content.service";
import type { AdminStaticSlug } from "@/features/admin-content/types";
import { notify } from "@/lib/toast";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { formatDate } from "@/lib/utils";

function newSection(): PolicySectionDraft {
  return {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    heading: "",
    body: "",
  };
}

function contentSnapshot(
  title: string,
  intro: string,
  sections: PolicySectionDraft[],
): string {
  return JSON.stringify({
    title,
    intro,
    sections: sections.map((s) => ({
      heading: s.heading,
      body: s.body,
    })),
  });
}

/**
 * Editor trang tĩnh — tab pill + mục (##) dạng block, không hiện slug/markdown instruction.
 */
export function AdminContentEditor() {
  const [slug, setSlug] = useState<AdminStaticSlug>("bao-mat");
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(
    adminContentPageSwrKey(slug),
    () => adminContentService.getPage(slug),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [sections, setSections] = useState<PolicySectionDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseline, setBaseline] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    const parsed = parsePolicyContent(data.content);
    const nextSections =
      parsed.sections.length > 0 ? parsed.sections : [newSection()];
    setIntro(parsed.intro);
    setSections(nextSections);
    setBaseline(contentSnapshot(data.title, parsed.intro, nextSections));
  }, [data]);

  const currentSnapshot = contentSnapshot(title, intro, sections);
  const dirty =
    !isSubmitting && baseline != null && currentSnapshot !== baseline;
  const { dialog: leaveDialog, requestConfirm } =
    useUnsavedChangesGuard(dirty);

  const save = async () => {
    setIsSubmitting(true);
    try {
      const content = serializePolicyContent(intro, sections);
      const saved = await adminContentService.updatePage(slug, {
        title,
        content,
      });
      await mutate(saved, { revalidate: false });
      await globalMutate(ADMIN_CONTENT_SWR_KEY);
      setBaseline(contentSnapshot(title, intro, sections));
      notify.success("Đã lưu nội dung.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSection = (
    id: string,
    patch: Partial<Pick<PolicySectionDraft, "heading" | "body">>,
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const removeSection = (id: string) => {
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length > 0 ? next : [newSection()];
    });
  };

  const switchSlug = (next: AdminStaticSlug) => {
    if (next === slug) return;
    requestConfirm(() => {
      setBaseline(null);
      setSlug(next);
    });
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      {leaveDialog}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
          Trang tĩnh
        </h1>
        <FillButton
          type="button"
          variant="ink-solid"
          disabled={isSubmitting || isLoading || !data}
          onClick={() => void save()}
          className="h-11 w-full shrink-0 px-5 text-[13px] font-bold sm:w-auto"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Lưu thay đổi
        </FillButton>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {ADMIN_STATIC_PAGE_META.map((item) => (
          <AdminFilterChip
            key={item.slug}
            active={slug === item.slug}
            onClick={() => switchSlug(item.slug)}
            className="h-[38px] px-[18px]"
          >
            {item.label}
          </AdminFilterChip>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius-lg)] border border-ink/10 bg-border-subtle" />
      ) : null}
      {error || (!isLoading && !data) ? (
        <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
          Không tải được trang.
        </p>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-6 py-6 shadow-sm md:px-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-bold text-ink">
              Tiêu đề trang
              <input
                className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-4 py-3 font-display text-lg font-bold tracking-[-0.02em] text-ink"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <span className="shrink-0 text-[12px] font-medium text-text-muted">
              Cập nhật{" "}
              {formatDate(data.updatedAt, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Mở đầu
            <textarea
              className="rounded-[var(--radius-md)] border border-ink/20 bg-bg px-4 py-3 text-[14px] font-medium leading-relaxed text-ink"
              rows={3}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Đoạn mở đầu ngắn…"
            />
          </label>

          <div className="flex flex-col gap-3">
            {sections.map((section) => (
              <div
                key={section.id}
                className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-ink/10 bg-bg px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <input
                    className="min-w-0 flex-1 rounded-full border border-ink/15 bg-surface px-3.5 py-2 text-[14px] font-bold text-ink"
                    value={section.heading}
                    onChange={(e) =>
                      updateSection(section.id, { heading: e.target.value })
                    }
                    placeholder="Tiêu đề mục"
                  />
                  <button
                    type="button"
                    aria-label="Xóa mục"
                    onClick={() => removeSection(section.id)}
                    className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/12 text-text-muted hover:bg-ink/5 hover:text-ink"
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                </div>
                <textarea
                  className="rounded-[var(--radius-md)] border border-ink/12 bg-surface px-3.5 py-3 text-[14px] font-medium leading-relaxed text-text-body"
                  rows={4}
                  value={section.body}
                  onChange={(e) =>
                    updateSection(section.id, { body: e.target.value })
                  }
                  placeholder="Nội dung mục…"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setSections((prev) => [...prev, newSection()])}
              className="inline-flex h-[42px] w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border-[1.5px] border-dashed border-ink/25 px-5 text-[13px] font-bold text-text-body hover:border-ink/40 hover:text-ink"
            >
              <Plus size={15} strokeWidth={2.4} aria-hidden />
              Thêm mục
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
