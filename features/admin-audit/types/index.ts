export type AdminAuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  tableName: string;
  recordId: string;
  /**
   * null khi không xác định được người thực hiện — trigger DB dựa vào
   * `auth.uid()` (Supabase Auth), nhưng app dùng JWT tự viết riêng + ghi
   * qua service-role key nên trigger không có JWT nào để đọc actor.
   */
  actorEmail: string | null;
  summary: string;
  createdAt: string;
}
