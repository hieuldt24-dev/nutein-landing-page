import type { AuthRole } from "../types";

/** Thứ hạng quyền — dùng để phân biệt hạ quyền (downgrade) vs nâng quyền. */
const ROLE_RANK: Record<AuthRole, number> = { user: 0, staff: 1, admin: 2 };

function roleRank(role: AuthRole): number {
  return ROLE_RANK[role];
}

function isDowngrade(oldRole: AuthRole, newRole: AuthRole): boolean {
  return roleRank(newRole) < roleRank(oldRole);
}

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

  isStaffOrAdmin(role: AuthRole | null | undefined): boolean {
    return role === "staff" || role === "admin";
  },

  roleRank,
  isDowngrade,
};
