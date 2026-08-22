import type { AuthRole } from "@/features/auth/types";

export interface AdminManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  locked: boolean;
  createdAt: string;
}

export interface AdminUsersListQuery {
  q?: string;
  role?: AuthRole | "all";
  limit?: number;
  offset?: number;
}

export interface AdminManagedUserListResult {
  items: AdminManagedUser[];
  total: number;
}
