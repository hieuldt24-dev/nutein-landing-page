import type { AccountOrder } from "./types";

/** Persist profile + sổ địa chỉ theo email — swap sang API khi có session server. */
export const ACCOUNT_DATA_STORAGE_KEY = "nutein:account-data";

/** SWR-as-store prefix — `account-data:${email}` (không phải URL). */
export const ACCOUNT_DATA_SWR_KEY_PREFIX = "account-data";

export function accountDataSwrKey(email: string): string {
  return `${ACCOUNT_DATA_SWR_KEY_PREFIX}:${email.trim().toLowerCase()}`;
}

/** Delay giả lập latency khi mutate local — bỏ khi gắn API. */
export const ACCOUNT_LOCAL_LATENCY_MS = 280;

/** URL thật (SWR key) cho sổ địa chỉ — xem app/api/account/addresses/**, lib/useAddresses.ts. */
export const ACCOUNT_ADDRESSES_API_PATH = "/api/account/addresses";

export const ACCOUNT_ORDER_STATUS_LABEL: Record<
  AccountOrder["status"],
  string
> = {
  processing: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Thành công",
};
