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
  switch (error.message) {
    case "Invalid login credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "Email not confirmed":
      return "Vui lòng xác nhận email trước khi đăng nhập (kiểm tra hộp thư đến).";
    case "User already registered":
      return "Email này đã được đăng ký.";
    default:
      return error.message || "Đã có lỗi xảy ra, vui lòng thử lại.";
  }
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
  async signInWithPassword(email: string, password: string): Promise<User> {
    const { data, error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error ? mapAuthError(error) : "Đăng nhập thất bại");
    }
    return data.user;
  },

  async signUpWithPassword(
    email: string,
    password: string,
    fullName: string,
    options?: { emailRedirectTo?: string },
  ): Promise<{ user: User; needsEmailConfirmation: boolean }> {
    const { data, error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        ...(options?.emailRedirectTo
          ? { emailRedirectTo: options.emailRedirectTo }
          : {}),
      },
    });
    if (error) {
      throw new Error(mapAuthError(error));
    }
    if (!data.user) {
      throw new Error("Đăng ký thất bại");
    }
    return { user: data.user, needsEmailConfirmation: !data.session };
  },

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
