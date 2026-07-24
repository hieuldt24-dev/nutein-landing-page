import "server-only";

import { getSupabaseClient } from "@/lib/supabase";
import { POLICY_SLUGS, isPolicySlug } from "../types";
import type { PolicySlug, StaticPage } from "../types";

interface StaticPageRow {
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

const PAGE_SELECT = "slug, title, content, updated_at";

function toStaticPage(row: StaticPageRow): StaticPage {
  return {
    slug: row.slug as PolicySlug,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

/**
 * Public policy pages — đọc bảng `static_pages` thật qua anon client (RLS
 * "Public can view static pages" cho phép đọc công khai). Cùng bảng Staff
 * "Trang tĩnh" ghi vào — sửa ở `/staff/content` hiện ra ở đây ngay.
 */
export const policyService = {
  listSlugs(): PolicySlug[] {
    return [...POLICY_SLUGS];
  },

  async getBySlug(slug: string): Promise<StaticPage | null> {
    if (!isPolicySlug(slug)) return null;

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("static_pages")
      .select(PAGE_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Không tải được trang chính sách: ${error.message}`);
    }
    return data ? toStaticPage(data as StaticPageRow) : null;
  },

  async list(): Promise<StaticPage[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("static_pages")
      .select(PAGE_SELECT)
      .in("slug", POLICY_SLUGS);

    if (error) {
      throw new Error(`Không tải được danh sách trang chính sách: ${error.message}`);
    }
    return ((data as StaticPageRow[]) ?? []).map(toStaticPage);
  },
};
