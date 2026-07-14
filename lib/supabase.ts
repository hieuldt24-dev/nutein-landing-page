/**
 * Supabase client placeholder.
 *
 * Để sử dụng Supabase:
 * 1. Cài đặt: npm install @supabase/supabase-js
 * 2. Uncomment code bên dưới
 * 3. Thêm biến môi trường vào .env.local:
 *    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 *    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 */

// import "server-only";
// import { createClient } from "@supabase/supabase-js";
// import { env } from "@/lib/env";
//
// /**
//  * Supabase client dùng Service Role key - chỉ dùng ở server-side.
//  * Bypass RLS (Row Level Security). Dùng cẩn thận!
//  */
// export const supabaseAdmin = createClient(
//   env.NEXT_PUBLIC_SUPABASE_URL,
//   env.SUPABASE_SERVICE_ROLE_KEY,
//   { auth: { persistSession: false } }
// );

// Placeholder export để tránh lỗi import khi chưa cấu hình
export const supabaseAdmin = null;
