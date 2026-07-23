import type { AuthRole } from "@/features/auth/types";
import { sleep } from "@/lib/utils";
import { ADMIN_USERS_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_USERS } from "../data/users.mock";
import type { AdminManagedUser } from "../types";

let store: AdminManagedUser[] = structuredClone(MOCK_ADMIN_USERS);

export const adminUsersService = {
  async list(query?: {
    q?: string;
    role?: AuthRole | "all";
  }): Promise<AdminManagedUser[]> {
    await sleep(ADMIN_USERS_MOCK_LATENCY_MS);
    let rows = [...store];
    const q = query?.q?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (u) =>
          u.email.includes(q) ||
          u.fullName.toLowerCase().includes(q)
      );
    }
    if (query?.role && query.role !== "all") {
      rows = rows.filter((u) => u.role === query.role);
    }
    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async setRole(id: string, role: AuthRole): Promise<AdminManagedUser> {
    await sleep(ADMIN_USERS_MOCK_LATENCY_MS);
    const idx = store.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error("Không tìm thấy user.");
    const updated = { ...store[idx], role };
    store = [...store.slice(0, idx), updated, ...store.slice(idx + 1)];
    return structuredClone(updated);
  },

  async setLocked(id: string, locked: boolean): Promise<AdminManagedUser> {
    await sleep(ADMIN_USERS_MOCK_LATENCY_MS);
    const idx = store.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error("Không tìm thấy user.");
    const updated = { ...store[idx], locked };
    store = [...store.slice(0, idx), updated, ...store.slice(idx + 1)];
    return structuredClone(updated);
  },
};
