export const ADMIN_BLOG_SWR_KEY = "admin-blog-list";
export const ADMIN_BLOG_MOCK_LATENCY_MS = 280;

export function adminBlogDetailSwrKey(id: string): string {
  return `admin-blog:${id}`;
}
