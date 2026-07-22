/**
 * Initials cho avatar gen khi chưa có ảnh upload.
 * Ưu tiên họ tên (ký tự đầu + cuối); fallback chữ cái đầu email.
 */
export function getUserInitials(
  fullName?: string | null,
  email?: string | null,
): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? "";
      const last = parts[parts.length - 1]?.[0] ?? "";
      return `${first}${last}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e) return e[0]!.toUpperCase();
  return "N";
}
