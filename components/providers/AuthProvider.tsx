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
 * CHỈ dùng `onAuthStateChange` — supabase-js tự bắn sự kiện "INITIAL_SESSION"
 * kèm session hiện tại ngay khi subscribe, nên không cần gọi thêm
 * `getSession()` riêng. Trước đây có cả 2: 2 nguồn ghi độc lập vào cùng key
 * SWR, không đảm bảo thứ tự resolve — ở React StrictMode (dev), effect chạy
 * 2 lần khiến callback của lần mount cũ (đã unsubscribe) vẫn có thể bắn 1
 * lần cuối (unsubscribe không huỷ được callback đã enqueue), ghi đè tạm
 * `null` rồi ghi đè lại đúng ngay sau — hiện tượng "tự logout rồi login lại"
 * trong vài giây. Cờ `cancelled` chặn callback từ effect instance đã cũ.
 *
 * Cũng tự cấp lại cặp JWT cookie riêng (app/api/auth/session) mỗi khi có
 * session Supabase hợp lệ — bắt các luồng KHÔNG đi qua useAuthStore.signIn
 * trực tiếp: reload trang khi đã đăng nhập từ trước, và OAuth callback
 * (app/auth/callback/route.ts).
 *
 * De-dupe theo user id (`lastMintedUserId`): Supabase có thể bắn nhiều event
 * liên tiếp cho CÙNG 1 session (VD INITIAL_SESSION rồi SIGNED_IN, hoặc
 * TOKEN_REFRESHED định kỳ) — mintApiSession() chỉ cần chạy 1 lần khi user id
 * thực sự đổi (đăng nhập mới/đổi tài khoản), không cần chạy lại mỗi lần
 * refresh token nội bộ của Supabase (app tự có cơ chế refresh JWT riêng lazy
 * theo 401, xem lib/swr-fetcher.ts) — tránh spam POST /api/auth/session.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let cancelled = false;
    let lastMintedUserId: string | null = null;

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      mutate("auth-user", session?.user ?? null, { revalidate: false });

      const userId = session?.user?.id ?? null;
      if (userId && userId !== lastMintedUserId) {
        lastMintedUserId = userId;
        void authRepository.mintApiSession();
      } else if (!userId) {
        lastMintedUserId = null;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [mutate]);

  return <>{children}</>;
}
