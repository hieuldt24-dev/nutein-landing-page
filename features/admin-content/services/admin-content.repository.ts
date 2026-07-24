import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import type { AdminStaticPage, AdminStaticSlug } from "../types";

interface StaticPageRow {
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

const PAGE_SELECT = "slug, title, content, updated_at";

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function toAdminStaticPage(row: StaticPageRow): AdminStaticPage {
  return {
    slug: row.slug as AdminStaticSlug,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

async function list(): Promise<AdminStaticPage[]> {
  const client = requireAdminClient();
  const { data, error } = await client.from("static_pages").select(PAGE_SELECT);

  if (error) {
    throw new Error(`Không tải được danh sách trang: ${error.message}`);
  }
  return ((data as StaticPageRow[]) ?? []).map(toAdminStaticPage);
}

async function getPage(slug: AdminStaticSlug): Promise<AdminStaticPage | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("static_pages")
    .select(PAGE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Không tải được trang: ${error.message}`);
  }
  return data ? toAdminStaticPage(data as StaticPageRow) : null;
}

/**
 * Upsert theo `slug` (unique) — trang chưa tồn tại thì tạo mới, đã có thì
 * cập nhật. Slug cố định theo `AdminStaticSlug`, không đổi qua API này.
 */
async function updatePage(
  slug: AdminStaticSlug,
  patch: { title?: string; content?: string },
): Promise<AdminStaticPage> {
  const client = requireAdminClient();
  const current = await getPage(slug);

  const { data, error } = await client
    .from("static_pages")
    .upsert(
      {
        slug,
        title: patch.title ?? current?.title ?? slug,
        content: patch.content ?? current?.content ?? "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select(PAGE_SELECT)
    .single();

  if (error) {
    throw new Error(`Không lưu được trang: ${error.message}`);
  }
  return toAdminStaticPage(data as StaticPageRow);
}

export const adminContentRepository = {
  list,
  getPage,
  updatePage,
};
