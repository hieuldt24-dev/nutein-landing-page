import type { AdminStaticSlug } from "./types";

export const ADMIN_CONTENT_SWR_KEY = "admin-content-pages";
export const ADMIN_CONTENT_MOCK_LATENCY_MS = 240;

export function adminContentPageSwrKey(slug: string): string {
  return `admin-content:${slug}`;
}

export const ADMIN_STATIC_PAGE_META: { slug: AdminStaticSlug; label: string }[] = [
  { slug: "privacy", label: "Chính sách bảo mật" },
  { slug: "terms", label: "Điều khoản sử dụng" },
  { slug: "shipping", label: "Chính sách giao hàng" },
  { slug: "return", label: "Đổi trả" },
  { slug: "payment", label: "Thanh toán" },
  { slug: "about", label: "Về Nutein" },
];
