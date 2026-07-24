import type { AuthRole } from "@/features/auth/types";

export interface AdminManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  locked: boolean;
  createdAt: string;
}
