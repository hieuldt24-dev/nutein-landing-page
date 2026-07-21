import type { AdminStaticPage, AdminStaticSlug } from "../types";
import { MOCK_POLICY_PAGES } from "@/features/policies/data/pages.mock";
import { ABOUT_HERO, ABOUT_STORY } from "@/features/about/constants";

const aboutPage: AdminStaticPage = {
  slug: "about",
  title: "Về Nutein",
  content: `${ABOUT_HERO.titleLine1} ${ABOUT_HERO.titleLine2}\n\n${ABOUT_HERO.lead}\n\n## ${ABOUT_STORY.storyTitle}\n\n${ABOUT_STORY.storyBody}\n\n## ${ABOUT_STORY.philosophyTitle}\n\n${ABOUT_STORY.philosophyBody}`,
  updatedAt: "2026-06-01T00:00:00.000Z",
};

/** Admin CMS — 5 policy public + về Nutein (about vẫn route `/about`). */
export const MOCK_ADMIN_STATIC_PAGES: AdminStaticPage[] = [
  ...(MOCK_POLICY_PAGES as AdminStaticPage[]),
  aboutPage,
];

export const ADMIN_STATIC_SLUGS: AdminStaticSlug[] = MOCK_ADMIN_STATIC_PAGES.map(
  (p) => p.slug,
);
