"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { authRepository } from "@/features/auth/services/auth.repository";

/**
 * Đồng bộ Supabase auth session vào SWR-as-store key "auth-user" (xem
 * state-management.md mục 3 — cùng pattern với "auth-modal"). Mount 1 lần
 * ở RootLayout, các component khác chỉ cần `useSWR("auth-user", () => null, {
 * fallbackData: null })` để đọc user hiện tại, không tự gọi Supabase SDK.
 * Lưu ý: fetcher phải là hàm no-op (không phải literal `null`) — SWR coi
 * fetcher falsy là "chưa truyền", rồi fallback sang global fetcher thật và
 * gọi fetch("auth-user"), gây 404 lặp lại (bug đã gặp thực tế, xem git log).
 *
 * Cũng tự cấp lại cặp JWT cookie riêng (app/api/auth/session) mỗi khi có
 * session Supabase hợp lệ — bắt các luồng KHÔNG đi qua useAuthStore.signIn
 * trực tiếp: reload trang khi đã đăng nhập từ trước, và OAuth callback
 * (app/auth/callback/route.ts).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      mutate("auth-user", data.session?.user ?? null, { revalidate: false });
      if (data.session?.user) void authRepository.mintApiSession();
    });

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      mutate("auth-user", session?.user ?? null, { revalidate: false });
      if (session?.user) void authRepository.mintApiSession();
    });

    return () => subscription.unsubscribe();
  }, [mutate]);

  return <>{children}</>;
}
