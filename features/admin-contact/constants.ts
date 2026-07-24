export const ADMIN_CONTACT_SWR_KEY = "admin-contact-list";

export function adminContactDetailSwrKey(id: string): string {
  return `admin-contact:${id}`;
}
