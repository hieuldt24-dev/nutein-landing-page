import "server-only";

import { MOCK_POLICY_PAGES } from "../data/pages.mock";
import { POLICY_SLUGS, isPolicySlug } from "../types";
import type { PolicySlug, StaticPage } from "../types";

/**
 * Public policy pages — hiện đọc mock.
 * Khi có API: `GET /api/static-pages/[slug]` (hoặc đọc DB), giữ chữ ký getBySlug / listSlugs.
 */
export const policyService = {
  listSlugs(): PolicySlug[] {
    return [...POLICY_SLUGS];
  },

  async getBySlug(slug: string): Promise<StaticPage | null> {
    if (!isPolicySlug(slug)) return null;
    return MOCK_POLICY_PAGES.find((p) => p.slug === slug) ?? null;
  },

  async list(): Promise<StaticPage[]> {
    return [...MOCK_POLICY_PAGES];
  },
};
