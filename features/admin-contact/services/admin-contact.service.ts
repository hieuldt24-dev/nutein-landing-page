import { apiRequest } from "@/lib/api-client";
import type { AdminContactFilter, AdminContactMessage } from "../types";

const BASE_PATH = "/api/staff/contact";

type ContactPatch = { isRead?: boolean; isHandled?: boolean; internalNote?: string };

/**
 * Admin contact domain (S6) — client fetch wrapper gọi `app/api/staff/contact/**`.
 * Business logic/DB thật nằm ở `admin-contact.repository.ts` (server-only).
 */
export const adminContactService = {
  async list(filter: AdminContactFilter = "all"): Promise<AdminContactMessage[]> {
    return apiRequest<AdminContactMessage[]>(`${BASE_PATH}?filter=${filter}`);
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
