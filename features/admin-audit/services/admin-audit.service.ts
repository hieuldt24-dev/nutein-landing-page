import { sleep } from "@/lib/utils";
import { ADMIN_AUDIT_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_AUDIT } from "../data/audit.mock";
import type { AdminAuditAction, AdminAuditEntry } from "../types";

export const adminAuditService = {
  async list(query?: {
    action?: AdminAuditAction | "all";
    actor?: string;
    from?: string;
    to?: string;
  }): Promise<AdminAuditEntry[]> {
    await sleep(ADMIN_AUDIT_MOCK_LATENCY_MS);
    let rows = structuredClone(MOCK_ADMIN_AUDIT);
    if (query?.action && query.action !== "all") {
      rows = rows.filter((r) => r.action === query.action);
    }
    const actor = query?.actor?.trim().toLowerCase();
    if (actor) {
      rows = rows.filter((r) => r.actorEmail.toLowerCase().includes(actor));
    }
    if (query?.from) {
      const fromMs = new Date(query.from).getTime();
      rows = rows.filter((r) => new Date(r.createdAt).getTime() >= fromMs);
    }
    if (query?.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => new Date(r.createdAt).getTime() <= to.getTime());
    }
    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
};
