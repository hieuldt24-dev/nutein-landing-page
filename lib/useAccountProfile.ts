"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { accountDataSwrKey } from "@/features/account/constants";
import type { UpdateProfileInput } from "@/features/account/schemas/profile.schema";
import type { UpsertAddressInput } from "@/features/account/schemas/address.schema";
import type { SyncFromCheckoutInput } from "@/features/account/schemas/sync-from-checkout.schema";
import { accountService } from "@/features/account/services/account.service";
import type { AccountData, ShippingAddress } from "@/features/account/types";
import { AUTH_USER_SWR_KEY } from "@/features/auth/constants";
import { authRepository } from "@/features/auth/services/auth.repository";
import { useAuthStore } from "@/lib/useAuthStore";

/** Đọc account + soft-merge tên/SĐT từ session nếu account trống (không ghi SĐT giả). */
async function loadAccountData(email: string): Promise<AccountData> {
  const data = await accountService.getData(email);
  const session = authRepository.getUser();
  if (!session || session.email.toLowerCase() !== email.toLowerCase()) {
    return data;
  }
  return {
    ...data,
    profile: {
      email: email.toLowerCase(),
      fullName: data.profile.fullName || session.fullName,
      phone: data.profile.phone || session.phone,
    },
  };
}

/**
 * Profile + địa chỉ — SWR-as-store theo email, mutate qua account.service.
 * Không đụng localStorage trong UI.
 */
export function useAccountProfile() {
  const { user, isLoggedIn, signIn } = useAuthStore();
  const { mutate: globalMutate } = useSWRConfig();
  const email = user?.email ?? null;
  const swrKey = email ? accountDataSwrKey(email) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => loadAccountData(email!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!email) throw new Error("Chưa đăng nhập");
      const profile = await accountService.updateProfile(email, input);
      const addresses = data?.addresses ?? (await accountService.listAddresses(email));
      const next: AccountData = { profile, addresses };
      await mutate(next, { revalidate: false });
      await signIn({
        email,
        fullName: profile.fullName,
        phone: profile.phone,
      });
      await globalMutate(AUTH_USER_SWR_KEY, authRepository.getUser(), {
        revalidate: false,
      });
      return profile;
    },
    [data?.addresses, email, globalMutate, mutate, signIn]
  );

  const upsertAddress = useCallback(
    async (input: UpsertAddressInput) => {
      if (!email) throw new Error("Chưa đăng nhập");
      await accountService.upsertAddress(email, input);
      const next = await accountService.getData(email);
      await mutate(next, { revalidate: false });
      return next;
    },
    [email, mutate]
  );

  const removeAddress = useCallback(
    async (addressId: string) => {
      if (!email) throw new Error("Chưa đăng nhập");
      await accountService.removeAddress(email, addressId);
      const next = await accountService.getData(email);
      await mutate(next, { revalidate: false });
    },
    [email, mutate]
  );

  const setDefaultAddress = useCallback(
    async (addressId: string) => {
      if (!email) throw new Error("Chưa đăng nhập");
      await accountService.setDefaultAddress(email, addressId);
      const next = await accountService.getData(email);
      await mutate(next, { revalidate: false });
    },
    [email, mutate]
  );

  const syncFromCheckout = useCallback(
    async (input: SyncFromCheckoutInput) => {
      if (!email) return;
      const next = await accountService.syncFromCheckout(email, input);
      await mutate(next, { revalidate: false });
      await signIn({
        email,
        fullName: next.profile.fullName,
        phone: next.profile.phone,
      });
    },
    [email, mutate, signIn]
  );

  const defaultAddress: ShippingAddress | null =
    data?.addresses.find((a) => a.isDefault) ?? data?.addresses[0] ?? null;

  return {
    email,
    isLoggedIn,
    data: data ?? null,
    profile: data?.profile ?? null,
    addresses: data?.addresses ?? [],
    defaultAddress,
    error,
    isLoading: Boolean(email) && isLoading,
    isValidating,
    updateProfile,
    upsertAddress,
    removeAddress,
    setDefaultAddress,
    syncFromCheckout,
  };
}
