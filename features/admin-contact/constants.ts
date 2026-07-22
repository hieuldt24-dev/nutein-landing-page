export const ADMIN_CONTACT_SWR_KEY = "admin-contact-list";
export const ADMIN_CONTACT_MOCK_LATENCY_MS = 260;

export function adminContactDetailSwrKey(id: string): string {
  return `admin-contact:${id}`;
}
