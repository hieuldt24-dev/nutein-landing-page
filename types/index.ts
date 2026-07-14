/**
 * Global TypeScript types & interfaces dùng chung toàn dự án.
 *
 * Quy tắc:
 * - Đặt types dùng chung ở đây (ví dụ: pagination, sorting)
 * - Types riêng của từng feature đặt trong features/<feature-name>/types/
 */

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export type SortOrder = "asc" | "desc";

export interface SortParams {
  sortBy: string;
  sortOrder: SortOrder;
}

// ─── Common ──────────────────────────────────────────────────────────────────

/** Record có timestamps chuẩn */
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

/** Record có ID và timestamps */
export interface BaseEntity extends Timestamped {
  id: string;
}

/** Kiểu cho select option (dropdown, combobox...) */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

// ─── Next.js Route Context ───────────────────────────────────────────────────

/** Params của dynamic route trong App Router */
export type RouteParams<T extends Record<string, string>> = {
  params: T;
};
