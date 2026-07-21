/**
 * Session user phía client — map từ Supabase Auth `User` (xem
 * features/auth/services/auth.repository.ts#toAuthUser). Shape giữ ổn định
 * để checkout prefill + Navbar dùng chung, không phụ thuộc trực tiếp
 * @supabase/supabase-js ở tầng UI.
 *
 * `role`: phase 0 resolve qua authService (allowlist email); sau này từ
 * app_metadata / JWT claims khi backend cấp.
 */
export type AuthRole = "user" | "staff" | "admin";

export interface AuthUser {
  email: string;
  fullName?: string;
  phone?: string;
  /** Mặc định `user` nếu thiếu (session cũ / đăng ký). */
  role: AuthRole;
}
