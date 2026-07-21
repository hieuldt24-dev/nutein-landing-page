"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { ACCOUNT_PROFILE_API_PATH } from "@/features/account/constants";
import type { UpdateProfileInput } from "@/features/account/schemas/profile.schema";
import type { AccountProfile } from "@/features/account/types";
import { apiRequest } from "@/lib/api-client";
import { fetcher } from "@/lib/swr-fetcher";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Hồ sơ user (fullName/phone) — SWR key URL thật `/api/account/profile`.
 * Sổ địa chỉ tách riêng: lib/useAddresses.ts.
 */
export function useAccountProfile() {
  const { user, isLoggedIn } = useAuthStore();
  const email = user?.email ?? null;
  const key = isLoggedIn ? ACCOUNT_PROFILE_API_PATH : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<AccountProfile>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!isLoggedIn) throw new Error("Chưa đăng nhập");
      const profile = await apiRequest<AccountProfile>(ACCOUNT_PROFILE_API_PATH, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await mutate(profile, { revalidate: false });
      return profile;
    },
    [isLoggedIn, mutate],
  );

  const profile: AccountProfile | null = data
    ? data
    : email
      ? {
          email: email.toLowerCase(),
          fullName: user?.fullName,
          phone: user?.phone,
        }
      : null;

  return {
    email,
    isLoggedIn,
    data: profile ? { profile } : null,
    profile,
    error,
    isLoading: Boolean(isLoggedIn) && isLoading,
    isValidating,
    updateProfile,
  };
}
