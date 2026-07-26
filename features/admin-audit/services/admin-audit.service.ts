import { apiRequest } from "@/lib/api-client";
import type { AdminAuditListQuery, AdminAuditListResult } from "../types";

const BASE_PATH = "/api/admin/audit";

function buildQueryString(query?: AdminAuditListQuery): string {
  const params = new URLSearchParams();
  if (query?.action && query.action !== "all") params.set("action", query.action);
  if (query?.actor) params.set("actor", query.actor);
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.offset != null) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin audit domain — client fetch wrapper gọi `app/api/admin/audit`.
 * Business logic/DB thật nằm ở `admin-audit.repository.ts` (server-only).
 */
export const adminAuditService = {
  async list(query?: AdminAuditListQuery): Promise<AdminAuditListResult> {
    return apiRequest<AdminAuditListResult>(`${BASE_PATH}${buildQueryString(query)}`);
  },
};
