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

export interface AdminAuditListQuery {
  action?: AdminAuditAction | "all";
  actor?: string;
  from?: string;
  to?: string;
  /** Số dòng mỗi trang — omit = mặc định 100 (dashboard recent). */
  limit?: number;
  /** Offset 0-based — chỉ dùng khi phân trang UI. */
  offset?: number;
}

export interface AdminAuditListResult {
  items: AdminAuditEntry[];
  total: number;
}
