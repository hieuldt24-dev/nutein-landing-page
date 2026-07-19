import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * OAuth callback (redirectTo của supabase.auth.signInWithOAuth trỏ về đây).
 * Đây là route điều hướng trình duyệt (redirect), không phải JSON API —
 * cố tình KHÔNG dùng withErrorHandler/successResponse như app/api/**,
 * vì response bắt buộc phải là redirect để trình duyệt thoát khỏi luồng OAuth.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
