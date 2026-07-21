import { sleep } from "@/lib/utils";
import { ADMIN_CONTACT_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_CONTACTS } from "../data/messages.mock";
import type { AdminContactFilter, AdminContactMessage } from "../types";

let store: AdminContactMessage[] = structuredClone(MOCK_ADMIN_CONTACTS);

export const adminContactService = {
  async list(filter: AdminContactFilter = "all"): Promise<AdminContactMessage[]> {
    await sleep(ADMIN_CONTACT_MOCK_LATENCY_MS);
    let rows = [...store];
    if (filter === "unread") rows = rows.filter((m) => !m.isRead);
    if (filter === "open") rows = rows.filter((m) => !m.isHandled);
    if (filter === "handled") rows = rows.filter((m) => m.isHandled);
    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getById(id: string): Promise<AdminContactMessage | null> {
    await sleep(ADMIN_CONTACT_MOCK_LATENCY_MS);
    return store.find((m) => m.id === id) ?? null;
  },

  async markRead(id: string): Promise<AdminContactMessage> {
    return this.patch(id, { isRead: true });
  },

  async markHandled(id: string, isHandled: boolean): Promise<AdminContactMessage> {
    return this.patch(id, { isHandled, isRead: true });
  },

  async setNote(id: string, internalNote: string): Promise<AdminContactMessage> {
    return this.patch(id, { internalNote: internalNote.trim() || undefined });
  },

  async patch(
    id: string,
    patch: Partial<AdminContactMessage>
  ): Promise<AdminContactMessage> {
    await sleep(ADMIN_CONTACT_MOCK_LATENCY_MS);
    const idx = store.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("Không tìm thấy tin nhắn.");
    const updated = { ...store[idx], ...patch };
    store = [...store.slice(0, idx), updated, ...store.slice(idx + 1)];
    return structuredClone(updated);
  },
};
