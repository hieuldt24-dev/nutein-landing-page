"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { accountDataSwrKey } from "@/features/account/constants";
import type { UpdateProfileInput } from "@/features/account/schemas/profile.schema";
import { accountService } from "@/features/account/services/account.service";
import type { AccountData } from "@/features/account/types";
import type { AuthUser } from "@/features/auth/types";
import { useAuthStore } from "@/lib/useAuthStore";

/** Đọc hồ sơ + soft-merge tên/SĐT từ session nếu hồ sơ trống (không ghi SĐT giả). */
async function loadAccountData(
  email: string,
  session: AuthUser | null,
): Promise<AccountData> {
  const data = await accountService.getData(email);
  if (!session || session.email.toLowerCase() !== email.toLowerCase()) {
    return data;
  }
  return {
    profile: {
      email: email.toLowerCase(),
      fullName: data.profile.fullName || session.fullName,
      phone: data.profile.phone || session.phone,
    },
  };
}

/**
 * Hồ sơ user (fullName/phone) — SWR-as-store theo email, mutate qua account.service.
 * Sổ địa chỉ nay tách riêng, xem lib/useAddresses.ts (dữ liệu thật, không mock).
 */
export function useAccountProfile() {
  const { user, isLoggedIn } = useAuthStore();
  const email = user?.email ?? null;
  const swrKey = email ? accountDataSwrKey(email) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => loadAccountData(email!, user),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!email) throw new Error("Chưa đăng nhập");
      const profile = await accountService.updateProfile(email, input);
      await mutate({ profile }, { revalidate: false });
      return profile;
    },
    [email, mutate],
  );

  return {
    email,
    isLoggedIn,
    data: data ?? null,
    profile: data?.profile ?? null,
    error,
    isLoading: Boolean(email) && isLoading,
    isValidating,
    updateProfile,
  };
}
