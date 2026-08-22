import { apiRequest } from "@/lib/api-client";
import type {
  AdminContactListQuery,
  AdminContactListResult,
  AdminContactMessage,
} from "../types";

const BASE_PATH = "/api/staff/contact";

type ContactPatch = { isRead?: boolean; isHandled?: boolean; internalNote?: string };

function buildQueryString(query?: AdminContactListQuery): string {
  const params = new URLSearchParams();
  if (query?.filter) params.set("filter", query.filter);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.offset != null) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Admin contact domain (S6) — client fetch wrapper gọi `app/api/staff/contact/**`.
 * Business logic/DB thật nằm ở `admin-contact.repository.ts` (server-only).
 */
export const adminContactService = {
  async list(query: AdminContactListQuery = {}): Promise<AdminContactListResult> {
    return apiRequest<AdminContactListResult>(`${BASE_PATH}${buildQueryString(query)}`);
  },

  async getById(id: string): Promise<AdminContactMessage | null> {
    return apiRequest<AdminContactMessage>(`${BASE_PATH}/${id}`);
  },

  async markRead(id: string): Promise<AdminContactMessage> {
    return this.patch(id, { isRead: true });
  },

  async markHandled(id: string, isHandled: boolean): Promise<AdminContactMessage> {
    return this.patch(id, { isHandled, isRead: true });
  },

  async setNote(id: string, internalNote: string): Promise<AdminContactMessage> {
    return this.patch(id, { internalNote: internalNote.trim() });
  },

  async patch(id: string, patch: ContactPatch): Promise<AdminContactMessage> {
    return apiRequest<AdminContactMessage>(`${BASE_PATH}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};
