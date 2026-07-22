import type { AuthRole, AuthUser } from "../types";

/**
 * Auth domain helpers — role thật từ `public.users` (qua `/api/auth/session`).
 * Không còn allowlist email mock.
 */
export const authService = {
  /** Map role DB/JWT (`USER`|`STAFF`|`ADMIN`) → AuthRole client. */
  fromDbRole(raw: string | null | undefined): AuthRole {
    switch ((raw ?? "USER").toUpperCase()) {
      case "ADMIN":
        return "admin";
      case "STAFF":
        return "staff";
      default:
        return "user";
    }
  },

  canAccessAdmin(user: AuthUser | null | undefined): boolean {
    if (!user?.email) return false;
    return user.role === "staff" || user.role === "admin";
  },

  isStaffOrAdmin(role: AuthRole | null | undefined): boolean {
    return role === "staff" || role === "admin";
  },
};
