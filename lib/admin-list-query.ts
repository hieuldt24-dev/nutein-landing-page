/** Phân trang list admin — dùng chung Đơn hàng / Nhật ký. */
export const ADMIN_LIST_PAGE_SIZE = 20;

/** yyyy-mm-dd theo giờ local (cho input type="date"). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Khoảng mặc định: hôm nay và 6 ngày trước (7 ngày lịch). */
export function defaultLast7DaysRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  };
}
