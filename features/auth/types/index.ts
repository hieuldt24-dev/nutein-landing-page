/**
 * Session user phía client — map từ Supabase Auth `User` + role server
 * (`public.users` qua `/api/auth/session`). Shape ổn định cho checkout /
 * Navbar / admin gate.
 */
export type AuthRole = "user" | "staff" | "admin";

export interface AuthUser {
  email: string;
  fullName?: string;
  phone?: string;
  /** Từ `public.users.role` — mặc định `user` nếu chưa mint session. */
  role: AuthRole;
}
