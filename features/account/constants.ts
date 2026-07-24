import type { AccountOrder, AccountOrderStatusFilter } from "./types";

/** URL thật (SWR key) cho hồ sơ — xem app/api/account/profile. */
export const ACCOUNT_PROFILE_API_PATH = "/api/account/profile";

/** URL thật (SWR key) cho sổ địa chỉ — xem app/api/account/addresses/**, lib/useAddresses.ts. */
export const ACCOUNT_ADDRESSES_API_PATH = "/api/account/addresses";

/** URL thật (SWR key) cho lịch sử đơn — xem app/api/account/orders. */
export const ACCOUNT_ORDERS_API_PATH = "/api/account/orders";

/**
 * sessionStorage — guest bị chặn ở /account* thì set trước khi về `/`,
 * AuthModal trên home đọc 1 lần rồi xóa. Logout KHÔNG set key này.
 */
export const OPEN_AUTH_MODAL_STORAGE_KEY = "nutein:open-auth-modal";

/**
 * SWR-as-store — đang logout từ AccountShell.
 * Layout guest-guard không ghi OPEN_AUTH_MODAL_STORAGE_KEY khi cờ này bật.
 */
export const ACCOUNT_LOGGING_OUT_SWR_KEY = "account-logging-out";

export const ACCOUNT_ORDER_STATUS_LABEL: Record<
  AccountOrder["status"],
  string
> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Thành công",
  cancelled: "Đã hủy",
};

/** Thứ tự chip lọc trên /account/orders. */
export const ACCOUNT_ORDER_STATUS_FILTERS: {
  value: AccountOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Tất cả" },
  ...(
    Object.entries(ACCOUNT_ORDER_STATUS_LABEL) as [
      AccountOrder["status"],
      string,
    ][]
  ).map(([value, label]) => ({ value, label })),
];
