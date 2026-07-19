"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AUTH_USER_SWR_KEY } from "@/features/auth/constants";
import { authRepository } from "@/features/auth/services/auth.repository";
import type { AuthUser } from "@/features/auth/types";

/**
 * Session auth toàn cục — SWR-as-store + localStorage (docs/state-management.md).
 * Checkout / Navbar đọc `user`; AuthModal gọi `signIn` / `signOut`.
 */
export function useAuthStore() {
  const { mutate } = useSWRConfig();

  const { data: user } = useSWR(AUTH_USER_SWR_KEY, () => authRepository.getUser(), {
    fallbackData: null,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const signIn = useCallback(
    async (next: AuthUser) => {
      const saved = authRepository.setUser(next);
      await mutate(AUTH_USER_SWR_KEY, saved, { revalidate: false });
      return saved;
    },
    [mutate]
  );

  const signOut = useCallback(async () => {
    authRepository.clear();
    await mutate(AUTH_USER_SWR_KEY, null, { revalidate: false });
  }, [mutate]);

  return {
    user: user ?? null,
    isLoggedIn: Boolean(user?.email),
    signIn,
    signOut,
  };
}
