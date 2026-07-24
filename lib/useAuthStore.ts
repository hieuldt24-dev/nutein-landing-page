"use client";

import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { User } from "@supabase/supabase-js";
import {
  AUTH_USER_SWR_KEY,
  AUTH_READY_SWR_KEY,
  AUTH_ROLE_SWR_KEY,
} from "@/features/auth/constants";
import { authRepository, toAuthUser } from "@/features/auth/services/auth.repository";
import { authService } from "@/features/auth/services/auth.service";
import type { AuthRole, AuthUser } from "@/features/auth/types";

/**
 * Session auth toàn cục — SWR-as-store (docs/state-management.md mục 3).
 * User từ AuthProvider (Supabase); role từ POST /api/auth/session (public.users).
 */
export function useAuthStore() {
  const { mutate } = useSWRConfig();

  const { data: rawUser } = useSWR<User | null>(AUTH_USER_SWR_KEY, () => null, {
    fallbackData: null,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: serverRole } = useSWR<AuthRole | null>(AUTH_ROLE_SWR_KEY, () => null, {
    fallbackData: null,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: isReady } = useSWR<boolean>(AUTH_READY_SWR_KEY, () => false, {
    fallbackData: false,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const user: AuthUser | null = useMemo(
    () => (rawUser ? toAuthUser(rawUser, serverRole) : null),
    [rawUser, serverRole],
  );

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean = true) => {
      const signedInUser = await authRepository.signInWithPassword(email, password);
      await mutate(AUTH_USER_SWR_KEY, signedInUser, { revalidate: false });
      const { role } = await authRepository.mintApiSession(rememberMe);
      return toAuthUser(signedInUser, role);
    },
    [mutate]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      options?: { emailRedirectTo?: string },
    ) => {
      const { user: signedUpUser, needsEmailConfirmation } =
        await authRepository.signUpWithPassword(
          email,
          password,
          fullName,
          options,
        );
      if (!needsEmailConfirmation) {
        await mutate(AUTH_USER_SWR_KEY, signedUpUser, { revalidate: false });
        const { role } = await authRepository.mintApiSession();
        return { user: toAuthUser(signedUpUser, role), needsEmailConfirmation };
      }
      return { user: toAuthUser(signedUpUser, "user"), needsEmailConfirmation };
    },
    [mutate]
  );

  /** Trình duyệt redirect sang Google ngay khi gọi thành công — không cần mutate SWR ở đây. */
  const signInWithGoogle = useCallback(async (redirectTo: string) => {
    await authRepository.signInWithGoogle(redirectTo);
  }, []);

  const signOut = useCallback(async () => {
    await authRepository.signOut();
    await mutate(AUTH_USER_SWR_KEY, null, { revalidate: false });
    await mutate(AUTH_ROLE_SWR_KEY, null, { revalidate: false });
  }, [mutate]);

  const role = user?.role ?? null;
  const isStaffOrAdmin = authService.isStaffOrAdmin(role);

  return {
    user,
    role,
    isLoggedIn: Boolean(user?.email),
    isReady: Boolean(isReady),
    isStaffOrAdmin,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };
}
