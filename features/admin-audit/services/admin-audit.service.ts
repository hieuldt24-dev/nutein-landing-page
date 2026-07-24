import { apiRequest } from "@/lib/api-client";
import type { AdminAuditAction, AdminAuditEntry } from "../types";

const BASE_PATH = "/api/admin/audit";

function buildQueryString(query?: {
  action?: AdminAuditAction | "all";
  actor?: string;
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();
  if (query?.action && query.action !== "all") params.set("action", query.action);
  if (query?.actor) params.set("actor", query.actor);
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin audit domain — client fetch wrapper gọi `app/api/admin/audit`.
 * Business logic/DB thật nằm ở `admin-audit.repository.ts` (server-only).
 */
export const adminAuditService = {
  async list(query?: {
    action?: AdminAuditAction | "all";
    actor?: string;
    from?: string;
    to?: string;
  }): Promise<AdminAuditEntry[]> {
    return apiRequest<AdminAuditEntry[]>(`${BASE_PATH}${buildQueryString(query)}`);
  },
};
