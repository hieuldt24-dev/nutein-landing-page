import type { AuthError, User } from "@supabase/supabase-js";
import { mutate } from "swr";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AUTH_ROLE_SWR_KEY } from "../constants";
import { authService } from "./auth.service";
import type { AuthRole, AuthUser } from "../types";

/** Kết quả mint JWT app + role từ `public.users`. */
export type MintApiSessionResult = {
  ok: boolean;
  role: AuthRole | null;
};

/** Map lỗi Supabase Auth (tiếng Anh) sang thông báo tiếng Việt cho UI. */
function mapAuthError(error: AuthError): string {
  return error.message || "Đã có lỗi xảy ra, vui lòng thử lại.";
}

let mintSessionInFlight: Promise<MintApiSessionResult> | null = null;

/**
 * Map Supabase `User` + role server → `AuthUser`.
 * `serverRole` từ POST `/api/auth/session` (`public.users.role`).
 */
export function toAuthUser(
  user: User,
  serverRole: AuthRole | null | undefined = undefined,
): AuthUser {
  const meta = user.user_metadata ?? {};
  const fullName =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === "string" && meta.name.trim()
        ? meta.name.trim()
        : undefined;

  return {
    email: user.email ?? "",
    fullName,
    phone: user.phone || undefined,
    role: serverRole ?? "user",
  };
}

/**
 * Nguồn session auth phía client — Supabase Auth thật (auth.users).
 * Role admin/staff lấy từ server khi mint JWT, không dùng allowlist mock.
 */
export const authRepository = {
  /** Redirect toàn trang sang Google — session thật lấy về qua app/auth/callback/route.ts. */
  async signInWithGoogle(redirectTo: string): Promise<void> {
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      throw new Error(mapAuthError(error));
    }
  },

  async signOut(): Promise<void> {
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) {
      throw new Error(mapAuthError(error));
    }
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await mutate(AUTH_ROLE_SWR_KEY, null, { revalidate: false });
  },

  /**
   * Cấp JWT app + đồng bộ role từ `public.users` vào SWR `auth-role`.
   * Single-flight: AuthProvider + apiRequest 401 chỉ mint 1 lần.
   */
  async mintApiSession(rememberMe: boolean = true): Promise<MintApiSessionResult> {
    if (mintSessionInFlight) return mintSessionInFlight;

    mintSessionInFlight = (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rememberMe }),
        });
        if (!res.ok) {
          return { ok: false, role: null };
        }
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: { role?: string };
        } | null;
        if (!json?.success) {
          return { ok: false, role: null };
        }
        const role = authService.fromDbRole(json.data?.role);
        await mutate(AUTH_ROLE_SWR_KEY, role, { revalidate: false });
        return { ok: true, role };
      } catch {
        return { ok: false, role: null };
      } finally {
        mintSessionInFlight = null;
      }
    })();

    return mintSessionInFlight;
  },

  async waitForInFlightApiSession(): Promise<void> {
    if (mintSessionInFlight) await mintSessionInFlight;
  },
};
