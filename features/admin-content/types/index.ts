export type AdminStaticSlug =
  | "privacy"
  | "terms"
  | "shipping"
  | "return"
  | "payment"
  | "about";

export interface AdminStaticPage {
  slug: AdminStaticSlug;
  title: string;
  content: string;
  updatedAt: string;
}
