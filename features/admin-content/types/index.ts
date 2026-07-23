import type { PolicySlug } from "@/features/policies/types";

/** Admin CMS slug = public policy slug + `about` (trang /about riêng). */
export type AdminStaticSlug = PolicySlug | "about";

export interface AdminStaticPage {
  slug: AdminStaticSlug;
  title: string;
  content: string;
  updatedAt: string;
}
