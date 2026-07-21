import type { AuthRole } from "../types";

export type ProvisionedStaffAccount = {
  email: string;
  role: Exclude<AuthRole, "user">;
  fullName: string;
};

/**
 * Tài khoản Staff/Admin cấp sẵn (mock).
 * Chỉ `auth.service` được import — UI không import file này.
 * Khi có API: bỏ allowlist, role đến từ server.
 */
export const PROVISIONED_STAFF_ACCOUNTS: readonly ProvisionedStaffAccount[] = [
  {
    email: "staff@nutein.com",
    role: "staff",
    fullName: "Nutein Staff",
  },
  {
    email: "admin@nutein.com",
    role: "admin",
    fullName: "Nutein Admin",
  },
] as const;
