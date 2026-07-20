/**
 * Session user phía client — mỏng (email / tên / SĐT).
 * Sổ địa chỉ nằm `features/account` (account.repository), không nhồi vào session.
 * Khi có auth API / Supabase: chỉ đổi thân auth.repository get/set/clear.
 */
export interface AuthUser {
  email: string;
  fullName?: string;
  phone?: string;
}
