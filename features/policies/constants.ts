import type { PolicySlug } from "./types";

export const POLICY_PAGE_PATH = "/policies";

export function policyHref(slug: PolicySlug): string {
  return `${POLICY_PAGE_PATH}/${slug}`;
}

export const POLICY_NAV: { slug: PolicySlug; label: string }[] = [
  { slug: "bao-mat", label: "Chính sách bảo mật" },
  { slug: "dieu-khoan", label: "Điều khoản sử dụng" },
  { slug: "giao-hang", label: "Chính sách giao hàng" },
  { slug: "doi-tra", label: "Đổi trả" },
  { slug: "thanh-toan", label: "Thanh toán" },
];

/** Footer / checkout — nhãn ngắn. */
export const POLICY_FOOTER_LINKS = [
  { label: "Giao hàng", href: policyHref("giao-hang") },
  { label: "Đổi trả", href: policyHref("doi-tra") },
  { label: "Bảo mật", href: policyHref("bao-mat") },
  { label: "Điều khoản sử dụng", href: policyHref("dieu-khoan") },
  { label: "Thanh toán", href: policyHref("thanh-toan") },
] as const;
