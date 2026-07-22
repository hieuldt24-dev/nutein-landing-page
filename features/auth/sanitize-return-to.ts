/** Chỉ cho phép path nội bộ (`/…`), chặn open-redirect. */
export function sanitizeAuthReturnTo(
  path: string | null | undefined,
): string | null {
  if (!path || typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}
