import { sleep } from "@/lib/utils";
import { ADMIN_CONTENT_MOCK_LATENCY_MS } from "../constants";
import { MOCK_ADMIN_STATIC_PAGES } from "../data/pages.mock";
import type { AdminStaticPage, AdminStaticSlug } from "../types";

let store: AdminStaticPage[] = structuredClone(MOCK_ADMIN_STATIC_PAGES);

export const adminContentService = {
  async list(): Promise<AdminStaticPage[]> {
    await sleep(ADMIN_CONTENT_MOCK_LATENCY_MS);
    return structuredClone(store);
  },

  async getPage(slug: AdminStaticSlug): Promise<AdminStaticPage | null> {
    await sleep(ADMIN_CONTENT_MOCK_LATENCY_MS);
    return store.find((p) => p.slug === slug) ?? null;
  },

  async updatePage(
    slug: AdminStaticSlug,
    patch: { title?: string; content?: string }
  ): Promise<AdminStaticPage> {
    await sleep(ADMIN_CONTENT_MOCK_LATENCY_MS);
    const idx = store.findIndex((p) => p.slug === slug);
    if (idx < 0) throw new Error("Không tìm thấy trang.");
    const updated: AdminStaticPage = {
      ...store[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store = [...store.slice(0, idx), updated, ...store.slice(idx + 1)];
    return structuredClone(updated);
  },
};
