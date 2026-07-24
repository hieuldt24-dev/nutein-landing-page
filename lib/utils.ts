import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Kết hợp Tailwind CSS class names, tự động giải quyết xung đột.
 * Ví dụ: cn("px-2 py-1", condition && "bg-blue-500")
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format ngày tháng theo locale Việt Nam
 * Ví dụ: formatDate(new Date()) => "13/07/2026"
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  });
}

/**
 * Delay execution (dùng trong async functions)
 * Ví dụ: await sleep(1000) // chờ 1 giây
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Nhãn ngày ngắn dd/mm (chart axis / tooltip). */
export function formatDayMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Parse YYYY-MM-DD as local to tránh lệch timezone UTC.
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, day] = date.slice(0, 10).split("-").map(Number);
    const local = new Date(y, m - 1, day);
    const dd = String(local.getDate()).padStart(2, "0");
    const mm = String(local.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** Tiêu đề tooltip chart — "Ngày: dd/mm". */
export function formatChartDayTitle(date: Date | string): string {
  return `Ngày: ${formatDayMonth(date)}`;
}

/**
 * Viết hoa chữ cái đầu tiên của chuỗi
 * Ví dụ: capitalize("hello world") => "Hello world"
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Kiểm tra xem một giá trị có phải là object rỗng không
 */
export function isEmptyObject(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Format số tiền theo VND, locale Việt Nam.
 * Ví dụ: formatCurrencyVnd(249000) => "249.000 ₫"
 */
export function formatCurrencyVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}
