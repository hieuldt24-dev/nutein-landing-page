import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client cho Client Component — dùng createBrowserClient (không
 * phải createClient của @supabase/supabase-js) để session/PKCE code
 * verifier được lưu ở cookie, cho phép app/auth/callback/route.ts (server)
 * đọc lại được khi đổi OAuth code lấy session.
 */
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
