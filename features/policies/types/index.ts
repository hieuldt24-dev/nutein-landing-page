/**
 * Public static policy pages — shape khớp `static_pages` (slug, title, content, updated_at)
 * và admin CMS. Khi có API: thay thân `policy.service` giữ chữ ký này.
 */

export const POLICY_SLUGS = [
  "bao-mat",
  "dieu-khoan",
  "giao-hang",
  "doi-tra",
  "thanh-toan",
] as const;

export type PolicySlug = (typeof POLICY_SLUGS)[number];

export function isPolicySlug(value: string): value is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(value);
}

export interface StaticPage {
  slug: PolicySlug;
  title: string;
  /** Plain text / markdown nhẹ: đoạn lead + `## 01. Tiêu đề` cho từng mục. */
  content: string;
  updatedAt: string;
}

export interface PolicySection {
  heading: string;
  body: string;
}

export interface ParsedPolicyContent {
  lead: string;
  sections: PolicySection[];
}
