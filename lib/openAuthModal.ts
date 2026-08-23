import type { ScopedMutator } from "swr";
import {
  AUTH_MODAL_OPTIONS_DEFAULT,
  AUTH_MODAL_OPTIONS_SWR_KEY,
  AUTH_MODAL_SWR_KEY,
  type AuthModalOptions,
} from "@/features/auth/constants";
import { sanitizeAuthReturnTo } from "@/features/auth/sanitize-return-to";

export type OpenAuthModalInput = {
  returnTo?: string | null;
  email?: string | null;
};

export { sanitizeAuthReturnTo } from "@/features/auth/sanitize-return-to";

/**
 * Mở AuthModal kèm options (SWR-as-store) — dùng từ Navbar, Checkout, …
 */
export function openAuthModal(
  mutate: ScopedMutator,
  input: OpenAuthModalInput = {},
): void {
  const options: AuthModalOptions = {
    returnTo: sanitizeAuthReturnTo(input.returnTo ?? null),
    email: input.email?.trim() || null,
  };
  void mutate(AUTH_MODAL_OPTIONS_SWR_KEY, options, { revalidate: false });
  void mutate(AUTH_MODAL_SWR_KEY, true, { revalidate: false });
}

export function closeAuthModal(mutate: ScopedMutator): void {
  void mutate(AUTH_MODAL_SWR_KEY, false, { revalidate: false });
  void mutate(AUTH_MODAL_OPTIONS_SWR_KEY, AUTH_MODAL_OPTIONS_DEFAULT, {
    revalidate: false,
  });
}
