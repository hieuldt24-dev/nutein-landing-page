import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

/**
 * Kiểm tra email đã có hồ sơ trong `public.users` (đồng bộ từ auth.users).
 * Chỉ gọi từ API server — không lộ chi tiết user ngoài boolean.
 */
export async function emailExistsInUsers(email: string): Promise<boolean> {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }

  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("email", normalized.replace(/%/g, ""))
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}
