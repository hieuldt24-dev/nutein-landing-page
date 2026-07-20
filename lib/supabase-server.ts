import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client cho Server Component / Route Handler, đọc session từ
 * cookie do proxy.ts đồng bộ. Phải tạo client mới mỗi request (theo
 * khuyến cáo @supabase/ssr), không cache thành singleton như lib/supabase.ts.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component không cho phép set cookie khi render — bỏ qua,
            // proxy.ts đã lo việc refresh session ở tầng request.
          }
        },
      },
    }
  );
}
