import { AUTH_USER_STORAGE_KEY } from "../constants";
import type { AuthUser } from "../types";

function normalizeUser(raw: unknown): AuthUser | null {
  if (!raw || typeof raw !== "object") return null;
  const email = "email" in raw && typeof raw.email === "string" ? raw.email.trim() : "";
  if (!email) return null;

  const fullName =
    "fullName" in raw && typeof raw.fullName === "string" && raw.fullName.trim()
      ? raw.fullName.trim()
      : undefined;
  const phone =
    "phone" in raw && typeof raw.phone === "string" && raw.phone.trim()
      ? raw.phone.trim()
      : undefined;

  return { email: email.toLowerCase(), fullName, phone };
}

/**
 * Nguồn session auth phía client — hiện localStorage.
 * Khi có API: đổi sang đọc cookie/Supabase, giữ chữ ký get/set/clear.
 */
export const authRepository = {
  getUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (!raw) return null;
      return normalizeUser(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  },

  setUser(user: AuthUser): AuthUser {
    const next = normalizeUser(user);
    if (!next) {
      throw new Error("Email không hợp lệ");
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  },

  clear(): void {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  },
};
