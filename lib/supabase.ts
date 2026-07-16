import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Client dùng Service Role key - chỉ dùng ở server-side.
 * Bypass RLS (Row Level Security). Dùng cẩn thận!
 * `null` khi chưa cấu hình biến môi trường Supabase.
 */
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : null;

let supabaseClient: SupabaseClient | null = null;

/**
 * Client dùng anon key - xác thực JWT của user (xem src/middlewares/authenticate.middlware.ts).
 * Trả về client với placeholder credentials nếu chưa cấu hình, để tránh crash khi khởi tạo.
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      supabaseUrl || "https://placeholder-url.supabase.co",
      supabaseAnonKey || "placeholder-anon-key"
    );
  }
  return supabaseClient;
};
