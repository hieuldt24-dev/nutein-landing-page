"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { User } from "@supabase/supabase-js";
import { AUTH_USER_SWR_KEY } from "@/features/auth/constants";
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

  // revalidateOnMount: false — key này không phải server data, chỉ là
  // cache dùng chung (AuthProvider/signIn/signUp/signOut tự mutate). Nếu để
  // SWR tự gọi lại fetcher no-op khi mount, promise null đó có thể resolve
  // SAU một mutate() thật (vừa signIn xong) và ghi đè session về null.
  const { data: rawUser } = useSWR<User | null>(AUTH_USER_SWR_KEY, () => null, {
    fallbackData: null,
    revalidateOnMount: false,
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
    signIn,
    signUp,
    signOut,
  };
}
