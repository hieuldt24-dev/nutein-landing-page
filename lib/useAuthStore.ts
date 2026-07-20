"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { User } from "@supabase/supabase-js";
import { AUTH_USER_SWR_KEY, AUTH_READY_SWR_KEY } from "@/features/auth/constants";
import { authRepository, toAuthUser } from "@/features/auth/services/auth.repository";
import type { AuthUser } from "@/features/auth/types";

/**
 * Session auth toàn cục — SWR-as-store (docs/state-management.md mục 3).
 * Nguồn dữ liệu thật do AuthProvider ghi vào key "auth-user" qua
 * supabase.auth.onAuthStateChange; hook này chỉ ĐỌC lại (fetcher no-op,
 * không tự gọi Supabase) rồi map sang AuthUser cho Navbar/CheckoutForm/AuthModal.
 */
export function useAuthStore() {
  const { mutate } = useSWRConfig();

  // revalidateOnMount/OnFocus/OnReconnect: false — key này không phải server
  // data, chỉ là cache dùng chung (AuthProvider/signIn/signUp/signOut tự
  // mutate). Nếu để SWR tự gọi lại fetcher no-op (VD khi mount, hoặc — bug
  // thật đã gặp — mỗi lần tab được focus lại), promise `null` đó ghi đè lên
  // session thật vừa set, gây "tự đăng xuất" khi chuyển tab đi rồi quay lại.
  const { data: rawUser } = useSWR<User | null>(AUTH_USER_SWR_KEY, () => null, {
    fallbackData: null,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // true khi AuthProvider đã xác định xong session thật (xem constants.ts) —
  // dùng cho UI guard cần phân biệt "chưa biết" với "chắc chắn chưa đăng
  // nhập". Cùng lý do trên: fetcher no-op không được tự chạy lại khi focus,
  // nếu không sẽ ghi đè `isReady` về false mãi mãi sau khi chuyển tab.
  const { data: isReady } = useSWR<boolean>(AUTH_READY_SWR_KEY, () => false, {
    fallbackData: false,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const user: AuthUser | null = rawUser ? toAuthUser(rawUser) : null;

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean = true) => {
      const signedInUser = await authRepository.signInWithPassword(email, password);
      await mutate(AUTH_USER_SWR_KEY, signedInUser, { revalidate: false });
      await authRepository.mintApiSession(rememberMe);
      return toAuthUser(signedInUser);
    },
    [mutate]
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { user: signedUpUser, needsEmailConfirmation } =
        await authRepository.signUpWithPassword(email, password, fullName);
      if (!needsEmailConfirmation) {
        await mutate(AUTH_USER_SWR_KEY, signedUpUser, { revalidate: false });
        await authRepository.mintApiSession();
      }
      return { user: toAuthUser(signedUpUser), needsEmailConfirmation };
    },
    [mutate]
  );

  const signOut = useCallback(async () => {
    await authRepository.signOut();
    await mutate(AUTH_USER_SWR_KEY, null, { revalidate: false });
  }, [mutate]);

  return {
    user,
    isLoggedIn: Boolean(user?.email),
    isReady: Boolean(isReady),
    signIn,
    signUp,
    signOut,
  };
}
