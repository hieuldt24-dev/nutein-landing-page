/**
 * Session user phía client — mock trước khi có auth API / Supabase session.
 * Shape giữ ổn định để checkout prefill + Navbar sau này.
 */
export interface AuthUser {
  email: string;
  fullName?: string;
  phone?: string;
}
