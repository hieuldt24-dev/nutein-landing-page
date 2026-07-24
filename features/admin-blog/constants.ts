export const ADMIN_BLOG_SWR_KEY = "admin-blog-list";

export function adminBlogDetailSwrKey(id: string): string {
  return `admin-blog:${id}`;
}
