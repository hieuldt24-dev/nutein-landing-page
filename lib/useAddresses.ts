"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { apiRequest } from "@/lib/api-client";
import { fetcher } from "@/lib/swr-fetcher";
import { ACCOUNT_ADDRESSES_API_PATH } from "@/features/account/constants";
import type { ShippingAddressFields } from "@/features/account/schemas/address.schema";
import type { ShippingAddress } from "@/features/account/types";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Sổ địa chỉ — dữ liệu thật từ server (bảng `user_addresses` qua
 * app/api/account/addresses/**), SWR với key là URL thật (state-management.md
 * mục 7). Guard theo `isLoggedIn` — API xác thực bằng cookie JWT.
 */
export function useAddresses() {
  const { isLoggedIn } = useAuthStore();
  const key = isLoggedIn ? ACCOUNT_ADDRESSES_API_PATH : null;

  const { data, error, isLoading, mutate } = useSWR<ShippingAddress[]>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const addresses = useMemo(() => data ?? [], [data]);
  const defaultAddress =
    addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

  const createAddress = useCallback(
    async (input: ShippingAddressFields) => {
      const created = await apiRequest<ShippingAddress>(
        ACCOUNT_ADDRESSES_API_PATH,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      await mutate();
      return created;
    },
    [mutate],
  );

  const updateAddress = useCallback(
    async (id: string, input: ShippingAddressFields) => {
      const updated = await apiRequest<ShippingAddress>(
        `${ACCOUNT_ADDRESSES_API_PATH}/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      );
      await mutate();
      return updated;
    },
    [mutate],
  );

  const removeAddress = useCallback(
    async (id: string) => {
      await apiRequest<null>(`${ACCOUNT_ADDRESSES_API_PATH}/${id}`, {
        method: "DELETE",
      });
      await mutate();
    },
    [mutate],
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      const updated = await apiRequest<ShippingAddress>(
        `${ACCOUNT_ADDRESSES_API_PATH}/${id}/default`,
        { method: "POST" },
      );
      await mutate();
      return updated;
    },
    [mutate],
  );

  /**
   * Checkout tick "lưu thông tin" — khớp street+ward+province thì update,
   * chưa có thì tạo mới, luôn đặt mặc định.
   */
  const saveAsDefaultFromCheckout = useCallback(
    async (input: ShippingAddressFields) => {
      const match = addresses.find(
        (a) =>
          a.street === input.street.trim() &&
          a.wardCode === input.wardCode.trim() &&
          a.provinceCode === input.provinceCode.trim(),
      );
      if (match) {
        return updateAddress(match.id, { ...input, isDefault: true });
      }
      return createAddress({ ...input, isDefault: true });
    },
    [addresses, createAddress, updateAddress],
  );

  return {
    addresses,
    defaultAddress,
    isLoading: isLoggedIn && isLoading,
    error,
    createAddress,
    updateAddress,
    removeAddress,
    setDefaultAddress,
    saveAsDefaultFromCheckout,
  };
}
