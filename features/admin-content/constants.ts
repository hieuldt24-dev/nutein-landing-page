import type { AdminStaticSlug } from "./types";
import { POLICY_NAV, policyHref } from "@/features/policies/constants";

export const ADMIN_CONTENT_SWR_KEY = "admin-content-pages";

export function adminContentPageSwrKey(slug: string): string {
  return `admin-content:${slug}`;
}

export const ADMIN_STATIC_PAGE_META: { slug: AdminStaticSlug; label: string; publicPath?: string }[] =
  [
    ...POLICY_NAV.map((item) => ({
      slug: item.slug as AdminStaticSlug,
      label: item.label,
      publicPath: policyHref(item.slug),
    })),
    { slug: "about", label: "Về Nutein", publicPath: "/about" },
  ];
