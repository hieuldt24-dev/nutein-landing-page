"use client";

type AdminListPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/**
 * Prev/Next + “Hiển thị X–Y / total” cho list admin có phân trang server.
 */
export function AdminListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: AdminListPaginationProps) {
  if (total <= 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-[13px] font-semibold text-text-muted">
        Hiển thị {from}–{to} / {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center rounded-full border border-ink/15 bg-surface px-4 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          Trước
        </button>
        <span className="min-w-[4.5rem] text-center text-[12.5px] font-semibold text-text-muted">
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center rounded-full border border-ink/15 bg-surface px-4 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
