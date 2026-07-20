/**
 * Session user phía client — map từ Supabase Auth `User` (xem
 * features/auth/services/auth.repository.ts#toAuthUser). Shape giữ ổn định
 * để checkout prefill + Navbar dùng chung, không phụ thuộc trực tiếp
 * @supabase/supabase-js ở tầng UI.
 */
export interface AuthUser {
  email: string;
  fullName?: string;
  phone?: string;
}
