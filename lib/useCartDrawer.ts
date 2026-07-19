"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CART_DRAWER_SWR_KEY } from "@/features/cart/constants";

/**
 * Global UI state mở/đóng CartDrawer — chia sẻ giữa Navbar (trigger) và
 * CartDrawer (consumer), theo đúng pattern "SWR-as-store" như `auth-modal`
 * trong AuthModal.tsx (xem docs/state-management.md mục 3).
 */
export function useCartDrawer() {
  const { mutate } = useSWRConfig();
  const { data: isOpen } = useSWR(CART_DRAWER_SWR_KEY, () => false, { fallbackData: false });

  const open = useCallback(
    () => mutate(CART_DRAWER_SWR_KEY, true, { revalidate: false }),
    [mutate]
  );
  const close = useCallback(
    () => mutate(CART_DRAWER_SWR_KEY, false, { revalidate: false }),
    [mutate]
  );

  return { isOpen: isOpen ?? false, open, close };
}
