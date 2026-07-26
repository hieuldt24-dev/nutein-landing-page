import type { useSWRConfig } from "swr";
import {
  ADMIN_DASHBOARD_OPS_SWR_KEY,
  ADMIN_DASHBOARD_REVENUE_SWR_KEY,
  ADMIN_HOME_SWR_KEY,
} from "@/features/admin-dashboard/constants";
import { ADMIN_BLOG_SWR_KEY } from "@/features/admin-blog/constants";
import { ADMIN_CONTACT_SWR_KEY } from "@/features/admin-contact/constants";
import { ADMIN_ORDERS_SWR_KEY } from "@/features/admin-orders/constants";
import { ADMIN_USERS_SWR_KEY } from "@/features/admin-users/constants";

type GlobalMutate = ReturnType<typeof useSWRConfig>["mutate"];

function prefixMatcher(prefix: string) {
  return (key: unknown) => typeof key === "string" && key.startsWith(prefix);
}

/** Sau đổi trạng thái đơn — list + KPI vận hành + doanh thu (+ home Admin). */
export async function revalidateAfterOrderMutation(mutate: GlobalMutate) {
  await Promise.all([
    mutate(prefixMatcher(ADMIN_ORDERS_SWR_KEY), undefined, { revalidate: true }),
    mutate(ADMIN_DASHBOARD_OPS_SWR_KEY),
    mutate(ADMIN_DASHBOARD_REVENUE_SWR_KEY),
    mutate(ADMIN_HOME_SWR_KEY),
  ]);
}

/** Sau đọc/xử lý liên hệ — list chips + KPI chưa đọc. */
export async function revalidateAfterContactMutation(mutate: GlobalMutate) {
  await Promise.all([
    mutate(prefixMatcher(ADMIN_CONTACT_SWR_KEY), undefined, {
      revalidate: true,
    }),
    mutate(ADMIN_DASHBOARD_OPS_SWR_KEY),
  ]);
}

/** Sau lưu sản phẩm/kho — KPI tồn thấp. */
export async function revalidateAfterProductMutation(mutate: GlobalMutate) {
  await mutate(ADMIN_DASHBOARD_OPS_SWR_KEY);
}

/** Sau đổi role / khóa user — chips + thẻ Staff/Admin ở /admin. */
export async function revalidateAfterUserMutation(mutate: GlobalMutate) {
  await Promise.all([
    mutate(prefixMatcher(ADMIN_USERS_SWR_KEY), undefined, { revalidate: true }),
    mutate(ADMIN_HOME_SWR_KEY),
  ]);
}

/** Sau lưu / xuất bản blog — list + chip Nháp. */
export async function revalidateAfterBlogMutation(mutate: GlobalMutate) {
  await mutate(prefixMatcher(ADMIN_BLOG_SWR_KEY), undefined, {
    revalidate: true,
  });
}
