import { apiRequest } from "@/lib/api-client";
import type { AuthRole } from "@/features/auth/types";
import type {
  AdminManagedUser,
  AdminManagedUserListResult,
  AdminUsersListQuery,
} from "../types";

const BASE_PATH = "/api/admin/users";

function buildQueryString(query?: AdminUsersListQuery): string {
  const params = new URLSearchParams();
  if (query?.q) params.set("q", query.q);
  if (query?.role && query.role !== "all") params.set("role", query.role);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.offset != null) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin users domain — client fetch wrapper gọi `app/api/admin/users/**`.
 * Business logic/DB thật nằm ở `admin-users.repository.ts` (server-only).
 */
export const adminUsersService = {
  async list(query?: AdminUsersListQuery): Promise<AdminManagedUserListResult> {
    return apiRequest<AdminManagedUserListResult>(`${BASE_PATH}${buildQueryString(query)}`);
  },

  async setRole(id: string, role: AuthRole): Promise<AdminManagedUser> {
    return apiRequest<AdminManagedUser>(`${BASE_PATH}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  async setLocked(id: string, locked: boolean): Promise<AdminManagedUser> {
    return apiRequest<AdminManagedUser>(`${BASE_PATH}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ locked }),
    });
  },
};
