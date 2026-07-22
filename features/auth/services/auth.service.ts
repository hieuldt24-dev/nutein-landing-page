import { PROVISIONED_STAFF_ACCOUNTS } from "../data/staff-accounts.mock";
import type { AuthRole, AuthUser } from "../types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Auth domain — phase 0: resolve role từ mock allowlist.
 * Khi gắn API: đổi thân `resolveRole` / login (giữ chữ ký cho UI).
 */
export const authService = {
  /** Role theo email cấp sẵn; không khớp → `user`. */
  resolveRole(email: string): AuthRole {
    const key = normalizeEmail(email);
    const hit = PROVISIONED_STAFF_ACCOUNTS.find((a) => a.email === key);
    return hit?.role ?? "user";
  },

  /** Profile seed kèm role (fullName từ allowlist nếu có). */
  resolveProvisionedProfile(email: string): {
    role: AuthRole;
    fullName?: string;
  } {
    const key = normalizeEmail(email);
    const hit = PROVISIONED_STAFF_ACCOUNTS.find((a) => a.email === key);
    if (!hit) return { role: "user" };
    return { role: hit.role, fullName: hit.fullName };
  },

  canAccessAdmin(user: AuthUser | null | undefined): boolean {
    if (!user?.email) return false;
    return user.role === "staff" || user.role === "admin";
  },

  isStaffOrAdmin(role: AuthRole | null | undefined): boolean {
    return role === "staff" || role === "admin";
  },
};
