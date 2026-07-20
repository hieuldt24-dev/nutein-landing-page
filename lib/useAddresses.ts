"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { fetcher, type FetchError } from "@/lib/swr-fetcher";
import type { ApiResponse } from "@/src/api/response";
import { ACCOUNT_ADDRESSES_API_PATH } from "@/features/account/constants";
import type { ShippingAddressFields } from "@/features/account/schemas/address.schema";
import type { ShippingAddress } from "@/features/account/types";
import { useAuthStore } from "@/lib/useAuthStore";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json: ApiResponse<T> = await res.json().catch(() => ({
    success: false,
    data: null,
    error: { message: "Không đọc được phản hồi máy chủ", code: "PARSE_ERROR" },
  }));

  if (!res.ok || !json.success) {
    const error = new Error(
      json.error?.message || "Đã xảy ra lỗi",
    ) as FetchError;
    error.status = res.status;
    error.code = json.error?.code || "REQUEST_ERROR";
    throw error;
  }
  return json.data as T;
}

/**
 * Sổ địa chỉ — dữ liệu thật từ server (bảng `user_addresses` qua
 * app/api/account/addresses/**), SWR với key là URL thật (state-management.md
 * mục 7), không phải mock localStorage nữa. Guard theo `isLoggedIn` — API
 * xác thực bằng cookie JWT (authenticate.middlware.ts), không cần truyền email.
 */
export function useAddresses() {
  const { isLoggedIn } = useAuthStore();
  const key = isLoggedIn ? ACCOUNT_ADDRESSES_API_PATH : null;

  const { data, error, isLoading, mutate } = useSWR<ShippingAddress[]>(
    key,
    fetcher,
  );
  const addresses = useMemo(() => data ?? [], [data]);
  const defaultAddress =
    addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

  const createAddress = useCallback(
    async (input: ShippingAddressFields) => {
      const created = await requestJson<ShippingAddress>(
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
      const updated = await requestJson<ShippingAddress>(
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
      await requestJson<null>(`${ACCOUNT_ADDRESSES_API_PATH}/${id}`, {
        method: "DELETE",
      });
      await mutate();
    },
    [mutate],
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      const updated = await requestJson<ShippingAddress>(
        `${ACCOUNT_ADDRESSES_API_PATH}/${id}/default`,
        { method: "POST" },
      );
      await mutate();
      return updated;
    },
    [mutate],
  );

  /**
   * Dùng khi checkout tick "lưu thông tin" — khớp theo street+wardCode+provinceCode
   * với địa chỉ đã có thì cập nhật, chưa có thì tạo mới, luôn đặt làm mặc định
   * (giữ đúng hành vi accountService.syncFromCheckout bản mock cũ).
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
