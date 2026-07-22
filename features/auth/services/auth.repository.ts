import type { AuthError, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { authService } from "./auth.service";
import type { AuthRole, AuthUser } from "../types";

const ROLES: readonly AuthRole[] = ["user", "staff", "admin"];

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

function normalizeRole(raw: unknown): AuthRole | null {
  if (typeof raw === "string" && (ROLES as readonly string[]).includes(raw)) {
    return raw as AuthRole;
  }
  return null;
}

let mintSessionInFlight: Promise<boolean> | null = null;

/** Map Supabase `User` (auth.users) sang shape `AuthUser` app đang dùng. */
export function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  const fullName =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === "string" && meta.name.trim()
        ? meta.name.trim()
        : undefined;

  const email = user.email ?? "";
  // Ưu tiên claims Supabase; phase 0 fallback allowlist email (auth.service).
  const roleFromMeta =
    normalizeRole(appMeta.role) ?? normalizeRole(meta.role) ?? null;
  const role = roleFromMeta ?? authService.resolveRole(email);

  return {
    email,
    fullName,
    phone: user.phone || undefined,
    role,
  };
}

/**
 * Nguồn session auth phía client — Supabase Auth thật (auth.users), KHÔNG
 * còn mock localStorage. Session hiện tại được AuthProvider đồng bộ vào SWR
 * key "auth-user" qua onAuthStateChange; các hàm dưới đây chỉ gọi Supabase
 * SDK và trả user mới nhất, việc ghi cache SWR do lib/useAuthStore.ts lo.
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
    fullName: string
  ): Promise<{ user: User; needsEmailConfirmation: boolean }> {
    const { data, error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      throw new Error(mapAuthError(error));
    }
    if (!data.user) {
      throw new Error("Đăng ký thất bại");
    }
    return { user: data.user, needsEmailConfirmation: !data.session };
  },

  async signOut(): Promise<void> {
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) {
      throw new Error(mapAuthError(error));
    }
    // Best-effort — cookie JWT hết hạn tự nhiên theo maxAge dù call này lỗi mạng.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  },

  /**
   * Cấp cặp JWT access/refresh riêng của app (httpOnly cookie) ngay sau khi
   * Supabase đã xác thực xong — app/api/** dùng cặp token này qua
   * src/middlewares/authenticate.middlware.ts, không cần verify lại Supabase
   * mỗi request. Trả `true` nếu set cookie thành công. Không throw nếu lỗi:
   * mất JWT riêng không nên chặn luồng đăng nhập chính (vẫn còn session
   * Supabase hợp lệ); fetcher/api-client sẽ remint lại khi gặp 401.
   *
   * Single-flight: AuthProvider + nhiều apiRequest 401 cùng lúc chỉ mint 1 lần.
   *
   * `rememberMe` (mặc định true) quyết định refresh-token cookie sống qua
   * việc đóng trình duyệt (7 ngày) hay chỉ là session cookie — xem
   * app/api/auth/session/route.ts.
   */
  async mintApiSession(rememberMe: boolean = true): Promise<boolean> {
    if (mintSessionInFlight) return mintSessionInFlight;

    mintSessionInFlight = (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rememberMe }),
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        mintSessionInFlight = null;
      }
    })();

    return mintSessionInFlight;
  },

  /**
   * Cart/checkout: chờ mint AuthProvider đang bay (nếu có).
   * Không gọi /session mới — tránh spam; thiếu cookie vẫn do apiRequest remint.
   */
  async waitForInFlightApiSession(): Promise<void> {
    if (mintSessionInFlight) await mintSessionInFlight;
  },
};
